import { describe, expect, it } from "vitest";
import { analyze, recheck, type ReviewedField } from "../src/engine/analyze";
import { extractFields, verifyEvidence } from "../src/engine/extract";
import { SAMPLES } from "../src/samples";
import { FIELD_KEYS, type FieldKey } from "../src/engine/types";

const sample = (id: string) => SAMPLES.find((s) => s.id === id)!.text;

describe("page-aware provenance", () => {
  it("gives every populated field a verified verbatim quote with page and offsets", () => {
    for (const s of SAMPLES) {
      const ex = extractFields(s.text);
      for (const k of FIELD_KEYS) {
        const f = ex.fields[k];
        if (f.value === null) {
          expect(f.evidence).toEqual([]);
          continue;
        }
        expect(f.evidence.length).toBeGreaterThan(0);
        for (const e of f.evidence) {
          expect(e.verified).toBe(true);
          expect(e.snippet.slice(e.start, e.end)).toBe(e.quote);
          expect(s.text.split("\f")[e.page - 1]).toContain(e.quote);
          expect(ex.lines[e.line]).toEqual({ page: e.page, page_line: e.page_line, text: e.snippet });
        }
      }
    }
  });

  it("preserves original whitespace in quotes even though matching is whitespace-insensitive", () => {
    const ex = extractFields("Carrier:\t  Acme   Mutual\nDeductible  individual:   $1,000");
    expect(ex.fields.carrier.value).toBe("Acme Mutual");
    expect(ex.fields.carrier.evidence[0].quote).toBe("Carrier:\t  Acme   Mutual");
    expect(ex.fields.deductible_individual.evidence[0].quote).toBe("Deductible  individual:   $1,000");
  });

  it("reports both quotes and pages for a cross-page contradiction", () => {
    const f = extractFields(sample("conflicting-values")).fields.deductible_individual;
    expect(f.conflicts).toEqual([500, 750]);
    expect(f.evidence.map((e) => [e.page, e.value, e.quote])).toEqual([
      [1, 500, "Deductible (individual): $500"],
      [2, 750, "Deductible (individual): $750"],
    ]);
  });

  it("numbers lines per page for page-array input", () => {
    const ex = extractFields(["Employer: A Co", "Header\nCarrier: B Health"]);
    expect(ex.pages).toBe(2);
    expect(ex.fields.carrier.evidence[0]).toMatchObject({ page: 2, page_line: 2, quote: "Carrier: B Health" });
  });

  it("rejects evidence that does not re-locate in the source", () => {
    const e = extractFields("Carrier: Acme").fields.carrier.evidence[0];
    expect(verifyEvidence("Carrier: Acme", e)).toBe(true);
    expect(verifyEvidence("Carrier: Other", e)).toBe(false);
    expect(verifyEvidence("Carrier: Acme", { ...e, page: 2 })).toBe(false);
    expect(verifyEvidence("Carrier: Acme", { ...e, quote: "Carrier: Acmx" })).toBe(false);
  });
});

describe("reviewer recheck", () => {
  const toReviewed = async (id: string) => {
    const r = await analyze(sample(id));
    const out = {} as Record<FieldKey, ReviewedField>;
    for (const k of FIELD_KEYS) {
      const f = r.extraction.fields[k];
      out[k] = { value: f.value, review_status: "pending", confidence: f.confidence, conflicts: f.conflicts };
    }
    return out;
  };

  it("matches the automatic disposition when nothing is reviewed", async () => {
    const r = recheck(await toReviewed("conflicting-values"));
    expect(r.findings.map((f) => f.code)).toContain("CONFLICTING_VALUES");
  });

  it("clears conflicts and missing fields once the reviewer resolves them", async () => {
    const f = await toReviewed("conflicting-values");
    for (const k of ["deductible_individual", "deductible_family", "er_copay"] as FieldKey[]) f[k].review_status = "accepted";
    f.employer_contribution_pct = { value: 75, review_status: "edited", confidence: 0 };
    const codes = recheck(f).findings.map((x) => x.code);
    expect(codes).not.toContain("CONFLICTING_VALUES");
    expect(codes).not.toContain("MISSING_REQUIRED");
  });
});
