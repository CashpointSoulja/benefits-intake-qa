# Role Viability: Benefits Intake QA as evidence for the Forward-Deployed AI Product Associate role

**Author:** Ayo Ahmed. **Date:** September 27, 2026.

> Independent prototype by Ayo Ahmed, not affiliated with Euphoric. This document maps a self-directed portfolio project to a **published** job description. Euphoric was not contacted. It makes no claims about Euphoric's internal workflows, customers or roadmap.

Sources:
- the Euphoric [Forward-Deployed AI Product Associate](https://jobs.ashbyhq.com/euphoric/183a3d36-f4b8-49da-91e2-c17a621ad287) job post (published 2026-08-13, London);
- Atlassian, [Product Manager: role, responsibilities & best practices](https://www.atlassian.com/agile/product-management/product-manager);
- NIST, [AI RMF 1.0 Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/).

## 1. Demonstrated vs. hypothetical
The key distinction in this package:

| Category | Status | Evidence |
|---|---|---|
| A working, publicly deployed tool that extracts, verifies, checks and supports review of plan documents | **Demonstrated** | [Production app](https://benefits-intake-qa.ayomideahmedcp.workers.dev/), [demo video](../demo/), [TEST_RESULTS.md](TEST_RESULTS.md) |
| Page-level verbatim provenance, conflict surfacing and reviewer JSON export | **Demonstrated** | Tests T2–T7; `test/provenance.test.ts` |
| An evaluation harness with thresholds, and honest limits on what it proves | **Demonstrated** | `npm run eval`; [TEST_PLAN.md](TEST_PLAN.md) §1 |
| AI guardrails: AI never overwrites and never stores ungrounded values | **Demonstrated in unit tests only.** In production the configured model is deprecated, so the AI path currently falls back to rules | `test/engine.test.ts`; TEST_RESULTS T10 |
| Benefits implementation teams lose significant time and accuracy on PDF plan intake | **Hypothesis, not verified** | Inferred from the job post and general industry knowledge; no customer research was done |
| Reviewers trust values more when they are linked to a page quote | **Hypothesis** | Needs interviews and a shadow test (PRD §10) |
| The extraction accuracy would hold on real carrier documents | **Unknown.** Six synthetic cases cannot establish it | [ROADMAP.md](ROADMAP.md) gate G2 |
| The US-style schema fits Euphoric's (London-based, global) clients | **Assumption (scope choice)**, likely wrong for many clients | ROADMAP gate G3 |

## 2. Mapping to the published role
| Role statement (quoted from the job post) | What this project shows | Gap / what it does not show |
|---|---|---|
| "Go deep on document analysis, extraction, and data input" | 18-field deterministic extraction; browser-side pdf.js with page boundaries; verbatim spans with offsets and a `verified` check | No OCR, tables or multi-plan documents; no real documents |
| "Design and refine AI evaluation frameworks" | Golden-set eval with precision, recall, finding-recall and disposition thresholds that fail the build; an evidence-coverage invariant; AI kept only when grounded in a source quote | The golden set is small and not held out; no live AI eval (the model is deprecated in production) |
| "engineer prompts across our product suite" | A single JSON-only extraction prompt with a deterministic fallback | No prompt iteration or evaluation against a model |
| "track product analytics on live production data" | Not demonstrated. Metrics are proposed in PRD §9 (override rate, time-to-disposition) | No analytics instrumentation |
| "owning the end-to-end implementation of our platform for enterprise clients, from onboarding through to live deployment" | Went from PRD to a deployed Cloudflare Worker to browser-verified production, with the reviewer workflow framed around implementation go-live dispositions | Not a client implementation; no stakeholders, data migration or on-site work |
| "Build internal agentic AI workflows that automate lengthy or manual processes" | Partially: the tool automates first-pass intake QA and routes work to a human reviewer | Not agentic; no multi-step tool use |
| "Get hands-on with cutting-edge tools like Claude Code, Cursor, and custom MCP integrations" | Built with an AI coding agent (Devin) under Ayo's direction, with explicit acceptance gates and reviewer corrections | The authorship split between human and AI is noted here for honesty |
| "Gather first-hand insight from both benefits administrators and employees" | Not demonstrated. An interview plan with a kill criterion is in PRD §10 | No interviews conducted |

## 3. PM practice shown (Atlassian framing)
Atlassian lists the product manager's core tasks as understanding and representing user needs, monitoring the market, defining a vision, aligning stakeholders, prioritising features, and creating a shared brain across teams.

| Atlassian PM task | Artifact |
|---|---|
| Understanding and representing user needs | PRD §3 target user, job and pain, with each pain explicitly labelled a hypothesis |
| Defining a vision | PRD §1 and §4 (why this wedge matters) |
| Prioritising features and capabilities | PRD in/out of scope; a roadmap ordered by gates |
| Creating a shared brain | PRD, test plan, test results, roadmap and this document, all in the repo |
| Aligning stakeholders | Not demonstrated (a solo project). Acceptance gaps raised in review were incorporated before merge (see PR #1 history) |
| Monitoring the market / competitive analysis | Not done; out of scope for this package |

## 4. Honest assessment
The project is credible evidence of hands-on execution in document extraction and evaluation discipline: shipping a working, tested, deployed tool with explicit limits. It is weak or silent on customer discovery, stakeholder alignment, live analytics and real-document accuracy. Those are the next things to demonstrate, and they are listed as gates, not promises, in [ROADMAP.md](ROADMAP.md).
