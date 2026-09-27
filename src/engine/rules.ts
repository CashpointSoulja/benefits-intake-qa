import {
  FIELD_LABELS,
  REQUIRED_FIELDS,
  type Extraction,
  type FieldKey,
  type Finding,
} from "./types";

const num = (ex: Extraction, k: FieldKey): number | null => {
  const v = ex.fields[k].value;
  return typeof v === "number" ? v : null;
};

export function runChecks(ex: Extraction): Finding[] {
  const out: Finding[] = [];
  const f = ex.fields;

  const missing = REQUIRED_FIELDS.filter((k) => f[k].value === null);
  if (missing.length) {
    out.push({
      code: "MISSING_REQUIRED",
      severity: "error",
      message: `${missing.length} required field(s) not found: ${missing.map((k) => FIELD_LABELS[k]).join(", ")}.`,
      fields: missing,
      action: "Locate in the source document or request from the client before loading the plan.",
    });
  }

  for (const k of Object.keys(f) as FieldKey[]) {
    const c = f[k].conflicts;
    if (c && c.length > 1) {
      out.push({
        code: "CONFLICTING_VALUES",
        severity: "error",
        message: `${FIELD_LABELS[k]} appears with different values: ${c.map(String).join(" vs ")}.`,
        fields: [k],
        action: "Confirm the authoritative value with the client; do not load until resolved.",
      });
    }
  }

  const dI = num(ex, "deductible_individual");
  const dF = num(ex, "deductible_family");
  const oI = num(ex, "oop_max_individual");
  const oF = num(ex, "oop_max_family");
  const coins = num(ex, "coinsurance_pct");
  const contrib = num(ex, "employer_contribution_pct");
  const planType = f.plan_type.value;
  const hsa = f.hsa_eligible.value;

  if (dI !== null && dF !== null && dF < dI)
    out.push({
      code: "FAMILY_DEDUCTIBLE_LT_INDIVIDUAL",
      severity: "error",
      message: `Family deductible ($${dF}) is lower than individual deductible ($${dI}).`,
      fields: ["deductible_individual", "deductible_family"],
      action: "Values are likely swapped or mistyped; verify against the carrier summary.",
    });
  if (oI !== null && oF !== null && oF < oI)
    out.push({
      code: "FAMILY_OOP_LT_INDIVIDUAL",
      severity: "error",
      message: `Family out-of-pocket max ($${oF}) is lower than individual ($${oI}).`,
      fields: ["oop_max_individual", "oop_max_family"],
      action: "Values are likely swapped or mistyped; verify against the carrier summary.",
    });
  if (dI !== null && oI !== null && oI < dI)
    out.push({
      code: "OOP_LT_DEDUCTIBLE",
      severity: "error",
      message: `Individual out-of-pocket max ($${oI}) is lower than the deductible ($${dI}).`,
      fields: ["deductible_individual", "oop_max_individual"],
      action: "Out-of-pocket max must be at least the deductible; confirm which figure is wrong.",
    });
  if (dF !== null && oF !== null && oF < dF)
    out.push({
      code: "OOP_LT_DEDUCTIBLE",
      severity: "error",
      message: `Family out-of-pocket max ($${oF}) is lower than the family deductible ($${dF}).`,
      fields: ["deductible_family", "oop_max_family"],
      action: "Out-of-pocket max must be at least the deductible; confirm which figure is wrong.",
    });

  const isHdhp = planType === "HDHP";
  if (hsa === true && planType !== null && !isHdhp)
    out.push({
      code: "HSA_WITHOUT_HDHP",
      severity: "warning",
      message: `The document marks the plan HSA-eligible but states plan type ${String(planType)}, not HDHP.`,
      fields: ["hsa_eligible", "plan_type"],
      action: "The two stated values disagree with each other; confirm plan type and HSA status with the carrier.",
    });

  if (coins !== null && (coins < 0 || coins > 100))
    out.push({
      code: "PERCENT_OUT_OF_RANGE",
      severity: "error",
      message: `Coinsurance ${coins}% is outside 0-100%.`,
      fields: ["coinsurance_pct"],
      action: "Re-read the source; coinsurance is usually 10-40% member share.",
    });
  if (coins !== null && coins > 50)
    out.push({
      code: "COINSURANCE_LIKELY_INVERTED",
      severity: "warning",
      message: `Member coinsurance ${coins}% is unusually high; the document may state the plan's share rather than the member's.`,
      fields: ["coinsurance_pct"],
      action: "Confirm whether the figure is the member share or the plan share.",
    });
  if (contrib !== null && (contrib < 0 || contrib > 100))
    out.push({
      code: "PERCENT_OUT_OF_RANGE",
      severity: "error",
      message: `Employer contribution ${contrib}% is outside 0-100%.`,
      fields: ["employer_contribution_pct"],
      action: "Re-read the source document.",
    });

  const eff = f.effective_date.value;
  const ren = f.renewal_date.value;
  if (typeof eff === "string" && typeof ren === "string" && ren <= eff)
    out.push({
      code: "RENEWAL_NOT_AFTER_EFFECTIVE",
      severity: "error",
      message: `Renewal date (${ren}) is not after the effective date (${eff}).`,
      fields: ["effective_date", "renewal_date"],
      action: "Confirm plan-year dates.",
    });
  if (typeof eff === "string" && typeof ren === "string" && ren > eff) {
    const days = (Date.parse(ren) - Date.parse(eff)) / 86_400_000;
    if (Math.abs(days - 365) > 31)
      out.push({
        code: "PLAN_YEAR_NOT_12_MONTHS",
        severity: "info",
        message: `Plan year spans ${Math.round(days)} days; most plan years are 12 months.`,
        fields: ["effective_date", "renewal_date"],
        action: "Confirm whether this is a short or long plan year.",
      });
  }

  const lowConf = (Object.keys(f) as FieldKey[]).filter(
    (k) => f[k].value !== null && f[k].confidence < 0.7 && !f[k].conflicts,
  );
  if (lowConf.length)
    out.push({
      code: "LOW_CONFIDENCE",
      severity: "info",
      message: `Low-confidence extraction for: ${lowConf.map((k) => FIELD_LABELS[k]).join(", ")}.`,
      fields: lowConf,
      action: "Spot-check these against the highlighted source lines.",
    });

  return out;
}
