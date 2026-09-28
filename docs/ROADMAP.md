# Roadmap: Benefits Intake QA v2 (gated)

**Author:** Ayo Ahmed. **Date:** September 27, 2026; current state updated September 28, 2026.

> Independent prototype by Ayo Ahmed, not affiliated with Euphoric. **These are gates, not promises.** Each stage starts only if the previous gate's evidence is met. Any stage can end the project (kill criteria). No dates are committed.

## Now (v0.1, shipped)
- A deployed Cloudflare Worker with text-PDF intake, 18 fields, verbatim page provenance, 11 QA checks, and reviewer accept/edit with reviewed JSON export.
- Optional OpenAI second opinion (`gpt-5.4-nano-2026-03-17`) behind the app's $1.80 lifetime `BudgetGate`, deployed and configured. Only a three-call synthetic spot-check has run in production (September 28, 2026).
- Tests (56/56), synthetic eval, the historical September 27 production browser test and the September 28 current-state check: see [TEST_RESULTS.md](TEST_RESULTS.md).

## Known issues to fix before v2 work
| Issue | Evidence | Fix, subject to verification |
|---|---|---|
| **Resolved September 28, 2026.** The retired Workers AI model (historical T10 fallback) was replaced by OpenAI (PR #3), now deployed with `OPENAI_API_KEY` set. A supervised spot-check ran three synthetic calls (OpenAI dashboard: 3 requests, 600 input tokens, $0.00 at cent precision). Remaining: no AI evaluation (stage 4) and no per-visitor rate limit | TEST_RESULTS current section | Keep AI optional; add a per-visitor rate limit. The $1.80 is the app's own lifetime gate, not an OpenAI billing limit |
| Accessibility: serious axe violations for colour contrast (orange step labels, source line numbers) and a scrollable `#source` region that can't take keyboard focus; moderate: content outside landmarks | TEST_RESULTS T11 | Darken the accent text, make `#source` focusable (`tabindex=0` plus a label), wrap the content in landmarks; re-run axe before deploying |

## Stages and gates
| # | Stage | Why this order | Entry gate | Exit gate / kill criterion |
|---|---|---|---|---|
| 1 | **OCR for scanned PDFs**: page-level OCR with word boxes, keeping the same `{page, quote, start, end, verified}` contract, and a flag on OCR-derived quotes | Scanned documents are rejected today; this is the most visible functional gap | v0.1 stable | ≥ 95% of OCR'd quotes re-locate on their page on a synthetic scanned set; the provenance invariant still holds. Kill: OCR noise makes verification unreliable |
| 2 | **Held-out, consented real-document validation**: 30–50 documents with written consent, anonymised, labelled by someone other than the rule author, and never used for tuning | Six synthetic cases cannot establish real-world accuracy | Consent and data-handling process approved; no PII in the repo | Field recall ≥ 0.90 and precision ≥ 0.95 on the held-out set. Kill: recall < 0.75 after one iteration |
| 3 | **Per-country schema**: a schema per jurisdiction (starting with the UK), with normative limits as versioned configuration keyed by jurisdiction and plan year | The current US-style schema is an assumption; normative checks were removed because no jurisdiction or plan year is captured | Gate 2 met; the schema is reviewed by a domain expert | Held-out metrics hold per country. Kill: schemas diverge enough that a shared engine does not pay off |
| 4 | **Real AI evaluation**: rules-only vs AI-only vs rules+AI on the held-out set, grounding rate, unsupported-suggestion rate, cost and latency | AI has unit tests and a three-call synthetic spot-check only; no measured accuracy | Gate 2 set exists (a current model is already configured) | AI measurably improves recall without lowering precision or evidence coverage. Kill: no gain, so keep rules-only |
| 5 | **Privacy, audit and analytics**: auth, retention limits, an audit trail of reviewer actions, and product analytics (override rate per field, time-to-disposition, AI agreement) | Needed before any real-user pilot | Gates 2–4 met | A privacy review passes; analytics can answer the PRD §9 production metrics |

## Continuous (every stage)
- Keep the independence disclaimer and attribution.
- Never commit real documents.
- Keep `npm run typecheck && npm test && npm run eval` green.
- Run a fresh production browser test before each deploy.
