import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/engine/analyze";
import { itemsToLines, pdfToText } from "../public/pdf-text.js";

const pdfjs = { getDocument };
const load = (id: string) => new Uint8Array(readFileSync(`public/samples/${id}.pdf`));

describe("itemsToLines", () => {
  it("groups glyph runs by y and orders them by x", () => {
    const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });
    expect(itemsToLines([item("$1,500", 200, 700), item("Deductible:", 50, 701), item("Carrier: X", 50, 680)])).toEqual([
      "Deductible: $1,500",
      "Carrier: X",
    ]);
  });
});

describe("PDF intake end-to-end (sample PDFs → text → analysis)", () => {
  const cases: [string, "ready" | "blocked", string[]][] = [
    ["clean-ppo", "ready", []],
    ["messy-hdhp", "blocked", ["FAMILY_OOP_LT_INDIVIDUAL", "HDHP_DEDUCTIBLE_BELOW_MIN"]],
    ["conflicting-values", "blocked", ["CONFLICTING_VALUES", "MISSING_REQUIRED"]],
    ["sparse-email", "blocked", ["MISSING_REQUIRED"]],
  ];
  for (const [id, disposition, codes] of cases) {
    it(`${id}.pdf → ${disposition}`, async () => {
      const { text, pages } = await pdfToText(pdfjs, load(id));
      expect(pages).toBeGreaterThanOrEqual(1);
      const r = await analyze(text);
      expect(r.summary.disposition).toBe(disposition);
      for (const c of codes) expect(r.findings.map((f) => f.code)).toContain(c);
    });
  }

  it("extracts the clean PPO field values exactly as from text", async () => {
    const { text } = await pdfToText(pdfjs, load("clean-ppo"));
    const f = (await analyze(text)).extraction.fields;
    expect(f.deductible_individual.value).toBe(1500);
    expect(f.oop_max_family.value).toBe(10000);
    expect(f.effective_date.value).toBe("2025-01-01");
    expect(f.employer_name.value).toBe("Northwind Traders LLC");
  });
});
