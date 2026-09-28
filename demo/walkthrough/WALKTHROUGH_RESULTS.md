# Benefits Intake QA production walkthrough (2026-09-28)

Site: https://benefits-intake-qa.ayomideahmedcp.workers.dev/ (unchanged). Chrome 137. All data synthetic. Author: Ayo Ahmed.
OpenAI second opinion was never ticked. Every /api/analyze request was logged with use_ai=false by a local network guard (it would have blocked use_ai=true). No paid AI call was made.

| Document | Pages | Expected | Observed (production, rules) | Evidence / review |
|---|---|---|---|---|
| wt-clean-ppo.pdf | 1 | Ready, 0 findings | Ready to load, 12/12 required, 0 errors/warnings | Carrier: p.1 "Carrier: Blue Harbor Health"; deductible $2,000/$4,000 quoted. Accept all unflagged gives 18/18 reviewed, After review: Ready |
| wt-messy-family-oop.pdf | 1 | Blocked, FAMILY_OOP_LT_INDIVIDUAL | Blocked, 1 error: family OOP $3500 < individual $4500 | p.1 "Out of pocket max individual $4,500" and "Out of pocket max family $3,500" |
| wt-conflicting-pages.pdf | 2 | Blocked, 2 conflicts | Blocked, 2 CONFLICTING_VALUES | p.1 "Deductible (individual): $600" vs p.2 "$900"; p.1 "Deductible (family): $1,200" vs p.2 "$1,800". Reviewer chooses p.2 values, which become edited; Accept all unflagged gives 18/18 reviewed, After review: Ready, 0 errors. JSON export has value 900, extracted_value 600, page 2, both quotes |
| wt-scanned-image-only.pdf | 1 (image only) | Rejected before API | "no text layer found. This looks like a scanned PDF, and OCR is out of scope for v0.1"; no /api/analyze request | Shown separately, not in the video |

The published docs shown in the video are PRD.md, TEST_PLAN.md, TEST_RESULTS.md (the T11 accessibility row is marked **Fail**) and ROADMAP.md (known issues).

Known stale line visible in the video: the ROADMAP known-issues row still says the OpenAI replacement is "not deployed".
