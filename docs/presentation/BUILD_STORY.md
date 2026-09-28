# Benefits Intake QA: build story

**Author:** Ayo Ahmed. **Date:** September 28, 2026.

> Independent prototype by Ayo Ahmed, not affiliated with or endorsed by Euphoric. Hypothesis-testing demo, not a deployed client product. All plan data is synthetic.

Everything below is reconstructed from the repository's git history (`git log --graph`), the GitHub PR metadata for PRs #1–#3, and the docs in `docs/`. All times are UTC on **Sunday, 27 September 2026** unless stated.

## How it was built
Ayo directed the build; the code, tests and docs were written with an AI coding agent (Devin) under his direction, with explicit acceptance gates and reviewer corrections before each merge (`docs/ROLE_VIABILITY.md` §2). Each PR was reviewed and merged by Ayo on GitHub. Nothing was committed directly to `main` outside the merge commits.

## Sprint timeline
The whole sprint, from the initial commit to the PR #3 merge, ran from **20:29 to 22:47 UTC** (about 2 h 18 min).

### PR #1: product and v0.1 app
https://github.com/CashpointSoulja/benefits-intake-qa/pull/1 · "Benefits Intake QA: PRD, Cloudflare Worker app, QA engine, eval" · opened 20:29:35, merged 20:58:37 (merge `97fdd9a`)

| Time | Commit | What landed |
|---|---|---|
| 20:29:03 | `0d6c32e` | Initial commit: README and `.gitignore` |
| 20:29:04 | `89015fa` | PRD, Cloudflare Worker app, QA engine, tests and golden-set eval |
| 20:33:40 | `2eb4fdd` | Euphoric-attributed brand assets, self-hosted pdf.js PDF intake, sample PDFs and PDF tests |
| 20:41:52 | `1e7a8e7` | Page-aware verbatim provenance, reviewer accept/edit with recheck, reviewed JSON download |
| 20:47:05 | `a967e1e` | AI values grounded in verified source quotes; normative ACA/HDHP/waiting-period checks dropped; pdf.js legacy build |
| 20:54:10 | `43fb980` | Stale results cleared on new input; reviewer-entered values without a source labelled |

The later commits in PR #1 are review corrections: provenance was tightened to page + offsets + `verified`, AI output was restricted to values that can be located in the source, and checks that would need a jurisdiction and plan year the tool does not capture were removed rather than guessed.

After the merge, Ayo deployed `main` from the Cloudflare dashboard. `docs/TEST_RESULTS.md` confirms the production assets were byte-identical (SHA-256) to `97fdd9a`.

### PR #2: PM evidence package
https://github.com/CashpointSoulja/benefits-intake-qa/pull/2 · "PM evidence package: test plan, production test results, role viability, gated roadmap, demo video" · opened 21:35:25, merged 21:48:05 (merge `da00e84`)

| Time | Commit | What landed |
|---|---|---|
| 21:35:04 | `8b11e56` | `docs/TEST_PLAN.md`, `docs/TEST_RESULTS.md`, `docs/ROLE_VIABILITY.md`, `docs/ROADMAP.md`, `demo/` video (81 s) and `docs/evidence/` |
| 21:47:35 | `09d53a9` | Ayo's own edit on GitHub: "Clarify AI binding status in README" |

The production browser run (21:23–21:33 UTC) passed 11 of 12 cases. It failed T11 accessibility (axe-core contrast and focus findings, still open in `docs/ROADMAP.md`) and passed T10 only as a fallback, which led to PR #3.

### PR #3: AI swap
https://github.com/CashpointSoulja/benefits-intake-qa/pull/3 · "Replace deprecated Workers AI with OpenAI behind a lifetime budget gate (SQLite Durable Object)" · opened 22:22:35, merged 22:47:18 (merge `7a812fd`, current `main`)

| Time | Commit | What landed |
|---|---|---|
| 22:22:04 | `aceb0b7` | Workers AI replaced with OpenAI behind a lifetime budget gate (SQLite Durable Object) |
| 22:29:34 | `08a3c60` | `gpt-5.4-nano` snapshot and prices pinned, lifetime cap set at $1.80, over-reservation costs never credited, concurrent Durable Object test |
| 22:40:33 | `73ce8f7` | Docs for the OpenAI replacement, tiktoken-checked input bound, `previews` block with AI disabled |

### After the sprint (28 September 2026)
- `main` (`7a812fd`) is deployed. On 2026-09-28 the live `/api/health` returns `{"ok":true,"ai_provider":"openai","ai_configured":true}`, the UI shows the "Add OpenAI second opinion" checkbox, and the served frontend files match `main` by SHA-256.
- Ayo reports one supervised paid spot-check (3 requests, ~600 tokens, per the OpenAI usage page). That spend record is not in the repo.
- `README.md`, `docs/PRD.md`, `docs/TEST_RESULTS.md` and `docs/ROADMAP.md` were written before this deploy, so their production-status notes are out of date; the live state is as described here.

## The AI swap story
**0. Now: rules engine primary, OpenAI second opinion live and optional.** The sections below explain how it got there.

**1. The original design.** v0.1 used a Cloudflare Workers AI binding (`"ai": { "binding": "AI" }` in `wrangler.jsonc` at `97fdd9a`) with model `@cf/meta/llama-3.1-8b-instruct` as an optional second opinion. The engine was built to degrade: if the binding is absent or the call fails, the result is rules-only.

**2. The discovery.** In the production browser test (TEST_RESULTS T10), `/api/health` reported `ai_binding: true`, yet every AI call fell back with: *"AI unavailable, rules only (5028: @cf/meta/infire-llama-3.1-8b-instruct was deprecated on 2026-05-30…)"*. The model had been retired on 2026-05-30. The fallback design worked as intended: no errors, full rules output. But the AI path was dead in production, and the docs said so (ROADMAP "Known issues", ROLE_VIABILITY §1).

**3. The replacement (PR #3).** Swapping in a paid API raised a new risk: a public demo with no auth and no per-visitor rate limit could spend money without bound. So the AI call was put behind a fail-closed budget gate instead of just replacing the model:
- **Pinned model and prices:** only `gpt-5.4-nano-2026-03-17`, at $0.22 / $1.375 per million input/output tokens. Prices can only be raised by config; any other model disables AI.
- **Reserve before every call:** the worst-case cost is reserved atomically in `BudgetGate`, a single SQLite Durable Object, before `fetch`. If the reservation is refused, no request is sent.
- **Lifetime cap $1.80**, under the owner's $2 total. It can be lowered, never raised, and survives deploys.
- **Fail closed:** unknown usage or errors keep the full reservation; an over-reservation cost or an unexpected model or service tier halts all later AI calls.
- **Provable input bound:** request bytes + 64 ≥ tokens, checked against `tiktoken` `o200k_base` on samples and adversarial inputs.
- **Previews forced rules-only**, because each Preview gets its own empty ledger.
- **Same grounding rules as before:** the AI never overwrites rules and nothing ungrounded is stored.

PR #3's local checks were 56/56 tests, a passing eval and a `wrangler deploy --dry-run` showing the `BUDGET_GATE` and `ASSETS` bindings. No OpenAI request was made before merge.

**4. Now.** The swap is merged and, per the 28 September check above, deployed and configured on the live demo. What is still missing: an AI evaluation on held-out data (ROADMAP gate 4), per-visitor rate limiting, and a re-run of the production browser suite against the new build.

## What I would point to in the room
- The gap between "tests pass" and "works in production" was found by testing production, not assumed away (T10).
- The deprecated model degraded to a correct rules-only result instead of an outage, because fallback was an acceptance criterion from the start (PRD AC6).
- The paid replacement was scoped by its worst case first ($1.80 lifetime, fail closed) before anything else.
