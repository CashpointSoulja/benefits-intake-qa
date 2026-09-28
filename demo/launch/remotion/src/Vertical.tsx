import React from 'react';
import {
  AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate,
  staticFile, useCurrentFrame,
} from 'remotion';

const FPS = 30;
const ORANGE = '#F26B21';
const INK = '#1D1D1B';
const CREAM = '#FFF7EF';
const FONT = '"Liberation Sans", "DejaVu Sans", Arial, sans-serif';
const MONO = '"DejaVu Sans Mono", monospace';
const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
const easeInOut = Easing.bezier(0.76, 0, 0.24, 1);

const progress = (frame: number, from: number, duration = 20) =>
  interpolate(frame, [from, from + duration], [0, 1], {
    easing: easeOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

const Reveal: React.FC<{children: React.ReactNode; delay?: number; distance?: number}> =
  ({children, delay = 0, distance = 32}) => {
    const p = progress(useCurrentFrame(), delay);
    return <div style={{opacity: p, transform: `translateY(${(1 - p) * distance}px)`}}>{children}</div>;
  };

type Crop = {at: number; x: number; y: number; w: number; h: number};

const interpolateCrop = (keys: Crop[], t: number): Crop => {
  if (t <= keys[0].at) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].at) {
      const a = keys[i - 1];
      const b = keys[i];
      const p = easeInOut((t - a.at) / (b.at - a.at));
      return {at: t, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p,
        w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p};
    }
  }
  return keys[keys.length - 1];
};

const Source: React.FC<{
  src: 'benefits-intake-qa-walkthrough.mp4' | 'benefits-intake-qa-ai-archive-9x16.mp4'; from: number; width: number; height: number;
  crop: Crop[]; label: string; playbackRate?: number;
}> = ({src, from, width, height, crop, label, playbackRate = 1}) => {
  const f = useCurrentFrame();
  const c = interpolateCrop(crop, f / FPS);
  const enter = progress(f, 7, 24);
  const scale = Math.min(960 / c.w, 1000 / c.h);
  const x = 480 - (c.x + c.w / 2) * scale;
  const y = 500 - (c.y + c.h / 2) * scale;
  return (
    <div style={{position: 'absolute', top: 490, left: 60, width: 960, height: 1000,
      borderRadius: 30, overflow: 'hidden', background: '#211f1d', border: '3px solid #f6c5a5',
      boxShadow: '0 28px 65px rgba(29,29,27,.22)', opacity: enter,
      transform: `translateY(${(1 - enter) * 54}px) scale(${0.965 + enter * 0.035})`}}>
      <div style={{position: 'absolute', width, height, transformOrigin: '0 0',
        transform: `translate(${x}px, ${y}px) scale(${scale})`}}>
        <OffthreadVideo src={staticFile(src)} startFrom={Math.round(from * FPS)} playbackRate={playbackRate} muted
          style={{width, height}} />
      </div>
      <div style={{position: 'absolute', left: 20, bottom: 20, background: 'rgba(29,29,27,.94)',
        color: 'white', font: `bold 25px ${FONT}`, padding: '12px 18px', borderRadius: 12}}>{label}</div>
    </div>
  );
};

const Attribution: React.FC<{light?: boolean}> = ({light}) => (
  <div style={{position: 'absolute', bottom: 32, left: 60, right: 60, paddingTop: 18,
    borderTop: `2px solid ${light ? 'rgba(255,255,255,.5)' : 'rgba(29,29,27,.3)'}`,
    font: `bold 24px ${FONT}`, lineHeight: 1.28, color: light ? '#fff' : INK}}>
    Independent prototype by Ayo Ahmed, not affiliated with Euphoric. Synthetic data only.
  </div>
);

const Frame: React.FC<{
  eyebrow: string; title: string; detail?: string; children?: React.ReactNode;
  dark?: boolean; orange?: boolean;
}> = ({eyebrow, title, detail, children, dark, orange}) => {
  const f = useCurrentFrame();
  const background = orange ? ORANGE : dark ? INK : CREAM;
  const foreground = dark ? '#fff' : INK;
  return (
    <AbsoluteFill style={{background, color: foreground, fontFamily: FONT}}>
      <div style={{position: 'absolute', width: 800, height: 800, right: -420, top: -460,
        border: `90px solid ${dark ? '#343330' : orange ? '#fb904f' : '#ffe7d4'}`,
        borderRadius: '50%', transform: `translate(${f * -0.09}px, ${f * 0.12}px)`}} />
      <div style={{position: 'absolute', top: 88, left: 60, right: 60}}>
        <Reveal delay={2} distance={14}><div style={{color: dark ? '#ff995b' : orange ? INK : '#af410e', fontSize: 30,
          fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase'}}>{eyebrow}</div></Reveal>
        <Reveal delay={8}><div style={{fontSize: 78, lineHeight: 1.04, fontWeight: 800, marginTop: 22,
          letterSpacing: -2}}>{title}</div></Reveal>
        {detail && <Reveal delay={17} distance={22}><div style={{fontSize: 37, lineHeight: 1.25, marginTop: 22,
          maxWidth: 960}}>{detail}</div></Reveal>}
      </div>
      {children}
      <Attribution light={dark} />
    </AbsoluteFill>
  );
};

const Card: React.FC<{children: React.ReactNode; top: number; color?: string; delay?: number}> =
  ({children, top, color = '#fff', delay = 20}) => {
    const p = progress(useCurrentFrame(), delay, 24);
    return (
    <div style={{position: 'absolute', top, left: 60, width: 960, boxSizing: 'border-box',
      background: color, borderRadius: 26, padding: '40px 44px', fontSize: 48,
      lineHeight: 1.24, boxShadow: '0 18px 45px rgba(29,29,27,.14)',
      opacity: p, transform: `translateY(${(1 - p) * 42}px)`}}>{children}</div>
    );
  };

const Evidence: React.FC<{children: React.ReactNode; delay?: number; accent?: boolean; top?: number; size?: number}> =
  ({children, delay = 36, accent = false, top = 1510, size = 39}) => {
    const f = useCurrentFrame();
    const p = progress(f, delay, 22);
    return <div style={{position: 'absolute', top, left: 60, right: 60, fontSize: size,
      fontWeight: 800, lineHeight: 1.22, color: accent ? '#ad3019' : 'inherit',
      opacity: p, transform: `translateY(${(1 - p) * 24}px)`}}>
      <div style={{width: 90 * p, height: 5, background: ORANGE, marginBottom: 18}} />
      {children}
    </div>;
  };

const Title: React.FC = () => {
  const f = useCurrentFrame();
  const spin = interpolate(f, [0, 180], [0, 38]);
  return (
    <Frame eyebrow="Production demo · rules first" title="Benefits Intake QA"
      detail="Catch plan-data errors before go-live. Trace every value to a page and quote." orange>
      <div style={{position: 'absolute', top: 740, left: 80, fontSize: 370, color: 'rgba(255,255,255,.23)',
        transform: `rotate(${spin}deg) scale(${0.88 + progress(f, 12, 35) * 0.12})`}}>✳</div>
      <div style={{position: 'absolute', top: 1130, left: 60, right: 60, background: 'rgba(255,255,255,.88)',
        borderRadius: 30, padding: 38, fontSize: 38, fontWeight: 700, lineHeight: 1.25,
        opacity: progress(f, 46), transform: `translateY(${(1 - progress(f, 46)) * 42}px)`}}>
        Real production recording · synthetic plan PDFs · silent cut
      </div>
      <div style={{position: 'absolute', top: 1430, left: 60, fontSize: 29}}>
        Not Euphoric’s product or endorsed by Euphoric. Logo © Euphoric.
      </div>
    </Frame>
  );
};

const Problem: React.FC = () => (
  <Frame eyebrow="The problem · a hypothesis" title="One wrong number. A real go-live risk."
    detail="Plan PDFs can contradict themselves. A reviewer needs to see the source before loading values." dark>
    <Card top={725} color="#363533" delay={20}>01 · Extract a value and its exact quote.</Card>
    <Card top={980} color="#363533" delay={52}>02 · Flag contradictions and impossible limits.</Card>
    <Card top={1305} color="#363533" delay={84}>03 · Let a human decide what to load.</Card>
    <div style={{position: 'absolute', bottom: 140, left: 60, right: 60, fontSize: 27}}>
      Framed from a published job description; not verified customer research.
    </div>
  </Frame>
);

const OopQuote: React.FC = () => (
  <Frame eyebrow="01 / consistency check · live production" title="Family max below individual?"
    detail="The rules read two quoted values from the same synthetic PDF.">
    <Source src="benefits-intake-qa-walkthrough.mp4" from={20.4} width={1600} height={1200} label="Production capture · p.1"
      crop={[{at: 0, x: 760, y: 320, w: 620, h: 300},
        {at: 2, x: 760, y: 320, w: 620, h: 300},
        {at: 7, x: 780, y: 355, w: 580, h: 420}]} />
    <Evidence delay={40} top={1502}>p.1 · Individual max $4,500</Evidence>
    <Evidence delay={90} top={1606} accent>p.1 · Family max $3,500 ↓</Evidence>
  </Frame>
);

const OopFinding: React.FC = () => (
  <Frame eyebrow="01 / blocked for review" title="The family limit fails."
    detail="The family out-of-pocket maximum is $1,000 lower. No guess or silent correction.">
    <Source src="benefits-intake-qa-walkthrough.mp4" from={25.7} width={1600} height={1200} playbackRate={0.72} label="Production capture · rules only"
      crop={[{at: 0, x: 780, y: 860, w: 580, h: 320},
        {at: 7, x: 780, y: 860, w: 580, h: 320}]} />
    <Evidence delay={48} size={35} accent>BLOCKED · FAMILY_OOP_LT_INDIVIDUAL</Evidence>
  </Frame>
);

const ConflictStatus: React.FC = () => (
  <Frame eyebrow="02 / two-page contradiction" title="Two pages disagree."
    detail="Both deductible fields are flagged; the first match is not silently accepted.">
    <Source src="benefits-intake-qa-walkthrough.mp4" from={38.5} width={1600} height={1200} label="Production capture · 2 source pages"
      crop={[{at: 0, x: 400, y: 200, w: 990, h: 610},
        {at: 6, x: 400, y: 200, w: 990, h: 610}]} />
    <Evidence delay={40} size={37} accent>BLOCKED · 2 CONFLICTING_VALUES</Evidence>
  </Frame>
);

const ConflictQuotes: React.FC = () => (
  <Frame eyebrow="02 / page-aware evidence" title="The actual quotes, side by side."
    detail="The reviewer can compare the evidence from p.1 and p.2 before choosing.">
    <Source src="benefits-intake-qa-walkthrough.mp4" from={42.4} width={1600} height={1200} playbackRate={0.45} label="Production capture · page + quote rows"
      crop={[{at: 0, x: 430, y: 690, w: 970, h: 500},
        {at: 5, x: 630, y: 690, w: 700, h: 500},
        {at: 10, x: 630, y: 690, w: 700, h: 500}]} />
    <Evidence delay={48} top={1505} size={36}>Individual · p.1 $600 → p.2 $900</Evidence>
    <Evidence delay={158} top={1610} size={36}>Family · p.1 $1,200 → p.2 $1,800</Evidence>
  </Frame>
);

const Review: React.FC = () => (
  <Frame eyebrow="03 / human-in-the-loop" title="I choose the p.2 evidence."
    detail="The recorded reviewer selects both p.2 values and accepts the unflagged fields.">
    <Source src="benefits-intake-qa-walkthrough.mp4" from={43.5} width={1600} height={1200} label="Real reviewer choice · p.2"
      crop={[{at: 0, x: 520, y: 690, w: 850, h: 510},
        {at: 4, x: 520, y: 690, w: 850, h: 510},
        {at: 5.5, x: 520, y: 110, w: 850, h: 520},
        {at: 8, x: 520, y: 110, w: 850, h: 520}]} />
    <Evidence delay={115} size={37}>Chosen · $900 individual · $1,800 family</Evidence>
  </Frame>
);

const Ready: React.FC = () => (
  <Frame eyebrow="03 / after review" title="Now: Ready to load."
    detail="The checks run again against the reviewer’s choices; the export preserves both the original and chosen values.">
    <Source src="benefits-intake-qa-walkthrough.mp4" from={48} width={1600} height={1200} playbackRate={0.45} label="Production capture · after review"
      crop={[{at: 0, x: 520, y: 110, w: 850, h: 540},
        {at: 3.3, x: 520, y: 110, w: 850, h: 540},
        {at: 7, x: 500, y: 380, w: 920, h: 650}]} />
    <Evidence delay={45} top={1508} size={38}>After review · Ready to load</Evidence>
    <Evidence delay={133} top={1615} size={32}>JSON · value 900 / extracted 600 / p.2</Evidence>
  </Frame>
);

const Eval: React.FC = () => {
  const lines = ['npm test', '7 test files · 56 tests passed', 'npm run eval',
    '6 / 6 synthetic dispositions', 'All thresholds met.'];
  return (
    <Frame eyebrow="04 / regression gates" title="The build checks its rules."
      detail="The published test and evaluation results are reproducible in the repo.">
      <div style={{position: 'absolute', left: 60, right: 60, top: 645, height: 740,
        background: INK, borderRadius: 26, padding: 44, boxSizing: 'border-box',
        color: '#d7f5dd', font: `38px/1.85 ${MONO}`}}>
        {lines.map((line, i) => <Reveal key={line} delay={25 + i * 27} distance={14}>{line}</Reveal>)}
      </div>
      <Card top={1420} color="#ffe2ca" delay={139}>
        Six synthetic cases, written alongside the rules. Regression check, not real-world accuracy.
      </Card>
    </Frame>
  );
};

const Gap: React.FC = () => (
  <Frame eyebrow="05 / published results" title="A known failure stays visible."
    detail="T11 accessibility failed. Image-only scans need OCR; real-world accuracy has not been measured.">
    <Source src="benefits-intake-qa-walkthrough.mp4" from={62.6} width={1600} height={1200} label="Published TEST_RESULTS.md · T11"
      crop={[{at: 0, x: 440, y: 430, w: 1040, h: 430},
        {at: 1.4, x: 440, y: 560, w: 1040, h: 200},
        {at: 7, x: 440, y: 560, w: 1040, h: 200}]} />
    <Evidence delay={52} size={42} accent>T11 accessibility: FAIL</Evidence>
  </Frame>
);

const AiArchive: React.FC<{late?: boolean}> = ({late}) => (
  <Frame eyebrow="Archive · 27 Sep 2026" title={late ? 'Only a sourced fill survives.' : 'Optional AI second opinion.'}
    detail={late ? 'An AI-filled carrier is kept only when its value appears verbatim in the source, on p.1.'
      : 'Previously recorded production call on synthetic text. This demo makes no new paid AI call.'}>
    <Source src="benefits-intake-qa-ai-archive-9x16.mp4" from={late ? 99.5 : 56.5} width={1080} height={1920}
      label="Earlier genuine production recording · AI enabled"
      crop={late ? [{at: 0, x: 60, y: 480, w: 960, h: 1120},
        {at: 7, x: 60, y: 480, w: 960, h: 1120}]
        : [{at: 0, x: 60, y: 350, w: 960, h: 1200},
          {at: 8, x: 60, y: 350, w: 960, h: 1200}]} />
    <Evidence delay={45} size={34}>{late ? 'Blue Harbor Health · AI_FILLED_FIELD · p.1 line 1'
      : 'Archive only · rules run regardless of the AI checkbox'}</Evidence>
  </Frame>
);

const Close: React.FC = () => {
  const f = useCurrentFrame();
  const p = progress(f, 27, 32);
  return <Frame eyebrow="Benefits Intake QA" title="Review with the evidence."
    detail="Page quotes · conflict checks · human choice · reviewed JSON" orange>
    <Img src={staticFile('launch/logo.svg')} style={{position: 'absolute', left: 70, top: 715,
      width: 770, height: 200, objectFit: 'contain', objectPosition: 'left',
      opacity: p, transform: `translateY(${(1 - p) * 35}px)`}} />
    <Card top={1120} color="#fff7ef" delay={54}>
      Next gates: OCR for scanned PDFs, then held-out, consented real-document validation.
    </Card>
    <div style={{position: 'absolute', top: 1490, left: 60, right: 60, fontSize: 33,
      fontWeight: 700, overflowWrap: 'anywhere', opacity: progress(f, 110)}}>
      github.com/CashpointSoulja/benefits-intake-qa
    </div>
  </Frame>;
};

const scenes: {seconds: number; component: React.ReactNode}[] = [
  {seconds: 6, component: <Title />},
  {seconds: 6, component: <Problem />},
  {seconds: 7, component: <OopQuote />},
  {seconds: 7, component: <OopFinding />},
  {seconds: 6, component: <ConflictStatus />},
  {seconds: 10, component: <ConflictQuotes />},
  {seconds: 8, component: <Review />},
  {seconds: 7, component: <Ready />},
  {seconds: 8, component: <Eval />},
  {seconds: 7, component: <Gap />},
  {seconds: 8, component: <AiArchive />},
  {seconds: 7, component: <AiArchive late />},
  {seconds: 9, component: <Close />},
];

export const VERTICAL_FRAMES = scenes.reduce((sum, scene) => sum + scene.seconds * FPS, 0);

const Transition: React.FC<{children: React.ReactNode; chapter: boolean; first: boolean}> =
  ({children, chapter, first}) => {
    const f = useCurrentFrame();
    const p = first ? 1 : progress(f, 0, 12);
    return <AbsoluteFill style={chapter
      ? {clipPath: `inset(0 ${100 * (1 - p)}% 0 0)`}
      : {opacity: p, transform: `translateY(${(1 - p) * 24}px) scale(${1.012 - p * 0.012})`}}>
      {children}
    </AbsoluteFill>;
  };

export const Vertical: React.FC = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{background: INK}}>
      {scenes.map((scene, i) => {
        const start = from;
        from += scene.seconds * FPS;
        const overlap = i === 0 ? 0 : 12;
        return <Sequence key={i} from={start - overlap} durationInFrames={scene.seconds * FPS + overlap}>
          <Transition first={i === 0} chapter={[1, 2, 4, 6, 8, 9, 10, 12].includes(i)}>
            {scene.component}
          </Transition>
        </Sequence>;
      })}
    </AbsoluteFill>
  );
};
