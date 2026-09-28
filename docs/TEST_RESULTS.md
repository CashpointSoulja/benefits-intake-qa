# Test Results: Benefits Intake QA v0.1

> **Two time points.** Sections L1–L5 are the **historical September 27, 2026 run** against the v0.1 build (`97fdd9a`), when production was rules-only because its Workers AI model was retired. They are kept as recorded. The section **"Current production (September 28, 2026)"** below describes what is live now: the OpenAI replacement from PR #3 is deployed and configured, with a small supervised AI spot-check. T11 accessibility still **fails**.

**Author:** Ayo Ahmed. **Date:** September 27, 2026 (historical run); updated September 28, 2026 (current state). **Plan:** [TEST_PLAN.md](TEST_PLAN.md)

> Independent prototype by Ayo Ahmed, not affiliated with Euphoric. Synthetic data only.

## Current production (September 28, 2026)
| Check | Result | Evidence |
|---|---|---|
| Code on `main` | `7e8ea47` (includes PR #3 OpenAI budget gate, PR #4/#5 logo) | `git log origin/main` |
| `npm run typecheck` | Pass (0 errors) | run 2026-09-28 ~10:00 UTC, Node v24.19.0 |
| `npm test` | Pass: 7 files, **56/56** tests | same run |
| `npm run eval` | Pass: all thresholds met on the **6 synthetic** golden cases (regression check only, not real-world accuracy) | same run |
| `/api/health` | `{"ok":true,"ai_provider":"openai","ai_configured":true}` | 2026-09-28 09:59 UTC |
| AI spot-check (T10, current) | **Pass, spot-check only.** On September 28, 2026 (BST) three supervised calls were made with synthetic text only; the OpenAI dashboard reports 3 requests, 600 input tokens and $0.00 at cent precision. One call (text `SYNTHETIC TEST ONLY. Carrier: Blue Harbor Health. Plan Type: PPO.`, recorded 2026-09-27 23:22 UTC = 00:22 BST Sept 28) is on video: `AI_FILLED_FIELD` filled Carrier = Blue Harbor Health with a p.1 quote. | OpenAI project dashboard, September 28, 2026; 9:16 AI screen recording kept outside the repo |
| Rules-only walkthrough | Clean PDF Ready; family-OOP PDF Blocked (`FAMILY_OOP_LT_INDIVIDUAL`); two-page conflict PDF Blocked, reviewer picks p.2, After review Ready, reviewed JSON exported. AI box left unticked | [video](../demo/benefits-intake-qa-walkthrough.mp4), [demo/walkthrough/](../demo/walkthrough/); produced cut: [launch demo](../demo/benefits-intake-qa-launch-demo.mp4) |
| T11 accessibility | **Still Fail** (no fix deployed; findings below unchanged) | [T11 axe JSON](evidence/T11-axe.json) |

The $1.80 cap is the app's own lifetime budget gate (`BudgetGate`), enforced in the Worker before any call; it is not an OpenAI billing limit. The OpenAI project's separate $2 monthly limit resets and can lag.

Three synthetic AI calls are a smoke test. They are not an AI evaluation and say nothing about AI accuracy on real documents; no held-out or real-document test has been run.

## Historical summary (September 27, 2026, rules-only production)
| Level | Result |
|---|---|
| L1 Typecheck | **Pass** (0 errors) |
| L2 Unit/integration | **Pass**: 25/25 tests (at `97fdd9a`; 56/56 today) |
| L3 Golden-set eval | **Pass**: all thresholds met (6/6 synthetic cases) |
| L4 Production browser | **11 of 12 pass.** T11 accessibility **fails** on axe-core findings. T10 passed as a fallback only: the Workers AI model then in production was deprecated (superseded, see current section) |
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
- **AI in production:** on September 27 not testable (deprecated model). As of September 28 only a three-call synthetic spot-check exists; there is no AI evaluation set, no rules vs AI comparison, and no real-document test.
- **Accessibility:** the T11 violations are open (ROADMAP "Known issues"). No screen-reader testing has been done.
- **Browsers:** only Chrome 137 was tested; no Firefox, Safari or mobile.
- **Real-world accuracy:** unmeasured. There are no real or held-out documents.
- **Load/performance:** only the server-side `meta.ms` was observed (4–6 ms in rules mode via API). No load test.
- **Deployment metadata:** content hashes match `main`, but the Cloudflare deployment ID was not checked.

## PR #3: OpenAI replacement, local checks only (historical, September 27, 2026)
**Scope:** branch `devin/1790547465-openai-budget-gate`. Run 2026-09-27 22:40 UTC, Node v24.19.0, Wrangler 4.142.0, Linux. **No OpenAI API key was used, no OpenAI request was made, and nothing was deployed.** At that time production still ran `97fdd9a` (rules-only); it has since been deployed (see current section).

| Command | Result |
|---|---|
| `npm run typecheck` | Pass (exit 0) |
| `npm test` | Pass: 7 files, 56/56 tests |
| `npm run eval` | Pass: all thresholds met (same 6 synthetic cases) |
| `npx wrangler deploy --dry-run --outdir /tmp/wdry` | Pass: bindings `BUDGET_GATE` (Durable Object) and `ASSETS`; no upload |
| `CI=true npx wrangler preview` | **Not run**: stops at "set a CLOUDFLARE_API_TOKEN" (this environment has no Cloudflare login) |

What the new tests cover (all with fake `fetch` / local storage):
- `test/openai.test.ts`: only the pinned model and prices are accepted; the request body has no tools, audio, web search or premium tier; the reservation happens before `fetch` and no `fetch` happens if it is refused; unknown usage, errors and an unexpected model or tier keep the full reservation; unsupported AI values stay `null`.
- `test/budget.test.ts` (sequential, Node SQLite): $1.80 app-side lifetime clamp, lower-only limit, settlement, over-reservation anomaly and halt, persistence across ledger instances.
- `test/budget-do.test.ts` (**concurrent**, real `BudgetGate` in local Miniflare/workerd with SQLite): 200 simultaneous reservations grant exactly the affordable number; $1.80 clamp; anomaly halt; spend persists across a restart; a lowered limit can't be raised.
- `test/tokenizer.test.ts`: the worst-case input bound (serialized request bytes + 64) is at least the token count measured by OpenAI's `tiktoken` 0.14.0 (`o200k_base`, which `tiktoken` maps to `gpt-5.4-nano`) plus chat overhead (3 per message + 3), for the four samples and eight 12,000-character adversarial inputs (digits/punctuation, random ASCII, CJK, emoji, combining marks, whitespace, JSON escapes). The tightest case is digits/punctuation: 12,171 tokens against 12,716 content bytes. The same script found that every ordinary `o200k_base` token is at least 1 byte, which is why bytes bound tokens.

Not tested:
- Any real OpenAI call, actual billed `usage`, or whether OpenAI adds hidden prompt tokens beyond the cookbook's formatting overhead. If a call ever reports more than was reserved, the ledger keeps the reservation and halts AI (tested with fakes only).
- At that time: the Durable Object migration on Cloudflare and any production behaviour of the OpenAI path (since then: deployed, and the three-call spot-check above).
- Per-visitor rate limiting (not built).
