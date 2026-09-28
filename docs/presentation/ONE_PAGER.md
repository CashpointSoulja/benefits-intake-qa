# Benefits Intake QA: one-pager

**Author:** Ayo Ahmed. **Prepared for:** a presentation to Euphoric for the Forward-Deployed AI Product Associate role. **Date:** September 28, 2026.

> **Independent prototype by Ayo Ahmed, not affiliated with or endorsed by Euphoric.** It is not Euphoric's product and not a client implementation. It is a hypothesis-testing demo. The UI shows Euphoric's logo and screenshots, which are © Euphoric (see `public/brand/ATTRIBUTION.md`). **All plan data is synthetic.**

- **Live demo:** https://benefits-intake-qa.ayomideahmedcp.workers.dev/
- **Repo docs:** [PRD](../PRD.md), [Test plan](../TEST_PLAN.md), [Test results](../TEST_RESULTS.md), [Role viability](../ROLE_VIABILITY.md), [Roadmap](../ROADMAP.md), [Demo video](../../demo/benefits-intake-qa-demo.mp4)
- **Companion docs:** [TECHNICAL_WRITEUP.md](TECHNICAL_WRITEUP.md), [BUILD_STORY.md](BUILD_STORY.md)

## What it does
Benefits Intake QA turns a benefits plan document into structured fields, links each field to an exact source quote and PDF page, lets a reviewer accept or edit each value and download reviewed JSON, and gives an implementation reviewer a checklist of what to fix before loading.

1. **Intake:** drop or upload a text-based PDF, a .txt file, or pasted text. pdf.js runs in the browser, served from the Worker itself.
2. **Extract:** deterministic rules find **18 plan fields**. Every populated field carries a verbatim quote, page number, character offsets and a `verified` flag. Missing fields stay `null`. Contradictions keep every quote and page.
3. **Optional second opinion:** an OpenAI model (`gpt-5.4-nano-2026-03-17`) can propose values for gaps. It never overwrites a rule value and is kept only if its value is found verbatim, with a page, in the source.
4. **Check:** **11 QA checks** (missing fields, conflicts, family < individual, OOP < deductible, HSA/plan-type consistency, percentage plausibility, dates, low confidence).
5. **Decide:** one disposition per document: **ready**, **needs review**, or **blocked**.
6. **Review:** the reviewer accepts or edits each field, the checks re-run on the reviewed values, and **Download reviewed JSON** exports values, review status and provenance.

## The problem it tests
**Question:** in benefits-plan intake, can document extraction plus contradiction flagging de-risk a forward-deployed implementation workflow?

Before a benefits platform can run a client's benefits, someone has to turn carrier summaries, SBC excerpts, broker emails and rate-sheet notes into correct configuration (PRD §1). The pain points the tool targets are **my hypotheses, not a verified Euphoric problem** (PRD §2–§3):

| Hypothesis | Status |
|---|---|
| Intake of plan data from PDFs and semi-structured documents is slow and error-prone | Hypothesis, not verified |
| Review time concentrates on a few error types: missing fields, conflicting values across pages, swapped individual/family figures, implausible values | Hypothesis |
| Reviewers trust extracted values more when each value links to its source line | Hypothesis |
| A US-style plan schema is a good first schema | Scope assumption, likely wrong for many of a London-based, global company's clients |

No customer interviews have been done. The PRD §10 validation plan (5–8 analyst/broker interviews, 30–50 held-out documents, a shadow test) includes a kill criterion: stop if fewer than half report intake QA as a top-3 pain.

## Why it matters for a Forward-Deployed AI Product Associate
The role sits between document extraction and client rollout. The published job post ([link](https://jobs.ashbyhq.com/euphoric/183a3d36-f4b8-49da-91e2-c17a621ad287), 2026-08-13, London) names "document analysis, extraction, and data input", "AI evaluation frameworks", and "owning the end-to-end implementation of our platform for enterprise clients, from onboarding through to live deployment". This prototype sits on the handoff between those two:

- **Extraction side:** field-level extraction with verifiable provenance, so an AI or rules value can be traced before anyone trusts it.
- **Rollout side:** a go-live-style disposition (ready / needs review / blocked) and a reviewed-JSON artifact an implementation lead could triage from.
- **Evaluation discipline:** a golden-set eval with thresholds that fail the build (`npm run eval`), and AI kept on a short leash (grounded, never overwriting, budget-capped).

See [ROLE_VIABILITY.md](../ROLE_VIABILITY.md) for the full mapping, including what the project does **not** show (customer discovery, stakeholder alignment, live analytics, real-document accuracy).

## Status (what is real today)
**Rules engine primary, optional OpenAI second opinion live.** The deterministic rules always run; the reviewer can opt in to the OpenAI second opinion per analysis.

| Item | Status | Source |
|---|---|---|
| Live demo running `main` at `7a812fd` (PR #3 merged 2026-09-27 22:47 UTC) | Deployed. Checked 2026-09-28: `/api/health` returns `{"ok":true,"ai_provider":"openai","ai_configured":true}` and the served `index.html`, `app.js`, `style.css`, `pdf-text.js` are byte-identical (SHA-256) to `main` | Live endpoint; `src/worker.ts` |
| OpenAI second opinion | **Live** and configured; opt-in via the "Add OpenAI second opinion" checkbox. Ayo reports one supervised paid spot-check on 2026-09-28 (3 requests, ~600 tokens, per the OpenAI usage page); that spend record is not in the repo | Live UI; Ayo |
| Lifetime AI spend cap | $1.80 in code, fail-closed | `src/budget/ledger.ts` |
| Tests (local, PR #3) | Typecheck pass; 56/56 unit tests; eval thresholds met on 6 synthetic cases | [TEST_RESULTS.md](../TEST_RESULTS.md) |
| Real-world accuracy | **Unmeasured.** The rules were written against the 6 synthetic golden cases, so perfect scores are a regression check only | TEST_RESULTS, PRD §9 |
| Accessibility | Open axe-core issues (T11 fail) | TEST_RESULTS T11, ROADMAP |

> Note: README.md, PRD.md, TEST_RESULTS.md and ROADMAP.md were written before the post-PR #3 deploy, so their production-status notes are out of date. The table above reflects the live state as checked on 2026-09-28. No AI evaluation on held-out data exists yet (ROADMAP gate 4).

## Out of scope
OCR for scanned PDFs, table recovery, non-medical and non-US schemas, persistence/auth/audit trail, writing to any benefits administration system, real client or PII data, and legal or compliance determinations (ACA, IRS HDHP, waiting-period limits).
