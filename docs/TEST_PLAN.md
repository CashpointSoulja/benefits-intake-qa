# Test Plan: Benefits Intake QA v0.1

**Author:** Ayo Ahmed. **Date:** September 27, 2026. **System under test:** `main` at merge commit `97fdd9a` (application code as of `43fb980`), deployed at https://benefits-intake-qa.ayomideahmedcp.workers.dev/

> Independent prototype by Ayo Ahmed, not affiliated with Euphoric. All test data is synthetic. No real plan documents or personal data are used in any test.

## 1. Purpose and framing
This plan checks that the shipped prototype does what the [PRD](PRD.md) acceptance criteria (AC1–AC10) promise. It organises the checks using the four functions of the NIST AI RMF Core ([Govern, Map, Measure, Manage](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)):

| AI RMF function | How this plan applies it |
|---|---|
| Govern | Human-in-the-loop by design. A reviewer accepts or edits every field; AI never overwrites rules; there is a non-affiliation disclaimer and no real data |
| Map | Intended use and context are stated in PRD §3–§6. Out of scope: OCR, non-US schemas, compliance determinations |
| Measure | Unit tests, a golden-set evaluation with thresholds, and browser tests of the deployed app (below) |
| Manage | Blocking dispositions, clear fallbacks (AI unavailable, scanned PDF), and gaps logged with owners in [ROADMAP.md](ROADMAP.md) |

**What this plan cannot show:** the golden set has six synthetic cases, and the rules were written against them. Passing shows internal consistency and no regressions. It does **not** establish real-world extraction accuracy, which needs the held-out validation in the roadmap.

## 2. Levels and entry/exit criteria
| Level | Tool | Entry | Exit (pass) |
|---|---|---|---|
| L1 Static | `npm run typecheck` (tsc strict) | Clean checkout, `npm ci` | 0 errors |
| L2 Unit/integration | `npm test` (Vitest, 25 tests), including a real pdf.js parse of the sample PDFs in Node | L1 pass | All pass |
| L3 Evaluation | `npm run eval` against `eval/golden/cases.json` (6 synthetic cases) | L2 pass | Field precision ≥ 0.95, field recall ≥ 0.90, finding recall = 1.00, disposition accuracy = 1.00 |
| L4 Production browser | Chrome, production URL, synthetic PDFs only | Deployed assets match `main` (hash check) | All P0 cases pass. Failures are logged with evidence |
| L5 Demo | 45–90 s screen recording of production | L4 run | Frames inspected: legible, production URL only, no test harness |

## 3. Test data
- `public/samples/clean-ppo.pdf`: 1 page, all 18 fields, expected **Ready**.
- `public/samples/messy-hdhp.pdf`: swapped individual/family OOP, expected **Blocked** (`FAMILY_OOP_LT_INDIVIDUAL`).
- `public/samples/conflicting-values.pdf`: 2 pages; the summary (p.1) and rate sheet (p.2) disagree. Expected **Blocked** (`CONFLICTING_VALUES`, `MISSING_REQUIRED`).
- `public/samples/sparse-email.pdf`: broker email with most fields missing, expected **Blocked** (`MISSING_REQUIRED`).
- An image-only PDF (no text layer) generated locally, to test scan rejection.
- A `.txt` file and pasted text, to test non-PDF intake.

## 4. Production browser cases (L4)
| ID | Priority | AC | Steps | Expected |
|---|---|---|---|---|
| T1 | P0 | AC8 | Load `/` | Euphoric logo and screenshots render, with © Euphoric attribution and "Independent prototype by Ayo Ahmed, not affiliated with Euphoric" |
| T2 | P0 | AC1, AC2 | Click the Clean PPO PDF | Ready; 1 page; 18 fields; every populated field shows `p.N · line M` and an exact quote. Clicking a field highlights the span in the source |
| T3 | P0 | AC4 | Messy HDHP PDF | Blocked; only `FAMILY_OOP_LT_INDIVIDUAL`; no ACA/HDHP/waiting-period limit codes |
| T4 | P0 | AC3 | Conflicting pages PDF | Blocked; 2 pages; individual deductible shows p.1 "$500" and p.2 "$750", each with "Use this" |
| T5 | P0 | AC1 | Sparse email PDF | Blocked; `MISSING_REQUIRED` |
| T6 | P0 | AC10 | Use this, edit, Accept, Confirm missing, Accept all unflagged, Undo | Badges and counter update; the recheck moves "After review" to Ready once conflicts and missing fields are resolved |
| T7 | P0 | AC10 | Download reviewed JSON | `schema: benefits-intake-qa/reviewed-plan@1`; `review.status` goes from `in_progress` to `complete`; `pages: 2`; the chosen page-2 quote; missing fields stay `null` |
| T8 | P0 | Scope | Upload a scanned or image-only PDF | Clear "no text layer / OCR out of scope" error; previous results are cleared |
| T9 | P1 | — | Edit the textarea after an analysis | Previous results and download are hidden (stale-result invalidation) |
| T10 | P1 | AC6 | Tick the AI second-opinion box ("Add Workers AI second opinion" in the tested v0.1 build; "Add OpenAI second opinion" after PR #3) | Either AI runs with grounded values only, or rules-only with an `ai_note`. No errors either way |
| T11 | P1 | — | Accessibility basics: keyboard-only tab order, visible focus, accessible names, image alt text, `<html lang>`, axe-core scan | No critical axe violations; every control reachable by keyboard |
| T12 | P0 | — | Console and `/api/health` | No console errors; health returns 200 |

## 5. Recording results
[TEST_RESULTS.md](TEST_RESULTS.md) records, for each case:
- expected, actual and pass/fail;
- evidence (screenshot or recording);
- browser version, UTC date/time and commit.

Failures and untested items are listed as gaps rather than omitted.
