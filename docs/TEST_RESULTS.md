# Test Results: Benefits Intake QA v0.1

**Author:** Ayo Ahmed. **Date:** September 27, 2026. **Plan:** [TEST_PLAN.md](TEST_PLAN.md)

> Independent prototype by Ayo Ahmed, not affiliated with Euphoric. Synthetic data only.

## Summary
| Level | Result |
|---|---|
| L1 Typecheck | **Pass** (0 errors) |
| L2 Unit/integration | **Pass**: 25/25 tests |
| L3 Golden-set eval | **Pass**: all thresholds met (6/6 synthetic cases) |
| L4 Production browser | **11 of 12 pass.** T11 accessibility **fails** on axe-core findings. T10 passes as a fallback only: the production AI model is deprecated |
| L5 Demo video | **Done**: [demo/benefits-intake-qa-demo.mp4](../demo/benefits-intake-qa-demo.mp4), 81 s, production only; frames inspected (`demo/frames/contact-*.jpg`) |

**Limitation:** the rules were written against the six synthetic golden cases, so the perfect eval scores are a regression check. They do **not** measure real-world accuracy (see ROADMAP gate G2).

## Environment
- **Code:** `main` at merge commit `97fdd9a` (application code as of `43fb980`).
- **Production:** https://benefits-intake-qa.ayomideahmedcp.workers.dev/, deployed by Ayo from the Cloudflare dashboard.
- **Deployed build check:** these production assets are byte-identical (SHA-256) to `97fdd9a`:
  - `app.js`: `de946ef3342e8ec1…`
  - `vendor/pdfjs/pdf.min.mjs` (legacy build): `246b088f41435963…`
  - `index.html`: `16de15b71112ab6f…`

  This proves the served content, not Cloudflare's deployment metadata.
- **L1–L3:** Node v24.19.0, Wrangler 4.142.0, Linux. Run 2026-09-27 ~21:25 UTC.
- **L4–L5:** Google Chrome for Testing 137.0.7118.2 on Linux. Run 2026-09-27 21:23–21:33 UTC; final health check at 21:32:54Z.

## L1–L3 output
```
$ npm run typecheck   → TYPECHECK_OK
$ npm test            → Test Files 3 passed; Tests 25 passed (25)
$ npm run eval
ok   clean-ppo / messy-hdhp / conflicting-values / sparse-email / inline-slash-format / inverted-coinsurance-and-bad-dates
Field extraction: correct=76 wrong=0 missed=0 spurious=0 correct-null=24 → precision=1.000 recall=1.000
QA findings: recall=1.000 precision=1.000
Disposition accuracy: 1.000 (6/6)
All thresholds met.
```

## L4 Production browser results
| ID | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| T1 | Logo, screenshots, © Euphoric attribution and the independence disclaimer are visible | All render | Pass | [T1-brand](evidence/T1-brand.jpg) |
| T2 | Clean PPO: Ready, 1 page, 18 fields, page/line and exact quote on every field; click highlights the source | As expected | Pass | [T2-clean-ppo](evidence/T2-clean-ppo.jpg), [T2-highlight](evidence/T2-highlight.jpg) |
| T3 | Messy HDHP: Blocked, `FAMILY_OOP_LT_INDIVIDUAL` only | As expected; no removed limit codes | Pass | [T3](evidence/T3-messy-hdhp.jpg) |
| T4 | Conflicting: Blocked, 2 pages, p.1 "$500" vs p.2 "$750", each with "Use this" | As expected (the family deductible and ER copay also show both pages) | Pass | [T4](evidence/T4-conflict-quotes.jpg) |
| T5 | Sparse email: Blocked, `MISSING_REQUIRED` | As expected | Pass | [T5](evidence/T5-sparse.jpg) |
| T6 | Review controls update state; recheck moves "After review" to Ready | Ready at 18/18. Undo → 17/18; re-accept → 18/18. A reviewer-entered contribution of 75 is labelled "no source quote" | Pass | [T6-ready](evidence/T6-review-ready.jpg), [T6-value](evidence/T6-reviewer-value.jpg) |
| T7 | JSON `reviewed-plan@1`; `in_progress` → `complete`; pages 2; chosen p.2 quote; nulls kept | `fields_reviewed: 18`; individual deductible 750 with its p.2 quote; contribution 75 with null page/quote; HSA null | Pass | [in-progress JSON](evidence/T7-reviewed-in-progress.json), [complete JSON](evidence/T7-reviewed-complete.json), [screenshot](evidence/T7-json.jpg) |
| T8 | Scanned PDF rejected; previous results cleared | "No text layer… OCR is out of scope" error; empty state | Pass | [T8](evidence/T8-scan-rejected.jpg) |
| T9 | Editing the textarea clears stale results and the download | As expected | Pass | [T9](evidence/T9-stale-cleared.jpg) |
| T10 | AI either runs grounded or falls back with `ai_note`, without errors | `ai_binding: true`, but every call falls back: "AI unavailable, rules only (5028: @cf/meta/infire-llama-3.1-8b-instruct was deprecated on 2026-05-30…)". No errors | **Pass (fallback only)** | [T10](evidence/T10-ai-fallback.jpg) |
| T11 | Keyboard reachable, visible focus, names, alt text, `lang`, no serious axe issues | Focus, names, alt text and `lang="en"` pass. axe-core 4.10.3 found **serious** `color-contrast` (18 nodes: orange step labels 2.85:1, source line numbers 4.46:1), **serious** `scrollable-region-focusable` (`#source`), and **moderate** `region` (`.context` outside landmarks). 22 contrast nodes need manual review | **Fail** | [T11](evidence/T11-a11y.jpg), [axe JSON](evidence/T11-axe.json) |
| T12 | No console errors; `/api/health` returns 200 | `200 {"ok":true,"ai_binding":true}`; no application console errors | Pass | [T12](evidence/T12-health.jpg) |

## Gaps and not tested
- **Successful AI extraction and grounding in production:** not testable while the model is deprecated. AI grounding is covered by unit tests only.
- **Accessibility:** the T11 violations are open (ROADMAP "Known issues"). No screen-reader testing has been done.
- **Browsers:** only Chrome 137 was tested; no Firefox, Safari or mobile.
- **Real-world accuracy:** unmeasured. There are no real or held-out documents.
- **Load/performance:** only the server-side `meta.ms` was observed (4–6 ms in rules mode via API). No load test.
- **Deployment metadata:** content hashes match `main`, but the Cloudflare deployment ID was not checked.
