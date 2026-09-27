# Benefits Intake QA

A small tool that turns a benefits plan document into structured fields, links each field to an exact source quote and PDF page, lets a reviewer accept or edit each value and download reviewed JSON, and gives an implementation reviewer a checklist of what to fix before loading.

> **Independent prototype by Ayo Ahmed, not affiliated with Euphoric.** This is a concept prepared for Euphoric. It is not Euphoric's product, and Euphoric has not endorsed it. The UI shows Euphoric's logo and screenshots from https://www.euphoric.global/, which are © Euphoric; see `public/brand/ATTRIBUTION.md`. All plan data is synthetic.

- **Product requirements:** [docs/PRD.md](docs/PRD.md)
- **Stack:** a Cloudflare Worker (TypeScript API) serves the static frontend from `public/`. An optional Cloudflare Workers AI binding provides an AI second opinion.

## What it does
1. You drop or upload a text-based PDF, or paste text. pdf.js is served from the Worker's own assets (`public/vendor/pdfjs`) and extracts the text in the browser. Sample PDFs are in `public/samples/`.
2. Deterministic extraction finds 18 plan fields. Each populated field records a verbatim quote, a page number, character offsets, and a `verified` flag. Missing fields are `null`. Contradictions keep every quote and page.
3. Optionally, Workers AI gives a second opinion. It can fill gaps or flag disagreements, but it never overwrites a rule-extracted value.
4. 14 QA checks run, covering missing fields, conflicts, family < individual, OOP < deductible, HDHP/HSA consistency, reference limits, and dates.
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
- Static assets are served from `public/`. The Workers AI binding `AI` is declared in `wrangler.jsonc`.
