# Demo video

`benefits-intake-qa-demo.mp4` (81 s, H.264, 1600×1200, ~6 MB) was recorded on September 27, 2026 against the production site https://benefits-intake-qa.ayomideahmedcp.workers.dev/ using synthetic sample PDFs only. Author: Ayo Ahmed.

It shows:
1. The Euphoric branding and the "Independent prototype by Ayo Ahmed, not affiliated with Euphoric" disclaimer.
2. The Clean PPO PDF, with fields, page quotes and source highlighting.
3. The Conflicting pages PDF: deductible p.1 "$500" vs p.2 "$750".
4. The reviewer choosing a quote and entering a value, with "After review" changing to Ready.
5. Download reviewed JSON, with the file opened.

`frames/contact-*.jpg` are frame contact sheets (one frame about every 5 s), used to check legibility and that only the production site is shown.

## Rules-only walkthrough (September 28, 2026)

`benefits-intake-qa-walkthrough.mp4` (98 s, H.264, 1600×1200, ~5 MB) is a real Chrome recording of the production site. Idle pauses were trimmed; nothing was staged. The OpenAI option stayed off and no AI call was made. It shows three synthetic PDFs (clean: Ready; family OOP below individual: Blocked; conflicting pages: Blocked), a reviewer choosing the p.2 quotes, After review changing to Ready, the reviewed JSON export, and the published PRD, test plan, test results (T11 accessibility **Fail**) and roadmap.

`walkthrough/` holds the synthetic source documents, the production verification output (`verify-results.json`, rerun rules-only on September 28, 2026), the reviewed JSON exports, the frame contact sheet, and a screenshot of the image-only PDF being rejected (not in the video). See `walkthrough/WALKTHROUGH_RESULTS.md`.
