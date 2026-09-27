# PRD: Benefits Intake QA

**Author:** Ayo Ahmed. **Status:** Prototype v0.1. **Last updated:** 2026-09-27

> **Independent prototype by Ayo Ahmed, not affiliated with Euphoric.** Ayo built this as a portfolio concept prepared for Euphoric. It is not Euphoric's product, Euphoric has not endorsed it, and it is not a client implementation. The UI shows Euphoric's logo and screenshots from euphoric.global, credited to Euphoric, only to identify which company the concept was made for (see `public/brand/ATTRIBUTION.md`). All plan documents, employers, carriers, and figures are synthetic.

## 1. Problem summary

Before a benefits platform can run a client's benefits, someone has to turn plan documents into structured, correct configuration. These documents include carrier summaries, SBC excerpts, broker emails, and rate-sheet notes. Benefits Intake QA is a thin tool for this step:

1. Extract plan facts from a document.
2. Give every fact a traceable source line.
3. Run plausibility and consistency checks.
4. Give the reviewer a short checklist with a disposition: **ready**, **needs review**, or **blocked**.

## 2. Evidence and assumptions

| Claim | Type | Source |
|---|---|---|
| Euphoric builds AI-first employee benefits administration software for large employers | **Evidence (published)** | [Euphoric job post](https://jobs.ashbyhq.com/euphoric/183a3d36-f4b8-49da-91e2-c17a621ad287) |
| The role covers "document analysis, extraction, and data input", which it calls "foundational work for our platform's AI learning" | **Evidence (published)** | Same job post |
| The role covers "AI evaluation frameworks", prompt engineering, and product analytics on live data | **Evidence (published)** | Same job post |
| The role owns "end-to-end implementation of our platform for enterprise clients, from onboarding through to live deployment" | **Evidence (published)** | Same job post |
| Intake of plan data from PDFs and semi-structured documents is slow and error-prone for implementation teams, and errors surface late | **Hypothesis. Not verified.** | Inferred from the role description and general industry knowledge. I have no access to Euphoric's internal workflows, data, or customers. |
| A lot of review time goes to a small set of recurring error types: missing fields, conflicting values across pages, swapped individual/family figures, and implausible values | **Hypothesis** | Needs validation (§10) |
| Reviewers trust extracted values more when each value links to its source line | **Hypothesis** | Needs validation (§10) |
| US-style plan fields (deductible, out-of-pocket max, HDHP/HSA) make a good first schema | **Assumption (scope choice)** | Euphoric serves global employers from London. A real build would use per-country schemas. |

Nothing in this PRD describes Euphoric's actual product, roadmap, or customers.

## 3. Target users

- **Primary: benefits implementation analyst/reviewer.** Loads a new or renewing client's plans into the platform during onboarding. Works through a queue of client documents, often from brokers and carriers in inconsistent formats.
- **Secondary: implementation lead / forward-deployed PM.** Owns go-live for a client. Needs to know which plans are blocked and why, and needs to see error patterns to improve the AI pipeline.

### Their job
Turn each document into a correct plan record, find anything missing or contradictory, get it resolved with the client or broker, and sign it off before go-live.

### Their pain (hypothesised)
- Re-keying values from PDFs and emails. Formats differ by carrier and broker.
- Contradictions hidden across pages. One example is a rate sheet that disagrees with the summary.
- Plausibility errors caught late, after load or even after enrolment. Examples: family deductible lower than individual, or an HDHP below the IRS minimum.
- AI-extracted values with no provenance, so the reviewer has to re-read the whole document to trust them.

## 4. Why this wedge matters
- **Close to the role.** It covers the four published themes: document analysis, extraction/data input, AI evaluation, and client implementation.
- **Errors are expensive downstream.** A wrong plan value can flow into employee-facing costs and payroll deductions. Catching it at intake is the cheapest fix (this is an assumption).
- **Evaluation-friendly.** Fields are discrete and checkable, so quality can be measured against a golden set. This is the basis for improving AI extraction over time.
- **Human-in-the-loop by design.** The tool supports the reviewer's decision instead of replacing it, which fits a regulated, high-trust domain.

## 5. Workflow
1. The analyst drops or uploads a text-based PDF (or a .txt file, or pasted text). pdf.js is served from our own Cloudflare Worker, not a third-party CDN. It extracts text in the browser and groups it into visual lines by y-coordinate. Only the text is sent to the API. A PDF with almost no extractable text is rejected as "scanned, OCR out of scope".
2. **Deterministic extraction** runs over the text. Label-driven patterns produce 18 fields, and each field records its source line(s) and a heuristic confidence.
3. **Optional AI second opinion** (Cloudflare Workers AI) proposes values. The AI never overwrites a rule value:
   - It may fill a field the rules missed. The value is marked "AI, no evidence".
   - Where it disagrees with a rule value, the disagreement becomes a warning.
4. **QA checks** run: missing required fields, conflicting values, family < individual, OOP < deductible, reference limits (ACA OOP, HDHP minimum, 90-day waiting period), HSA without HDHP, inverted coinsurance, and date order.
5. The **reviewer checklist** lists each finding with severity, a message, and a recommended action. It ends with a disposition:
   - **blocked** if there is any error.
   - **needs review** if there is any warning.
   - **ready** otherwise.
6. The reviewer clicks a finding or field to highlight its evidence in the source, then resolves it with the client.

## 6. Scope
**In scope (v0.1)**
- Single-document analysis of text-based PDFs, .txt files, or pasted text. Four synthetic sample PDFs are included in `public/samples/`.
- A fixed 18-field medical plan schema.
- Line-level evidence and conflict detection.
- 14 rule-based QA checks with configurable reference limits.
- An optional Workers AI second opinion that degrades safely.
- A golden-set evaluation harness (`npm run eval`).
- Hosting on a Cloudflare Worker with static assets.

**Out of scope**
- Scanned or image-only PDFs (OCR), and table-structure recovery.
- Dental, vision, life, disability, and non-US schemas.
- Persistence, auth, multi-user queues, and an audit trail.
- Writing to any benefits administration system.
- Real client or PII data. No real documents should be uploaded.
- Legal or compliance determinations. Reference limits are illustrative only.

## 7. User stories
1. As an analyst, I can paste or upload a plan document and see structured fields within a few seconds.
2. As an analyst, I can click any extracted value and see the exact source line it came from.
3. As an analyst, I am told when the document states the same field with different values, and the tool does not silently pick one.
4. As an analyst, I get a prioritised checklist with a recommended action for each issue.
5. As an implementation lead, I can see a single disposition per document to triage go-live blockers.
6. As an AI product owner, I can run a golden-set evaluation and see precision and recall before shipping any extraction change.
7. As an analyst, if the AI is unavailable, I still get the full rules-based result.

## 8. Acceptance criteria
- AC1: With the clean sample, all 18 fields are extracted, there are zero findings, and the disposition is `ready`.
- AC2: Every non-AI extracted value has at least one evidence line. Clicking it highlights that line.
- AC3: A field found with two different values yields `CONFLICTING_VALUES` (error) and lists both values.
- AC4: The messy HDHP sample yields `FAMILY_OOP_LT_INDIVIDUAL` and `HDHP_DEDUCTIBLE_BELOW_MIN`, and the disposition is `blocked`.
- AC5: AI-supplied values never overwrite rule values. They show `source: ai`, and disagreements appear as `AI_DISAGREES`.
- AC6: If the AI call throws, the response is still 200 with `mode: rules` and an `ai_note`.
- AC7: `npm run eval` exits non-zero if any threshold in §9 is breached.
- AC8: The UI shows the independence disclaimer ("Independent prototype by Ayo Ahmed, not affiliated with Euphoric") and Euphoric asset attribution on every page load.
- AC9: Each sample PDF, run through the PDF → text → analysis path, yields the same disposition and findings as its text version (`test/pdf.test.ts`).

## 9. Quality and evaluation metrics
| Metric | Definition | v0.1 threshold |
|---|---|---|
| Field precision | correct / (correct + wrong + spurious) over golden fields | ≥ 0.95 |
| Field recall | correct / (correct + wrong + missed) | ≥ 0.90 |
| Finding recall | expected finding codes raised / expected | 1.00 |
| Finding precision | reported for monitoring | — |
| Disposition accuracy | matches the golden disposition | 1.00 |
| Evidence coverage | share of non-null rule values that have ≥1 evidence line | 100% (by construction) |
| Latency | server-side `meta.ms` in rules mode | < 50 ms typical |

**Caveat:** the current golden set has 6 synthetic cases, and the rules were developed against it. It works as a regression suite. It does not estimate real-world accuracy.

**Production metrics to add:**
- Reviewer override rate per field.
- Time-to-disposition per document.
- The share of errors that reach enrolment and were missed at intake.
- AI-vs-rules agreement rate.

## 10. Proposed validation plan
1. **Problem interviews.** Talk to 5–8 implementation analysts or brokers. Goal: confirm or refute the §2 hypotheses on time spent, error types, and trust in AI. Kill criterion: fewer than half report intake QA as a top-3 pain.
2. **Document sample.** Collect 30–50 anonymised or synthetic-but-realistic documents across carriers. Label them to build a held-out golden set that the rule author does not see.
3. **Shadow test.** Analysts run their normal process and the tool in parallel. Measure errors caught by the tool that the process missed, false alarms, and time saved.
4. **AI evaluation.** Compare rules-only, AI-only, and rules+AI on the held-out set. Decide whether the AI's role grows from second opinion to primary extractor for some fields.
5. **Decision gate.** Continue only if field recall is ≥ 0.9 on held-out data and analysts report a net time saving.

## 11. Risks
| Risk | Mitigation |
|---|---|
| The rules overfit the synthetic golden set | Use a held-out set (§10.2) and track real override rates |
| An AI hallucination gets loaded as fact | AI never overwrites. AI-only values are labelled and generate a finding |
| Reference limits change yearly or vary by jurisdiction | Keep limits in config (`REFERENCE_LIMITS`), versioned by plan year |
| Real PII gets uploaded to a demo | Show a disclaimer, persist nothing, and ship synthetic samples only |
| PDF text order is lost (columns, tables) | Group PDF text into lines by y-coordinate. Out of scope: table recovery and OCR |
| Readers mistake this for Euphoric's product, or the use of Euphoric's logo and screenshots is objected to | Keep the non-affiliation disclaimer and © Euphoric attribution in the UI, README, PRD and `public/brand/ATTRIBUTION.md`. Assets are isolated in `public/brand/` and can be removed quickly if Euphoric asks |

## 12. Next steps
- Build a held-out golden set and add per-field metrics to the eval output.
- Add a reviewer "accept / override" action and log overrides as evaluation signal.
- Add a table-aware PDF parser and a multi-plan-per-document mode.
- Make the schema per country, starting with a UK schema, since Euphoric is London-based.
