import React from 'react';
import {
  AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, interpolate, spring,
  useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';
import events from './events.json';

const FPS = 30;
const ORANGE = '#F26B21';
const INK = '#1D1D1B';
const CREAM = '#FFF7EF';
const FONT = '"Liberation Sans", "DejaVu Sans", Arial, sans-serif';
const MONO = '"DejaVu Sans Mono", monospace';
const W = 1920, H = 1080;

type Box = {t: number; x: number; y: number; w: number; h: number};
type Ev = {t: number; kind: string; x: number; y: number};

const ease = Easing.bezier(0.65, 0, 0.35, 1);

function camAt(keys: Box[], t: number) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) {
      const p = ease(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
      return {t, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p};
    }
  }
  return keys[keys.length - 1];
}

const Logo: React.FC<{width: number; sunburst?: string}> = ({width}) => (
  <Img src={staticFile('launch/logo.svg')} style={{width, height: 'auto', display: 'block'}} />
);

const Attribution: React.FC<{dark?: boolean}> = ({dark}) => (
  <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, background: dark ? 'rgba(29,29,27,0.92)' : 'rgba(255,255,255,0.9)',
    color: dark ? '#fff' : INK, fontFamily: FONT, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 36px'}}>
    <span><b>Independent prototype by Ayo Ahmed, not affiliated with Euphoric.</b> Synthetic data only.</span>
    <span style={{opacity: 0.8}}>benefits-intake-qa.ayomideahmedcp.workers.dev</span>
  </div>
);

/** Screen footage with an animated camera. `from` is the source second; keys use source pixels and clip-relative seconds. */
const Footage: React.FC<{src: string; srcW: number; srcH: number; from: number; keys: Box[]; events?: Ev[]; playbackRate?: number}> = ({src, srcW, srcH, from, keys, events: evs = [], playbackRate = 1}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const c = camAt(keys, t);
  const areaH = H - 44;
  const s = Math.min(W / c.w, areaH / c.h);
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const tx = W / 2 - cx * s, ty = areaH / 2 - cy * s;
  const srcT = from + t * playbackRate;
  return (
    <AbsoluteFill style={{background: '#111'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: srcW, height: srcH, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})`}}>
        <OffthreadVideo src={staticFile(src)} startFrom={Math.round(from * FPS)} playbackRate={playbackRate} muted style={{width: srcW, height: srcH}} />
        {evs.map((e, i) => {
          const dt = srcT - e.t;
          if (dt < -0.15 || dt > 1.1) return null;
          const p = Math.max(0, dt) / 1.1;
          if (e.kind === 'left_click') {
            return (
              <div key={i} style={{position: 'absolute', left: e.x, top: e.y, width: 0, height: 0}}>
                <div style={{position: 'absolute', left: -14 - 40 * p, top: -14 - 40 * p, width: 28 + 80 * p, height: 28 + 80 * p, borderRadius: '50%',
                  border: `${5 / s + 2}px solid ${ORANGE}`, opacity: 1 - p}} />
                <div style={{position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: '50%', background: ORANGE, opacity: 0.85 * (1 - p)}} />
              </div>
            );
          }
          return (
            <div key={i} style={{position: 'absolute', left: e.x - 30, top: e.y - 30, width: 60, height: 60, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(242,107,33,0.45) 0%, rgba(242,107,33,0) 70%)', opacity: 1 - p}} />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Caption: React.FC<{kicker: string; title: string; body?: string; at?: 'left' | 'right'; width?: number; delay?: number}> = ({kicker, title, body, at = 'left', width = 620, delay = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sp = spring({frame: frame - delay, fps, config: {damping: 200}});
  return (
    <div style={{position: 'absolute', top: 56, [at]: 56, width, background: 'rgba(29,29,27,0.93)', color: '#fff', borderRadius: 18, padding: '26px 30px',
      fontFamily: FONT, transform: `translateY(${(1 - sp) * 30}px)`, opacity: sp, borderLeft: `8px solid ${ORANGE}`, boxShadow: '0 20px 60px rgba(0,0,0,0.35)'}}>
      <div style={{color: ORANGE, fontWeight: 700, letterSpacing: 2, fontSize: 22, textTransform: 'uppercase'}}>{kicker}</div>
      <div style={{fontSize: 42, fontWeight: 700, lineHeight: 1.15, marginTop: 8}}>{title}</div>
      {body && <div style={{fontSize: 26, lineHeight: 1.35, marginTop: 12, opacity: 0.9}}>{body}</div>}
    </div>
  );
};

const Badge: React.FC<{text: string; color?: string; top?: number; right?: number}> = ({text, color = ORANGE, top = 56, right = 56}) => (
  <div style={{position: 'absolute', top, right, background: color, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 24, padding: '10px 18px', borderRadius: 999}}>{text}</div>
);

/* ---------- Branded scenes ---------- */

const Title: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame: f, fps, config: {damping: 18, mass: 0.8}});
  const b = spring({frame: f - 14, fps, config: {damping: 200}});
  const c = spring({frame: f - 30, fps, config: {damping: 200}});
  const rays = interpolate(f, [0, 180], [0, 40]);
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 70% 40%, #FF8A45 0%, ${ORANGE} 55%, #D9531A 100%)`, fontFamily: FONT, color: INK}}>
      <svg width={1400} height={1400} style={{position: 'absolute', right: -380, top: -300, opacity: 0.18, transform: `rotate(${rays}deg)`}} viewBox="-100 -100 200 200">
        {Array.from({length: 24}).map((_, i) => (
          <line key={i} x1={0} y1={0} x2={100 * Math.cos((i * Math.PI) / 12)} y2={100 * Math.sin((i * Math.PI) / 12)} stroke="#fff" strokeWidth={1.2} />
        ))}
      </svg>
      <div style={{position: 'absolute', left: 140, top: 250, transform: `scale(${0.8 + 0.2 * a})`, transformOrigin: 'left center', opacity: a}}>
        <Logo width={520} />
      </div>
      <div style={{position: 'absolute', left: 140, top: 420, opacity: b, transform: `translateX(${(1 - b) * -40}px)`}}>
        <div style={{fontSize: 104, fontWeight: 700, letterSpacing: -2}}>Benefits Intake QA</div>
        <div style={{fontSize: 40, marginTop: 14, maxWidth: 1250, lineHeight: 1.3}}>Catch plan-data errors at intake, with exact page and quote evidence, before they reach go-live.</div>
      </div>
      <div style={{position: 'absolute', left: 140, top: 760, opacity: c, fontSize: 28, background: 'rgba(255,255,255,0.88)', padding: '16px 24px', borderRadius: 14, maxWidth: 1300}}>
        <b>Independent prototype by Ayo Ahmed, not affiliated with Euphoric.</b> Not Euphoric's product; not endorsed. Synthetic data only. Logo © Euphoric.
      </div>
    </AbsoluteFill>
  );
};

const Problem: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lines = [
    ['Plan data arrives as PDFs and emails.', 'Deductibles, out-of-pocket limits, dates.'],
    ['Someone keys it into the platform.', 'Two pages can disagree. Numbers can be swapped.'],
    ['A wrong value can reach go-live.', 'Members and payroll inherit it.'],
  ];
  return (
    <AbsoluteFill style={{background: INK, fontFamily: FONT, color: '#fff', padding: '120px 140px'}}>
      <div style={{color: ORANGE, fontSize: 28, fontWeight: 700, letterSpacing: 3}}>THE PROBLEM, AS A HYPOTHESIS</div>
      {lines.map(([h, s], i) => {
        const p = spring({frame: f - 12 - i * 26, fps, config: {damping: 200}});
        return (
          <div key={i} style={{marginTop: i === 0 ? 50 : 38, opacity: p, transform: `translateY(${(1 - p) * 40}px)`, display: 'flex', gap: 34, alignItems: 'baseline'}}>
            <div style={{fontSize: 56, color: ORANGE, fontWeight: 700, width: 60}}>{i + 1}</div>
            <div>
              <div style={{fontSize: 60, fontWeight: 700}}>{h}</div>
              <div style={{fontSize: 34, opacity: 0.75, marginTop: 6}}>{s}</div>
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 140, bottom: 90, fontSize: 26, opacity: interpolate(f, [100, 120], [0, 0.85], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
        Framed from a published job description. Not verified customer research. Everything that follows is real production footage.
      </div>
      <Attribution dark />
    </AbsoluteFill>
  );
};

const EVAL_LINES = [
  '$ npm test',
  ' Test Files  7 passed (7)',
  '      Tests  56 passed (56)',
  '$ npm run eval',
  'ok   clean-ppo',
  'ok   messy-hdhp',
  'ok   conflicting-values',
  'ok   sparse-email',
  'ok   inline-slash-format',
  'ok   inverted-coinsurance-and-bad-dates',
  'precision=1.000 recall=1.000',
  '=== Disposition accuracy === 1.000 (6/6)',
  'All thresholds met.',
];

const Eval: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const shown = Math.floor(interpolate(f, [10, 130], [0, EVAL_LINES.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const warn = spring({frame: f - 150, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{background: CREAM, fontFamily: FONT, color: INK}}>
      <div style={{position: 'absolute', left: 110, top: 80, color: ORANGE, fontWeight: 700, fontSize: 28, letterSpacing: 3}}>EVAL HARNESS</div>
      <div style={{position: 'absolute', left: 110, top: 130, fontSize: 60, fontWeight: 700}}>Regression gates that fail the build</div>
      <div style={{position: 'absolute', left: 110, top: 250, width: 980, height: 660, background: INK, borderRadius: 20, padding: '30px 36px', fontFamily: MONO, fontSize: 30, color: '#EDEDED', lineHeight: 1.5}}>
        {EVAL_LINES.slice(0, shown).map((l, i) => (
          <div key={i} style={{color: l.startsWith('$') ? ORANGE : l.startsWith('ok') || l.includes('passed') || l.includes('met') ? '#9BE39B' : '#EDEDED'}}>{l}</div>
        ))}
        <div style={{position: 'absolute', bottom: 18, right: 26, fontSize: 18, color: '#999', fontFamily: FONT}}>Output of the real runs, 28 Sep 2026, commit 7e8ea47</div>
      </div>
      <div style={{position: 'absolute', left: 1150, top: 250, width: 660, opacity: warn, transform: `translateX(${(1 - warn) * 40}px)`}}>
        <div style={{background: '#fff', border: `4px solid ${ORANGE}`, borderRadius: 20, padding: 34}}>
          <div style={{fontSize: 30, fontWeight: 700, color: ORANGE}}>Caveat</div>
          <div style={{fontSize: 34, lineHeight: 1.35, marginTop: 12}}>
            6 synthetic cases, written alongside the rules. <b>This is a regression check, not real-world accuracy.</b>
          </div>
          <div style={{fontSize: 26, lineHeight: 1.4, marginTop: 18, opacity: 0.8}}>No held-out or real documents have been tested. That is roadmap gate 2.</div>
        </div>
      </div>
      <Attribution />
    </AbsoluteFill>
  );
};

const AiLabel: React.FC = () => (
  <div style={{position: 'absolute', left: 56, top: 56, width: 760, background: '#fff', color: INK, fontFamily: FONT, borderRadius: 18, padding: '24px 28px', borderLeft: `10px solid ${ORANGE}`}}>
    <div style={{fontWeight: 700, fontSize: 22, letterSpacing: 2, color: ORANGE}}>OPTIONAL AI SECOND OPINION · ARCHIVE CLIP</div>
    <div style={{fontSize: 34, fontWeight: 700, marginTop: 8, lineHeight: 1.2}}>Previously recorded genuine production call</div>
    <div style={{fontSize: 24, marginTop: 10, lineHeight: 1.4}}>
      27 Sep 2026, 23:22 UTC. Synthetic one-line text. Not re-run for this video; no new paid call. The rest of this demo is rules-only.
    </div>
  </div>
);

const Close: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame: f, fps, config: {damping: 200}});
  const items = [
    ['Demonstrated', 'Page-aware quotes on every populated field · conflict and consistency checks · reviewer choice · reviewed JSON'],
    ['Known gaps', 'T11 accessibility fails · no OCR for scanned PDFs · no real-world accuracy measured'],
    ['Next gate', 'OCR, then held-out, consented real-document validation'],
  ];
  return (
    <AbsoluteFill style={{background: ORANGE, fontFamily: FONT, color: INK, padding: '150px 140px'}}>
      <div style={{opacity: a}}><Logo width={420} /></div>
      <div style={{fontSize: 88, fontWeight: 700, marginTop: 30, opacity: a}}>Benefits Intake QA</div>
      {items.map(([k, v], i) => {
        const p = spring({frame: f - 15 - i * 15, fps, config: {damping: 200}});
        return (
          <div key={k} style={{display: 'flex', gap: 30, marginTop: 40, opacity: p, transform: `translateY(${(1 - p) * 30}px)`}}>
            <div style={{width: 300, fontSize: 40, fontWeight: 700}}>{k}</div>
            <div style={{fontSize: 40, flex: 1, lineHeight: 1.35}}>{v}</div>
          </div>
        );
      })}
      <div style={{marginTop: 70, fontSize: 36, fontFamily: MONO, background: 'rgba(255,255,255,0.9)', padding: '16px 22px', borderRadius: 12, display: 'inline-block'}}>
        github.com/CashpointSoulja/benefits-intake-qa
      </div>
      <Attribution />
    </AbsoluteFill>
  );
};

/* ---------- Timeline ---------- */

const WT = {src: 'benefits-intake-qa-walkthrough.mp4', srcW: 1600, srcH: 1200};
const AI = {src: 'benefits-intake-qa-ai-archive-9x16.mp4', srcW: 1080, srcH: 1920};
const FULL: Omit<Box, 't'> = {x: 0, y: 0, w: 1600, h: 1200};
const EVS = events as Ev[];

type Seg = {dur: number; el: React.ReactNode};
const segs: Seg[] = [
  {dur: 6.5, el: <Title />},
  {dur: 6, el: <Problem />},
  // Messy PDF: family OOP below individual (source 20.4s)
  {dur: 9.5, el: (
    <>
      <Footage {...WT} from={20.4} events={EVS} keys={[
        {t: 0, ...FULL},
        {t: 1.2, x: 760, y: 320, w: 620, h: 220},
        {t: 3.6, x: 760, y: 320, w: 620, h: 220},
        {t: 5.2, x: 780, y: 880, w: 580, h: 240},
        {t: 9.5, x: 780, y: 880, w: 580, h: 240},
      ]} />
      <Sequence from={30} layout="none"><Caption at="right" kicker="Real synthetic PDF · rules only" title="Family OOP below individual" body="Blocked: FAMILY_OOP_LT_INDIVIDUAL. Both source lines quoted: $4,500 vs $3,500, p.1." width={640} /></Sequence>
    </>
  )},
  // Conflicting pages: upload result (source 36.6s)
  {dur: 5.6, el: (
    <>
      <Footage {...WT} from={35.2} events={EVS} keys={[
        {t: 0, ...FULL},
        {t: 2.6, ...FULL},
        {t: 3.6, x: 410, y: 210, w: 1000, h: 540},
        {t: 5.6, x: 410, y: 210, w: 1000, h: 540},
      ]} />
      <Sequence from={96} layout="none"><Caption at="left" kicker="Contradiction detected" title="Two pages, two deductibles" body="Extracted: Blocked. CONFLICTING_VALUES for individual (600 vs 900) and family (1200 vs 1800)." width={600} /></Sequence>
    </>
  )},
  // Evidence + reviewer choice (source 42.4s)
  {dur: 8.5, el: (
    <>
      <Footage {...WT} from={42.4} events={EVS} keys={[
        {t: 0, x: 430, y: 690, w: 970, h: 523},
        {t: 4.2, x: 430, y: 690, w: 970, h: 523},
        {t: 5.4, x: 520, y: 110, w: 1000, h: 540},
        {t: 8.5, x: 520, y: 110, w: 1000, h: 540},
      ]} />
      <Caption at="left" kicker="Exact page + quote" title="Reviewer picks the p.2 quote" body="Each value cites page and line verbatim. The reviewer's pick is marked EDITED; After review becomes Ready to load." width={560} />
    </>
  )},
  // Docs: current-state table then T11 fail (source 56.8s, 62.4s)
  {dur: 5, el: (
    <>
      <Footage {...WT} from={56.6} events={EVS} keys={[
        {t: 0, x: 420, y: 220, w: 1080, h: 640},
        {t: 1.4, x: 560, y: 520, w: 900, h: 260},
        {t: 5, x: 560, y: 520, w: 900, h: 260},
      ]} />
      <Badge text="Published TEST_RESULTS.md · PR #6" color={INK} top={900} right={56} />
    </>
  )},
  {dur: 9, el: <Eval />},
  {dur: 5.5, el: (
    <>
      <Footage {...WT} from={62.6} events={EVS} keys={[
        {t: 0, x: 440, y: 400, w: 1040, h: 480},
        {t: 1.2, x: 440, y: 560, w: 1040, h: 170},
        {t: 5.5, x: 440, y: 560, w: 1040, h: 170},
      ]} />
      <Badge text="T11 accessibility: FAIL (recorded, not hidden)" color="#B3261E" top={880} right={56} />
    </>
  )},
  // AI archive clip
  {dur: 11, el: (
    <AbsoluteFill style={{background: INK}}>
      <Footage {...AI} from={56.5} keys={[
        {t: 0, x: -1400, y: 0, w: 3880, h: 1920},
        {t: 2.5, x: -1400, y: 0, w: 3880, h: 1920},
        {t: 4, x: -300, y: 1050, w: 1500, h: 450},
        {t: 11, x: -300, y: 1050, w: 1500, h: 450},
      ]} />
      <AiLabel />
    </AbsoluteFill>
  )},
  {dur: 9, el: (
    <AbsoluteFill style={{background: INK}}>
      <Footage {...AI} from={99.5} keys={[
        {t: 0, x: -200, y: 480, w: 1480, h: 260},
        {t: 3.8, x: -200, y: 480, w: 1480, h: 260},
        {t: 5.2, x: -40, y: 1330, w: 1160, h: 200},
        {t: 9, x: -40, y: 1330, w: 1160, h: 200},
      ]} />
      <Badge text="Archive clip · 27 Sep 2026 · AI value kept only because its quote was found on p.1" color={ORANGE} top={968} right={56} />
    </AbsoluteFill>
  )},
  {dur: 8, el: <Close />},
];

const starts: number[] = [];
segs.reduce((acc, s) => { starts.push(acc); return acc + Math.round(s.dur * FPS); }, 0);
export const TOTAL = segs.reduce((a, s) => a + Math.round(s.dur * FPS), 0);

const Fade: React.FC<{children: React.ReactNode; len: number}> = ({children, len}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 8, len - 8, len], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

export const Demo: React.FC = () => (
  <AbsoluteFill style={{background: '#111'}}>
    {segs.map((s, i) => {
      const len = Math.round(s.dur * FPS);
      return (
        <Sequence key={i} from={starts[i]} durationInFrames={len}>
          <Fade len={len}>
            {s.el}
            {i >= 2 && i <= segs.length - 2 && <Attribution dark />}
          </Fade>
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
