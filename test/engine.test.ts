import { describe, expect, it } from "vitest";
import { analyze } from "../src/engine/analyze";
import { extractFields, parseDate } from "../src/engine/extract";
import { runChecks } from "../src/engine/rules";
import { SAMPLES } from "../src/samples";

const sample = (id: string) => SAMPLES.find((s) => s.id === id)!.text;

describe("parseDate", () => {
  it("handles common US formats", () => {
    expect(parseDate("01/01/2025")).toBe("2025-01-01");
    expect(parseDate("2025-07-01")).toBe("2025-07-01");
    expect(parseDate("Feb 1, 2025")).toBe("2025-02-01");
    expect(parseDate("13/45/2025")).toBeNull();
  });
});

describe("extractFields", () => {
  it("extracts every field from the clean sample with evidence", () => {
    const ex = extractFields(sample("clean-ppo"));
    expect(ex.fields.deductible_individual.value).toBe(1500);
    expect(ex.fields.oop_max_family.value).toBe(10000);
    expect(ex.fields.hsa_eligible.value).toBe(false);
    expect(ex.fields.deductible_individual.evidence[0].snippet).toMatch(/Individual: \$1,500/);
  });

  it("records conflicts when a field appears with different values", () => {
    const ex = extractFields(sample("conflicting-values"));
    expect(ex.fields.deductible_individual.conflicts).toEqual([500, 750]);
    expect(ex.fields.deductible_individual.confidence).toBeLessThan(0.7);
  });

  it("parses 'x / y' individual/family shorthand", () => {
    const ex = extractFields("Deductible: $2,000 / $4,000\nOut-of-pocket max: $6,000 / $12,000");
    expect(ex.fields.deductible_individual.value).toBe(2000);
    expect(ex.fields.deductible_family.value).toBe(4000);
    expect(ex.fields.oop_max_individual.value).toBe(6000);
    expect(ex.fields.oop_max_family.value).toBe(12000);
  });
});

describe("runChecks", () => {
  it("flags swapped family/individual values", () => {
    const codes = runChecks(extractFields(sample("messy-hdhp"))).map((f) => f.code);
    expect(codes).toContain("FAMILY_OOP_LT_INDIVIDUAL");
    expect(codes).not.toContain("HSA_WITHOUT_HDHP");
  });

  it("applies no jurisdiction- or plan-year-specific numeric limits", () => {
    const text =
      "Plan Type: HDHP\nHSA eligible: yes\nDeductible individual: $100\nDeductible family: $200\nOut-of-pocket maximum individual: $50,000\nOut-of-pocket maximum family: $99,000\nWaiting period: 365 days";
    const codes = runChecks(extractFields(text)).map((f) => f.code);
    for (const c of ["HDHP_DEDUCTIBLE_BELOW_MIN", "OOP_ABOVE_REFERENCE_LIMIT", "WAITING_PERIOD_ABOVE_LIMIT"]) expect(codes).not.toContain(c);
  });

  it("is clean for the clean sample", () => {
    expect(runChecks(extractFields(sample("clean-ppo")))).toEqual([]);
  });
});

describe("analyze with AI second opinion", () => {
  it("fills missing fields from AI and flags disagreements without overwriting", async () => {
    const r = await analyze(sample("sparse-email"), async () => ({
      employer_name: "Tailspin Toys",
      effective_date: "2025-04-01",
    }));
    expect(r.extraction.fields.employer_name.value).toBe("Tailspin Toys");
    expect(r.extraction.fields.employer_name.source).toBe("ai");
    expect(r.extraction.fields.employer_name.evidence[0]).toMatchObject({ page: 1, quote: "Tailspin Toys", verified: true });
    expect(r.extraction.fields.effective_date.value).toBe("2025-03-01");
    expect(r.findings.map((f) => f.code)).toContain("AI_DISAGREES");
    expect(r.meta.mode).toBe("rules+ai");
  });

  it("never populates a field from an AI value that is not in the source", async () => {
    const r = await analyze(sample("sparse-email"), async () => ({
      carrier: "Invented Mutual",
      deductible_individual: 2500,
      hsa_eligible: true,
      renewal_date: "2026-02-28",
    }));
    for (const k of ["deductible_individual", "hsa_eligible", "renewal_date"] as const) {
      expect(r.extraction.fields[k].value).toBeNull();
      expect(r.extraction.fields[k].evidence).toEqual([]);
    }
    const f = r.findings.find((x) => x.code === "AI_SUGGESTION_UNSUPPORTED")!;
    expect(f.fields).toEqual(expect.arrayContaining(["deductible_individual", "hsa_eligible", "renewal_date"]));
    for (const field of Object.values(r.extraction.fields))
      if (field.value !== null) {
        expect(field.evidence.length).toBeGreaterThan(0);
        for (const e of field.evidence) expect(e.verified).toBe(true);
      }
  });

  it("grounds AI values by locating their literal text, including reformatted numbers and dates", async () => {
    const r = await analyze("Group: Contoso\nCoverage starting March 1, 2025 for all staff\nFamily limit is $1,500 per year", async () => ({
      effective_date: "2025-03-01",
      deductible_family: 1500,
    }));
    expect(r.extraction.fields.effective_date.evidence[0]).toMatchObject({ quote: "March 1, 2025", page: 1, verified: true });
    expect(r.extraction.fields.deductible_family.evidence[0]).toMatchObject({ quote: "$1,500", verified: true });
  });

  it("degrades to rules-only when the AI call fails", async () => {
    const r = await analyze(sample("clean-ppo"), async () => {
      throw new Error("boom");
    });
    expect(r.meta.mode).toBe("rules");
    expect(r.meta.ai_note).toMatch(/boom/);
    expect(r.summary.disposition).toBe("ready");
  });
});
