# Benefits Intake QA: technical write-up

**Author:** Ayo Ahmed. **Date:** September 28, 2026. **Code:** `main` at `7a812fd`.

> Independent prototype by Ayo Ahmed, not affiliated with or endorsed by Euphoric. Hypothesis-testing demo, not a deployed client product. All plan data is synthetic.

Sources for everything below: `README.md`, `docs/PRD.md`, `docs/TEST_RESULTS.md`, `wrangler.jsonc`, and the files under `src/`, `public/` and `test/`.

## 1. Architecture at a glance
```
Browser (public/)                               Cloudflare Worker (src/worker.ts)
─────────────────                               ────────────────────────────────
index.html / app.js / style.css                 GET  /api/health
pdf-text.js + vendor/pdfjs (legacy build)       GET  /api/samples
  PDF → per-page text (in browser)  ── pages[] ─▶ POST /api/analyze  ─▶ engine/analyze.ts
reviewer accept / edit                            │     extract.ts  (18 fields + provenance)
  ── reviewed fields ─────────────────────────▶ POST /api/recheck   │     [optional] ai/openai.ts ──▶ OpenAI
Download reviewed JSON (client-side)              │     rules.ts    (11 QA checks)      ▲
                                                  │     summarize → disposition         │ reserve / settle
                                                  └──────────────────────────────── BudgetGate (SQLite DO)
```
- **One Worker, two jobs.** `src/worker.ts` (TypeScript) answers `/api/*` and serves everything else from the `ASSETS` binding pointing at `./public` (`wrangler.jsonc`).
- **No persistence of documents.** Only the budget ledger is stored. Input is capped at 60,000 characters and 200 pages.
- **Stack:** TypeScript, Cloudflare Workers + Wrangler, pdf.js (`pdfjs-dist`, self-hosted legacy build), Vitest, Miniflare for Durable Object tests.

## 2. In-browser PDF text extraction
- pdf.js is served from the Worker's own assets (`public/vendor/pdfjs`), not a third-party CDN.
- `public/pdf-text.js` (shared by the UI and the Node test suite) groups glyph runs into visual lines by y-coordinate (±2 units), sorts them left to right, and returns **one string per page**. Only `pages: string[]` is sent to the API, so page boundaries survive.
- A PDF with fewer than 20 non-whitespace characters is rejected as scanned ("OCR is out of scope for v0.1").
- `.txt` and pasted text are also accepted (`{ "text": ... }`, with `\f` as a page separator).
- `test/pdf.test.ts` runs the four sample PDFs through the real pdf.js path in Node and requires the same disposition and findings as the text versions (AC9).

## 3. Deterministic extraction: 18 fields with provenance
`src/engine/extract.ts` uses label-driven patterns to fill this fixed schema (`src/engine/types.ts`):

| Group | Fields |
|---|---|
| Plan identity | `employer_name`, `carrier`, `plan_name`, `plan_type` |
| Dates | `effective_date`, `renewal_date` |
| Cost sharing | `deductible_individual`, `deductible_family`, `oop_max_individual`, `oop_max_family`, `coinsurance_pct` |
| Copays | `pcp_copay`, `specialist_copay`, `er_copay` |
| Eligibility and funding | `waiting_period_days`, `eligibility_hours_per_week`, `employer_contribution_pct`, `hsa_eligible` |

Each populated field has a fixed, pattern-level heuristic `confidence` and at least one **evidence** item:

```ts
{ page, page_line, line, quote, start, end, snippet, value, verified }
```
- `quote` is copied character-for-character from the submitted text (matching is whitespace-insensitive; the quote keeps the original whitespace).
- `snippet.slice(start, end) === quote`, and `verified` is true only when the quote is re-located at the stated page and offsets.
- Fields not found are `value: null` with no evidence.
- If the document states the same field with different values, the field keeps every evidence item plus a `conflicts` array; the tool never silently picks one.
- `test/provenance.test.ts` enforces this contract (AC2).

## 4. The 11 QA checks
From `src/engine/rules.ts`:

| # | Code | Severity | What it catches |
|---|---|---|---|
| 1 | `MISSING_REQUIRED` | error | A required field is null |
| 2 | `CONFLICTING_VALUES` | error | Same field stated with different values (all quotes and pages shown) |
| 3 | `FAMILY_DEDUCTIBLE_LT_INDIVIDUAL` | error | Family deductible below individual |
| 4 | `FAMILY_OOP_LT_INDIVIDUAL` | error | Family OOP max below individual |
| 5 | `OOP_LT_DEDUCTIBLE` | error | OOP max below the deductible (individual or family) |
| 6 | `HSA_WITHOUT_HDHP` | warning | HSA-eligible but plan type is not HDHP |
| 7 | `PERCENT_OUT_OF_RANGE` | error | A percentage outside 0–100 |
| 8 | `COINSURANCE_LIKELY_INVERTED` | warning | Coinsurance that looks like the plan's share rather than the member's |
| 9 | `RENEWAL_NOT_AFTER_EFFECTIVE` | error | Renewal date not after effective date |
| 10 | `PLAN_YEAR_NOT_12_MONTHS` | info | Plan year length is not 12 months |
| 11 | `LOW_CONFIDENCE` | info | Extraction confidence below threshold |

Deliberately **not** applied: jurisdiction- or plan-year-specific limits (ACA OOP maximums, IRS HDHP minimum deductibles, waiting-period caps). They were removed in PR #1 because the demo captures no jurisdiction or plan year.

The AI path adds three more finding codes of its own: `AI_FILLED_FIELD`, `AI_SUGGESTION_UNSUPPORTED`, `AI_DISAGREES` (`src/engine/analyze.ts`).

## 5. Dispositions
`summarize()` in `src/engine/analyze.ts`:
- **blocked** if there is any error,
- **needs review** (`needs_review`) if there is any warning,
- **ready** otherwise.

## 6. Reviewer accept/edit loop and reviewed-JSON export
1. Clicking a finding or field highlights the exact quote(s) in the page-labelled source. For a conflict, each quote is shown with its page and value and a **Use this** button.
2. The reviewer **accepts** or **edits** each value, or confirms a missing field as null. Reviewer-entered values without a source are labelled "no source quote".
3. After each change the UI calls `POST /api/recheck` with `{ fields: { <key>: { value, review_status, confidence, conflicts? } } }`; the same checks re-run on the reviewed values and an "after review" disposition is shown.
4. **Download reviewed JSON** produces `benefits-intake-qa/reviewed-plan@1`: per field `value` (null if missing), `review_status` (`pending` / `accepted` / `edited`), `extracted_value`, `page`, `quote`, all evidence and conflicts; plus `review.status` (`in_progress` / `complete`) and both the extracted and reviewed dispositions. Examples: `docs/evidence/T7-reviewed-in-progress.json`, `docs/evidence/T7-reviewed-complete.json`.

## 7. Optional OpenAI second opinion behind `BudgetGate`
Added in PR #3 (https://github.com/CashpointSoulja/benefits-intake-qa/pull/3), replacing the retired Workers AI model (see [BUILD_STORY.md](BUILD_STORY.md)).

**Grounding rules** (`src/engine/analyze.ts`):
- Rules always run first. The AI **never overwrites** a rule value; a disagreement becomes `AI_DISAGREES`.
- It may fill a gap only when `locateValue()` finds the proposed value literally in the source (numbers and dates also in common reformattings, e.g. `1500` → "$1,500"). The field then gets verified page/quote evidence, `source: "ai"`, confidence 0.5, and an `AI_FILLED_FIELD` warning, so the document goes to **needs review**.
- A suggestion that cannot be located (including any boolean) is not stored; the field stays `null` and it appears only in `AI_SUGGESTION_UNSUPPORTED`.
- If the AI call fails for any reason, the response is still 200 with `mode: "rules"` and an `ai_note` (AC6).

**Model and request** (`src/ai/openai.ts`):
- Only `gpt-5.4-nano-2026-03-17` is accepted; prices pinned at **$0.22 input / $1.375 output per million tokens** (OpenAI's $0.20 / $1.25 plus the 10% regional uplift). Env overrides may only raise prices; any other model disables AI.
- Chat Completions, `n: 1`, `service_tier: "default"`, `reasoning_effort: "none"`, JSON output, `store: false`, `max_completion_tokens: 800`, 12,000-character input cap, 20 s timeout. No tools, web search, audio or images.
- Only `OPENAI_API_KEY` (a Worker secret) is required. The UI sends `use_ai: true` only when the reviewer ticks **Add OpenAI second opinion**.

**Budget gate** (`src/budget/gate.ts`, `src/budget/ledger.ts`, `wrangler.jsonc`):
- `BudgetGate` is a single SQLite-backed Durable Object (binding `BUDGET_GATE`, migration `v1`, `new_sqlite_classes`) that serialises every spend decision in integer micro-USD.
- **Reserve before fetch:** worst-case cost = (serialized request bytes + 64 tokens) × input price + 800 × output price. No reservation, no request. `test/tokenizer.test.ts` checks the byte bound against `tiktoken` `o200k_base` counts.
- **Lifetime cap $1.80** in code (`LIFETIME_CAP_MICROS = 1_800_000`; effective limit = `Math.min(configured, stored, cap)`), "a margin under the owner's $2 total". `AI_LIFETIME_BUDGET_USD` can only lower it, and a lowered value can't be raised later. The ledger survives deploys and is independent of the OpenAI project's monthly limit.
- **Fail closed:** unknown usage, HTTP or network errors keep the full reservation charged. A reported cost above the reservation, or an unexpected model or service tier, is recorded as an **anomaly that halts all later AI calls** until reviewed.
- **Previews** get their own empty ledger, so `wrangler.jsonc` sets `AI_DISABLED` there and Previews are rules-only.
- **Not built:** per-visitor rate limiting, so one visitor can use the whole lifetime budget.

**Deployment status:** as checked on 2026-09-28, the live Worker reports `{"ok":true,"ai_provider":"openai","ai_configured":true}` at `/api/health` and serves `main`'s frontend (SHA-256 of `index.html`, `app.js`, `style.css`, `pdf-text.js` match). `ai_configured` is true only when AI is not disabled, the OpenAI config is valid and `BUDGET_GATE` is bound (`src/worker.ts`). Ayo reports one supervised paid spot-check (3 requests, ~600 tokens, per the OpenAI usage page); that is not recorded in the repo. The OpenAI second opinion is **live** on the demo as an opt-in layer on top of the rules engine. `README.md`, `docs/PRD.md` and `docs/TEST_RESULTS.md` predate this deploy, so their production-status notes are out of date.

## 8. Testing and evaluation
| Level | Result (from `docs/TEST_RESULTS.md`) |
|---|---|
| Typecheck | Pass |
| Unit/integration (PR #3, local) | 7 files, 56/56 tests, incl. 200 concurrent reservations against a real `BudgetGate` in Miniflare |
| Golden-set eval (`npm run eval`) | All thresholds met on 6 synthetic cases (precision/recall 1.000; thresholds ≥ 0.95 / ≥ 0.90) |
| Production browser (v0.1 build `97fdd9a`) | 11 of 12 pass; T11 accessibility fails on axe-core findings |

**Limits:** the rules were written against the six synthetic golden cases, so the eval is a regression suite, not a real-world accuracy estimate. No held-out or real documents, no AI evaluation on held-out data, only Chrome 137 tested, no load test. The production browser suite has not been re-run against the post-PR #3 deploy.

## 9. Out of scope (v0.1)
OCR and table recovery; dental, vision, life, disability and non-US schemas; persistence, auth, multi-user queues and audit trail; writing to any benefits administration system; real client or PII data; legal or compliance determinations.
