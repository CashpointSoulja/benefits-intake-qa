# Roadmap: Benefits Intake QA v2 (gated)

**Author:** Ayo Ahmed. **Date:** September 27, 2026.

> Independent prototype by Ayo Ahmed, not affiliated with Euphoric. **These are gates, not promises.** Each stage starts only if the previous gate's evidence is met. Any stage can end the project (kill criteria). No dates are committed.

## Now (v0.1, shipped)
- A deployed Cloudflare Worker with text-PDF intake, 18 fields, verbatim page provenance, 11 QA checks, and reviewer accept/edit with reviewed JSON export.
- Tests, eval and a production browser test: see [TEST_RESULTS.md](TEST_RESULTS.md).

## Known issues to fix before v2 work
| Issue | Evidence | Fix, subject to verification |
|---|---|---|
| The configured Workers AI model (`@cf/meta/llama-3.1-8b-instruct`, served as `infire-llama-3.1-8b-instruct`, deprecated 2026-05-30) always fails, so production falls back to rules only | TEST_RESULTS T10 | Replacement with OpenAI behind a lifetime budget gate is in PR #3 (not deployed). Before calling it fixed: merge, set `OPENAI_API_KEY`, `wrangler deploy`, then a supervised production spot-check within the $1.80 cap |
| Accessibility: serious axe violations for colour contrast (orange step labels, source line numbers) and a scrollable `#source` region that can't take keyboard focus; moderate: content outside landmarks | TEST_RESULTS T11 | Darken the accent text, make `#source` focusable (`tabindex=0` plus a label), wrap the content in landmarks; re-run axe before deploying |

## Stages and gates
| # | Stage | Why this order | Entry gate | Exit gate / kill criterion |
|---|---|---|---|---|
| 1 | **OCR for scanned PDFs**: page-level OCR with word boxes, keeping the same `{page, quote, start, end, verified}` contract, and a flag on OCR-derived quotes | Scanned documents are rejected today; this is the most visible functional gap | v0.1 stable | ≥ 95% of OCR'd quotes re-locate on their page on a synthetic scanned set; the provenance invariant still holds. Kill: OCR noise makes verification unreliable |
| 2 | **Held-out, consented real-document validation**: 30–50 documents with written consent, anonymised, labelled by someone other than the rule author, and never used for tuning | Six synthetic cases cannot establish real-world accuracy | Consent and data-handling process approved; no PII in the repo | Field recall ≥ 0.90 and precision ≥ 0.95 on the held-out set. Kill: recall < 0.75 after one iteration |
| 3 | **Per-country schema**: a schema per jurisdiction (starting with the UK), with normative limits as versioned configuration keyed by jurisdiction and plan year | The current US-style schema is an assumption; normative checks were removed because no jurisdiction or plan year is captured | Gate 2 met; the schema is reviewed by a domain expert | Held-out metrics hold per country. Kill: schemas diverge enough that a shared engine does not pay off |
| 4 | **Real AI evaluation**: rules-only vs AI-only vs rules+AI on the held-out set, grounding rate, unsupported-suggestion rate, cost and latency | AI is unit-tested only; the production model is deprecated | Gate 2 set exists; a current model is configured | AI measurably improves recall without lowering precision or evidence coverage. Kill: no gain, so keep rules-only |
| 5 | **Privacy, audit and analytics**: auth, retention limits, an audit trail of reviewer actions, and product analytics (override rate per field, time-to-disposition, AI agreement) | Needed before any real-user pilot | Gates 2–4 met | A privacy review passes; analytics can answer the PRD §9 production metrics |

## Continuous (every stage)
- Keep the independence disclaimer and attribution.
- Never commit real documents.
- Keep `npm run typecheck && npm test && npm run eval` green.
- Run a fresh production browser test before each deploy.
