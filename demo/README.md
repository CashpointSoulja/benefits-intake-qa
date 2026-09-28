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

## Composed launch demo (September 28, 2026)

`benefits-intake-qa-launch-demo.mp4` (83.6 s, H.264, 1920×1080, 30 fps, ~16 MB) is a produced product demo rendered with Remotion 4.0.526 from `launch/remotion/`. No avatar, no staged UI.

- **Footage:** every product shot is cut from the real recordings, with animated camera zooms on the genuine screen: the rules-only production walkthrough recorded for this PR (family OOP below individual, the two-page deductible conflict, the p.1/p.2 quotes, the reviewer's p.2 pick, After review Ready, the published TEST_RESULTS.md and its T11 **Fail** row). Cursor highlights and click rings are drawn only at the positions and times of logged real mouse moves and clicks (`src/events.json`); no click or state change is added.
- **AI segment:** only the earlier genuine 9:16 production clip from 2026-09-27 23:22 UTC (Carrier = Blue Harbor Health, `AI_FILLED_FIELD`, p.1 line 1 quote), labelled on screen as an archive clip. No new paid call was made for this video; the rest of the video is rules-only.
- **Graphic scenes:** title, problem (labelled as a hypothesis, not customer research), eval harness and close use the official euphoric.global nav SVG and Euphoric orange. The eval scene reproduces excerpted lines of real `npm test` (56/56) and `npm run eval` output, with the caveat that six synthetic cases are a regression check, not real-world accuracy.
- **Attribution:** "Independent prototype by Ayo Ahmed, not affiliated with Euphoric." is on the title and on every later frame.
- **Inspection:** `launch/contact-sheet.jpg` (one frame every 1.5 s across the full timeline) plus full-resolution frames at each zoom were checked for legibility and that each zoom lands on the intended real UI.
