/**
 * Offline evaluation of the deterministic pipeline against a golden set.
 * Usage: npm run eval   (exit code 1 if any metric falls below the thresholds in THRESHOLDS)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyze } from "../src/engine/analyze";
import { SAMPLES } from "../src/samples";
import type { FieldKey, FieldValue } from "../src/engine/types";

interface Case {
  id: string;
  sample?: string;
  text?: string;
  expected_fields: Partial<Record<FieldKey, FieldValue | null>>;
  expected_findings: string[];
  expected_disposition: "ready" | "needs_review" | "blocked";
}

const THRESHOLDS = { field_precision: 0.95, field_recall: 0.9, finding_recall: 1.0, disposition_accuracy: 1.0 };

const cases = JSON.parse(readFileSync(fileURLToPath(new URL("./golden/cases.json", import.meta.url).href), "utf8")) as Case[];

const eq = (a: FieldValue | null, b: FieldValue | null) =>
  a === b || (typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase());

let tp = 0, fp = 0, fn = 0, tn = 0, wrong = 0;
let findTp = 0, findFn = 0, findFp = 0;
let dispOk = 0;
const perCase: string[] = [];

for (const c of cases) {
  const text = c.text ?? SAMPLES.find((s) => s.id === c.sample)?.text;
  if (!text) throw new Error(`case ${c.id}: no text`);
  const r = await analyze(text);
  const problems: string[] = [];

  for (const [k, expected] of Object.entries(c.expected_fields) as [FieldKey, FieldValue | null][]) {
    const got = r.extraction.fields[k].value;
    if (expected === null && got === null) tn++;
    else if (expected === null && got !== null) { fp++; problems.push(`${k}: expected null, got ${String(got)}`); }
    else if (expected !== null && got === null) { fn++; problems.push(`${k}: missed (expected ${String(expected)})`); }
    else if (eq(got, expected)) tp++;
    else { wrong++; problems.push(`${k}: expected ${String(expected)}, got ${String(got)}`); }
  }

  const gotCodes = new Set(r.findings.map((f) => f.code));
  const expCodes = new Set(c.expected_findings);
  for (const code of expCodes) {
    if (gotCodes.has(code)) findTp++;
    else { findFn++; problems.push(`finding missing: ${code}`); }
  }
  for (const code of gotCodes) {
    if (!expCodes.has(code) && code !== "LOW_CONFIDENCE" && code !== "PLAN_YEAR_NOT_12_MONTHS") {
      findFp++;
      problems.push(`unexpected finding: ${code}`);
    }
  }

  if (r.summary.disposition === c.expected_disposition) dispOk++;
  else problems.push(`disposition: expected ${c.expected_disposition}, got ${r.summary.disposition}`);

  perCase.push(`${problems.length ? "FAIL" : "ok  "} ${c.id}${problems.length ? "\n      - " + problems.join("\n      - ") : ""}`);
}

const fieldPrecision = tp / Math.max(1, tp + fp + wrong);
const fieldRecall = tp / Math.max(1, tp + fn + wrong);
const findingRecall = findTp / Math.max(1, findTp + findFn);
const findingPrecision = findTp / Math.max(1, findTp + findFp);
const dispAcc = dispOk / cases.length;

console.log(perCase.join("\n"));
console.log("\n=== Field extraction (value-level) ===");
console.log(`correct=${tp} wrong=${wrong} missed=${fn} spurious=${fp} correct-null=${tn}`);
console.log(`precision=${fieldPrecision.toFixed(3)} recall=${fieldRecall.toFixed(3)}`);
console.log("\n=== QA findings (code-level) ===");
console.log(`recall=${findingRecall.toFixed(3)} precision=${findingPrecision.toFixed(3)}`);
console.log(`\n=== Disposition accuracy === ${dispAcc.toFixed(3)} (${dispOk}/${cases.length})`);

const failures = [
  fieldPrecision < THRESHOLDS.field_precision && "field_precision",
  fieldRecall < THRESHOLDS.field_recall && "field_recall",
  findingRecall < THRESHOLDS.finding_recall && "finding_recall",
  dispAcc < THRESHOLDS.disposition_accuracy && "disposition_accuracy",
].filter(Boolean);
if (failures.length) {
  console.error(`\nBelow threshold: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll thresholds met.");
