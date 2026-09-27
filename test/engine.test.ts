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
  it("flags swapped family/individual and HDHP minimum", () => {
    const codes = runChecks(extractFields(sample("messy-hdhp"))).map((f) => f.code);
    expect(codes).toContain("FAMILY_OOP_LT_INDIVIDUAL");
    expect(codes).toContain("HDHP_DEDUCTIBLE_BELOW_MIN");
    expect(codes).not.toContain("HSA_WITHOUT_HDHP");
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
    expect(r.extraction.fields.effective_date.value).toBe("2025-03-01");
    expect(r.findings.map((f) => f.code)).toContain("AI_DISAGREES");
    expect(r.meta.mode).toBe("rules+ai");
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
