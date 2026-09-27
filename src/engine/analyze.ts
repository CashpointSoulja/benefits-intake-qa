import { extractFields } from "./extract";
import { runChecks } from "./rules";
import {
  FIELD_KEYS,
  REQUIRED_FIELDS,
  type AnalysisResult,
  type Extraction,
  type FieldKey,
  type FieldValue,
  type Finding,
} from "./types";

export interface AiExtractor {
  (text: string): Promise<Partial<Record<FieldKey, FieldValue | null>>>;
}

export function summarize(ex: Extraction, findings: Finding[]): AnalysisResult["summary"] {
  const errors = findings.filter((x) => x.severity === "error").length;
  const warnings = findings.filter((x) => x.severity === "warning").length;
  const present = REQUIRED_FIELDS.filter((k) => ex.fields[k].value !== null).length;
  return {
    required_present: present,
    required_total: REQUIRED_FIELDS.length,
    errors,
    warnings,
    disposition: errors > 0 ? "blocked" : warnings > 0 ? "needs_review" : "ready",
  };
}

/**
 * Core pipeline: deterministic extraction -> optional AI second opinion -> rule checks.
 * The AI never overwrites a rule-extracted value; disagreement becomes a review finding.
 */
export async function analyze(text: string, ai?: AiExtractor): Promise<AnalysisResult> {
  const t0 = Date.now();
  const extraction = extractFields(text);
  let mode: AnalysisResult["meta"]["mode"] = "rules";
  let ai_note: string | undefined;
  const extra: Finding[] = [];

  if (ai) {
    try {
      const guess = await ai(text);
      mode = "rules+ai";
      const filled: FieldKey[] = [];
      const disagree: string[] = [];
      for (const k of FIELD_KEYS) {
        const g = guess[k];
        if (g === undefined || g === null || g === "") continue;
        const cur = extraction.fields[k];
        if (cur.value === null) {
          extraction.fields[k] = { ...cur, value: g, confidence: 0.5, source: "ai" };
          filled.push(k);
        } else if (String(cur.value).toLowerCase() !== String(g).toLowerCase()) {
          extraction.fields[k] = { ...cur, source: "merged" };
          disagree.push(`${k}: rules=${String(cur.value)} ai=${String(g)}`);
        }
      }
      if (filled.length)
        extra.push({
          code: "AI_FILLED_FIELD",
          severity: "info",
          message: `AI model supplied ${filled.length} field(s) the rules missed: ${filled.join(", ")}.`,
          fields: filled,
          action: "Verify these manually; model-supplied values have no line-level evidence.",
        });
      if (disagree.length)
        extra.push({
          code: "AI_DISAGREES",
          severity: "warning",
          message: `AI model disagrees with rule extraction on ${disagree.length} field(s): ${disagree.join("; ")}.`,
          fields: disagree.map((d) => d.split(":")[0] as FieldKey),
          action: "Check the source line; the rule value is kept until a reviewer confirms.",
        });
    } catch (e) {
      ai_note = `AI unavailable, rules only (${e instanceof Error ? e.message : String(e)})`;
    }
  }

  const findings = [...runChecks(extraction), ...extra];
  return {
    extraction,
    findings,
    summary: summarize(extraction, findings),
    meta: { mode, ai_note, ms: Date.now() - t0 },
  };
}
