# Benefits Intake QA

A small tool that turns a benefits plan document into structured fields, links each field to an exact source quote and PDF page, lets a reviewer accept or edit each value and download reviewed JSON, and gives an implementation reviewer a checklist of what to fix before loading.

> **Independent prototype by Ayo Ahmed, not affiliated with Euphoric.** This is a concept prepared for Euphoric. It is not Euphoric's product, and Euphoric has not endorsed it. The UI shows Euphoric's logo and screenshots from https://www.euphoric.global/, which are © Euphoric; see `public/brand/ATTRIBUTION.md`. All plan data is synthetic.

- **Live demo:** https://benefits-intake-qa.ayomideahmedcp.workers.dev/
- **Product requirements:** [docs/PRD.md](docs/PRD.md)
- **PM evidence package:**
  - [Test plan](docs/TEST_PLAN.md)
  - [Test results](docs/TEST_RESULTS.md)
  - [Role viability](docs/ROLE_VIABILITY.md) (demonstrated work vs. hypothetical customer need)
  - [Roadmap](docs/ROADMAP.md) (gated v2)
  - **Featured:** [vertical launch demo](demo/benefits-intake-qa-launch-vertical.mp4) (silent, 1080×1920, 96 s, Remotion, real production footage) · [first-person timed voiceover](demo/VOICEOVER.md) · [matching SRT](demo/VOICEOVER.srt)
  - [Original landscape launch cut](demo/benefits-intake-qa-launch-demo.mp4) (84 s; archive AI shown only as a labelled clip)
  - [Rules-only production walkthrough, Sept 28](demo/benefits-intake-qa-walkthrough.mp4) (raw source footage, shows the corrected docs) and [original production demo, Sept 27](demo/benefits-intake-qa-demo.mp4) (81 s)
- **Stack:** a Cloudflare Worker (TypeScript API) serves the static frontend from `public/`. An optional, server-side OpenAI second opinion (`gpt-5.4-nano-2026-03-17`) sits behind a lifetime budget gate in a SQLite Durable Object (`BudgetGate`).

**Production status (September 28, 2026):** the live demo runs `main` with the OpenAI second opinion deployed and configured. It is off unless the visitor ticks the box; rules always run. The paid API has had only a three-call synthetic spot-check (see [TEST_RESULTS.md](docs/TEST_RESULTS.md)); AI accuracy has not been evaluated. The earlier Workers AI model was retired on 2026-05-30, so production was rules-only until this deploy.

## What it does
1. You drop or upload a text-based PDF, or paste text. pdf.js is served from the Worker's own assets (`public/vendor/pdfjs`) and extracts the text in the browser. Sample PDFs are in `public/samples/`.
2. Deterministic extraction finds 18 plan fields. Each populated field records a verbatim quote, a page number, character offsets, and a `verified` flag. Missing fields are `null`. Contradictions keep every quote and page.
3. When OpenAI is configured and the budget gate allows it, an OpenAI model gives a second opinion (optional; see production status above). It never overwrites a rule-extracted value. It fills a gap only when its value is located verbatim, with a page, in the source; otherwise the suggestion is reported as a finding and the field stays `null`.
4. 11 QA checks run, covering missing fields, conflicts, family < individual, OOP < deductible, HSA/plan-type consistency, percentage plausibility, and dates. No jurisdiction- or plan-year-specific limits (ACA, HDHP, waiting period) are applied.
5. The tool returns a disposition: **ready**, **needs review**, or **blocked**.
6. The reviewer accepts or edits fields. The checks re-run on the reviewed values, and **Download reviewed JSON** exports values, review status, and provenance.

## Run locally
```bash
npm ci
npm run dev        # wrangler dev → http://localhost:8787
npm test           # unit tests (vitest)
npm run typecheck
npm run eval       # golden-set evaluation; exits 1 below thresholds
npm run samples:pdf  # regenerate public/samples/*.pdf (needs Chrome; CHROME=/path)
```

## API
- `GET /api/health`
- `GET /api/samples`
- `POST /api/analyze` with body `{ "pages": string[] }` (one string per PDF page) or `{ "text": string }` (`\f` separates pages), plus optional `"use_ai": boolean`. It returns `{ extraction: { fields, pages, lines }, findings, summary, meta }`. Each field has `evidence: [{ page, page_line, quote, start, end, snippet, value, verified }]`.
- `POST /api/recheck` with body `{ "fields": { <key>: { value, review_status, confidence, conflicts? } } }` returns `{ findings, summary }` for reviewer-confirmed values.

## Deploy (Cloudflare)
- **CLI:** `npx wrangler deploy`
- **Dashboard (Workers → Create → Import a repository):**
  - Build command: *(none)*
  - Deploy command: `npx wrangler deploy`
  - Root directory: `/`
- Static assets are served from `public/`. The `BudgetGate` Durable Object (binding `BUDGET_GATE`, SQLite migration `v1`) is declared in `wrangler.jsonc`; the first deploy that adds it must use `wrangler deploy`.

## OpenAI second opinion and budget gate
- **Configuration:** only the secret `OPENAI_API_KEY` is required (`npx wrangler secret put OPENAI_API_KEY`). Without it, or without the budget gate, the app runs rules only.
- **Model and prices are pinned in code** (`src/ai/openai.ts`): only `gpt-5.4-nano-2026-03-17` is accepted, priced at $0.22 input / $1.375 output per million tokens (OpenAI's $0.20 / $1.25 plus the 10% regional uplift on the [model page](https://platform.openai.com/docs/models/gpt-5.4-nano)). Price variables may only raise these; anything cheaper or any other model disables AI.
- **Request shape:** one choice, `service_tier: "default"`, `reasoning_effort: "none"`, JSON output, `store: false`, max 800 output tokens. No tools, web search, audio or images.
- **Lifetime cap:** before every call, the worst-case cost is reserved atomically in `BudgetGate`. The cap is $1.80 in code; `AI_LIFETIME_BUDGET_USD` can only lower it, and a lowered value can't be raised later. The ledger survives deploys. It is separate from, and does not rely on, the OpenAI project's $2 monthly limit.
- **Worst-case input bound:** serialized request bytes + 64 tokens. Checked against OpenAI's `tiktoken` (`o200k_base`) counts in `test/tokenizer.test.ts`.
- **Fail closed:** unknown usage, HTTP or network errors keep the full reservation. A reported cost above the reservation, or an unexpected model or service tier, is recorded as an anomaly and halts all later AI calls until reviewed.
- **Previews:** `wrangler preview` gives each Preview its own empty `BudgetGate`, so the `previews` block sets `AI_DISABLED` and Previews are rules-only. Do not add `OPENAI_API_KEY` to the Previews base config.
- **Not built:** there is no per-visitor rate limit, so one visitor can use the whole lifetime budget.
