# Benefits Intake QA

A small tool that turns a benefits plan document into structured fields, links each field to its source line, and gives an implementation reviewer a checklist of what to fix before loading.

> **Independent prototype by Ayo Ahmed.** It is not Euphoric's product. It is not endorsed by Euphoric and was not built for any Euphoric client. All sample data is synthetic. The visual style takes inspiration from Euphoric's public site, and no Euphoric logos or marks are used.

- **Product requirements:** [docs/PRD.md](docs/PRD.md)
- **Stack:** a Cloudflare Worker (TypeScript API) serves the static frontend from `public/`. An optional Cloudflare Workers AI binding provides an AI second opinion.

## What it does
1. You paste text or upload a PDF or .txt file. PDF text is extracted in the browser with pdf.js.
2. Deterministic extraction finds 18 plan fields and records the source line and a confidence for each.
3. Optionally, Workers AI gives a second opinion. It can fill gaps or flag disagreements, but it never overwrites a rule-extracted value.
4. 14 QA checks run, covering missing fields, conflicts, family < individual, OOP < deductible, HDHP/HSA consistency, reference limits, and dates.
5. The tool returns a disposition: **ready**, **needs review**, or **blocked**.

## Run locally
```bash
npm ci
npm run dev        # wrangler dev → http://localhost:8787
npm test           # unit tests (vitest)
npm run typecheck
npm run eval       # golden-set evaluation; exits 1 below thresholds
```

## API
- `GET /api/health`
- `GET /api/samples`
- `POST /api/analyze` with body `{ "text": string, "use_ai"?: boolean }` returns `{ extraction, findings, summary, meta }`

## Deploy (Cloudflare)
- **CLI:** `npx wrangler deploy`
- **Dashboard (Workers → Create → Import a repository):**
  - Build command: *(none)*
  - Deploy command: `npx wrangler deploy`
  - Root directory: `/`
- Static assets are served from `public/`. The Workers AI binding `AI` is declared in `wrangler.jsonc`.
