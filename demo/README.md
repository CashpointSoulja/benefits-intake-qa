# Demo videos

**Featured:** [vertical launch demo](benefits-intake-qa-launch-vertical.mp4), a silent, phone-first production cut. Record over it with the [timed first-person script](VOICEOVER.md) or import the matching [SRT](VOICEOVER.srt). The landscape launch cut remains below.

## Vertical launch demo (September 28, 2026)

`benefits-intake-qa-launch-vertical.mp4` is 96 s at 1080×1920, 30 fps, H.264, with no audio track. Rendered from the `Vertical` composition in `launch/remotion/src/Vertical.tsx`. It reframes the real 1600×1200 production walkthrough for a portrait canvas, moving between targeted UI crops and large evidence labels for the family OOP inversion, both p.1/p.2 deductible conflicts, the reviewer’s p.2 choice, After review Ready, the synthetic evaluation caveat and T11 Fail. The AI segment uses the original 1080×1920 production recording from September 27 (`benefits-intake-qa-ai-archive-9x16.mp4`), explicitly labelled archive; it makes no new call. No UI or outcome is staged. The independent-prototype attribution is visible throughout.

The chapter wipes mark new ideas; shorter dissolves link evidence within each idea. Page quotes, reviewer choices and caveats enter in the order they are discussed in the voiceover. Camera moves between source regions use eased crop interpolation, while the footage and original 96-second cue boundaries remain intact. Cursor glows and click rings use only the walkthrough's recorded `launch/remotion/src/events.json` coordinates and source times; the footage cards trim empty space outside the recording. The published-results crop isolates the current-production T11 row from the adjacent historical AI spot-check note.

Rebuild (Node 22, ffmpeg and Chrome/Remotion headless browser):

```bash
cd demo/launch/remotion
npm ci
npx remotion render src/index.ts Vertical ../../benefits-intake-qa-launch-vertical.mp4 --public-dir ../../ --codec h264 --crf 19
```

The render reads both production recordings directly from `demo/` via `--public-dir`; `launch/logo.svg` is the same brand SVG already used in the product. No local-only media is required. The lines and boundaries in `VOICEOVER.md` and `VOICEOVER.srt` both match the 96-second timeline.

## Original production demo (September 27, 2026)

`benefits-intake-qa-demo.mp4` (81 s, H.264, 1600×1200, ~6 MB) was recorded on September 27, 2026 against the production site https://benefits-intake-qa.ayomideahmedcp.workers.dev/ using synthetic sample PDFs only. Author: Ayo Ahmed.

It shows:
1. The Euphoric branding and the "Independent prototype by Ayo Ahmed, not affiliated with Euphoric" disclaimer.
2. The Clean PPO PDF, with fields, page quotes and source highlighting.
3. The Conflicting pages PDF: deductible p.1 "$500" vs p.2 "$750".
4. The reviewer choosing a quote and entering a value, with "After review" changing to Ready.
5. Download reviewed JSON, with the file opened.

`frames/contact-*.jpg` are frame contact sheets (one frame about every 5 s), used to check legibility and that only the production site is shown.

## Rules-only walkthrough (September 28, 2026)

`benefits-intake-qa-walkthrough.mp4` (97.8 s, H.264, 1600×1200) is a real Chrome recording of the production site, re-recorded on September 28, 2026 after the doc corrections in this PR. Idle pauses were trimmed; nothing was staged. The OpenAI option stayed off and a request log confirmed all three analyses sent `use_ai=false`. It shows three synthetic PDFs (clean: Ready; family OOP below individual: Blocked; conflicting pages: Blocked), a reviewer choosing the p.2 quotes, After review changing to Ready, the reviewed JSON export, and the corrected TEST_RESULTS (Sept 27 historical vs Sept 28 current, 56/56, T11 accessibility **Fail**, $1.80 app-side gate) and ROADMAP on this PR's branch. It is the source footage for the launch demo below.

`walkthrough/` holds the synthetic source documents, the production verification output (`verify-results.json`, rerun rules-only on September 28, 2026), the reviewed JSON exports, the frame contact sheet, and a screenshot of the image-only PDF being rejected (not in the video). See `walkthrough/WALKTHROUGH_RESULTS.md`.

## Composed launch demo (September 28, 2026)

`benefits-intake-qa-launch-demo.mp4` (83.6 s, H.264, 1920×1080, 30 fps, ~16 MB) is a produced product demo rendered with Remotion 4.0.526 from `launch/remotion/`. No avatar, no staged UI.

- **Footage:** every product shot is cut from the real recordings, with animated camera zooms on the genuine screen: the rules-only production walkthrough recorded for this PR (family OOP below individual, the two-page deductible conflict, the p.1/p.2 quotes, the reviewer's p.2 pick, After review Ready, the published TEST_RESULTS.md and its T11 **Fail** row). Cursor highlights and click rings are drawn only at the positions and times of logged real mouse moves and clicks (`src/events.json`); no click or state change is added.
- **AI segment:** only the earlier genuine 9:16 production clip from 2026-09-27 23:22 UTC (Carrier = Blue Harbor Health, `AI_FILLED_FIELD`, p.1 line 1 quote), labelled on screen as an archive clip. No new paid call was made for this video; the rest of the video is rules-only.
- **Graphic scenes:** title, problem (labelled as a hypothesis, not customer research), eval harness and close use the official euphoric.global nav SVG and Euphoric orange. The eval scene reproduces excerpted lines of real `npm test` (56/56) and `npm run eval` output, with the caveat that six synthetic cases are a regression check, not real-world accuracy.
- **Attribution:** "Independent prototype by Ayo Ahmed, not affiliated with Euphoric." is on the title and on every later frame.
- **Inspection:** `launch/contact-sheet.jpg` (one frame every 1.5 s across the full timeline) plus full-resolution frames at each zoom were checked for legibility and that each zoom lands on the intended real UI.
