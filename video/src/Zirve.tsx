import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-zirve.json";

// "ZİRVEYE BİR GECE KALA": 24 sn, 1080x1920, 30 fps. Senaryo: Desktop/yenisarkilarim-video/SENARYO_ZIRVEYE_BIR_GECE_KALA.md
// Sahneler (sn): 1 kanca 0-2 | 2 catisma 2-6 | 3 ilk gercek 6-10 | 4 tersine donus 10-15 | 5 zirve ani 15-19 | 6 secim 19-23 | 7 dongu 23-24
// Tum sayilar data-zirve.json'dan gelir (kworb gunluk liste, src/zirveGece.js); iddia metinleri de ayni dosyadaki `copy` ile veriye baglidir.
// Kapaklar duz, net katmanlardir: filtre/karisim/dondurme yok, yalnizca konum, olcek ve saydamlik animasyonu.

const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

type SideT = { artist: string; title: string; rank: number; streams: number };
type Cap = { t0: number; t1: number; text: string };
type Copy = { hook: string[]; s4: string[]; s5: string[]; fastest: boolean; tomorrow: boolean };

const A = data.a as SideT;
const B = data.b as SideT;
const COPY = data.copy as Copy;
const CAPS = data.captions as Cap[];
const BANDS = data.bands as number[][];
const GAP_NOW = data.gapNow as number;
const GAP_PREV = (data.gapPrev as number | null) ?? null;
const CLOSED = (data.closed as number | null) ?? null;
const SHARE_B = data.shareB as number;
const DUR = data.durationSeconds as number;

const W = 1080;
const GOLD = "#ffd24d";
const AMBER = "#ff9f2e";
const GREEN = "#1ed760";

// ana zaman cizelgesi (senaryo saniyeleri)
const T = { crack: 1.0, split: 2.0, bArrive: 2.3, cut: 5.97, s4: 10.0, odo0: 10.55, lock: 13.0, s5: 15.0, frz0: 17.05, frz1: 17.55, s6: 19.0, s7: 23.0, flash: 23.5 };

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeInOut = (x: number) => {
  const y = clamp(x);
  return y < 0.5 ? 4 * y * y * y : 1 - (-2 * y + 2) ** 3 / 2;
};
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const hash = (a: number, b = 0, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;
const dots = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const inWin = (t: number, a: number, b: number) => t >= a && t < b;
const fit = (s: string, max: number, width: number, k = 0.5) => Math.min(max, Math.floor(width / (Math.max(1, s.length) * k)));
const fringe = (amp: number) => `${amp}px 0 rgba(255,40,90,0.8), ${-amp}px 0 rgba(40,220,255,0.8), 0 6px 30px rgba(0,0,0,0.85)`;

// ---------------------------------------------------------------- tac (seffaf, vektorel)
const CROWN_PTS = "40,215 24,64 92,134 116,50 160,138 200,22 240,138 284,50 308,134 376,64 360,215";
const CRACK = [[200, 22], [188, 70], [214, 110], [192, 160], [212, 205], [196, 240], [204, 270]];
const CRACK_D = CRACK.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
const CLIP_L = `0,0 200,0 ${CRACK.map(([x, y]) => `${x},${y}`).join(" ")} 204,300 0,300`;
const CLIP_R = `200,0 400,0 400,300 204,300 ${CRACK.slice().reverse().map(([x, y]) => `${x},${y}`).join(" ")}`;

const CrownBody: React.FC<{ id: string }> = ({ id }) => (
  <>
    <polygon points={CROWN_PTS} fill={`url(#g-${id})`} stroke="#fff3c0" strokeWidth="3" strokeLinejoin="round" />
    <rect x="38" y="205" width="324" height="62" rx="8" fill={`url(#b-${id})`} stroke="#fff3c0" strokeWidth="3" />
    {[[24, 60], [116, 44], [200, 16], [284, 44], [376, 60]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="12" fill="#fff0b0" stroke="#d99a16" strokeWidth="2" />
    ))}
    <circle cx="112" cy="236" r="15" fill="#ff6a1f" stroke="#fff3c0" strokeWidth="2" />
    <circle cx="200" cy="236" r="17" fill={GREEN} stroke="#fff3c0" strokeWidth="2" />
    <circle cx="288" cy="236" r="15" fill="#ff6a1f" stroke="#fff3c0" strokeWidth="2" />
  </>
);

const Crown: React.FC<{ id: string; width: number; crack: number; glow: number }> = ({ id, width, crack, glow }) => {
  const split = crack >= 1 ? 1 : 0;
  return (
    <svg width={width} height={width * 0.75} viewBox="0 0 400 300" style={{ overflow: "visible", filter: `drop-shadow(0 0 ${26 * glow}px rgba(255,190,60,${0.55 * glow}))` }}>
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b8" />
          <stop offset="0.38" stopColor="#ffd24d" />
          <stop offset="0.75" stopColor="#e0a21f" />
          <stop offset="1" stopColor="#9a6408" />
        </linearGradient>
        <linearGradient id={`b-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd24d" />
          <stop offset="1" stopColor="#a8700a" />
        </linearGradient>
        <clipPath id={`l-${id}`}><polygon points={CLIP_L} /></clipPath>
        <clipPath id={`r-${id}`}><polygon points={CLIP_R} /></clipPath>
      </defs>
      {crack > 0 ? (
        <>
          <g clipPath={`url(#l-${id})`} style={{ transformOrigin: "200px 150px", transform: `translate(${-3.5 * split}px, ${1.5 * split}px) rotate(${-0.9 * split}deg)` }}>
            <CrownBody id={id} />
          </g>
          <g clipPath={`url(#r-${id})`} style={{ transformOrigin: "200px 150px", transform: `translate(${3.5 * split}px, ${-0.5 * split}px) rotate(${1.1 * split}deg)` }}>
            <CrownBody id={id} />
          </g>
          <path d={CRACK_D} fill="none" stroke="#1a0f00" strokeWidth="5" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - crack} />
          <path d={CRACK_D} fill="none" stroke="#ffe9a6" strokeWidth="1.6" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - crack} opacity={0.9} />
        </>
      ) : (
        <CrownBody id={id} />
      )}
    </svg>
  );
};

type Key = { t: number; x: number; y: number; s: number };
const CROWN_KEYS: Key[] = [
  { t: 0.15, x: 540, y: 740, s: 0.5 },
  { t: 2.0, x: 540, y: 740, s: 0.82 },
  { t: 2.7, x: 540, y: 400, s: 0.5 },
  { t: T.cut, x: 540, y: 400, s: 0.5 },
  { t: 6.55, x: 540, y: 395, s: 1.3 },
  { t: 9.65, x: 540, y: 395, s: 1.36 },
  { t: 10.3, x: 540, y: 250, s: 0.38 },
  { t: 14.9, x: 540, y: 250, s: 0.38 },
  { t: 15.55, x: 540, y: 415, s: 0.6 },
  { t: 18.9, x: 540, y: 415, s: 0.63 },
  { t: 19.55, x: 540, y: 390, s: 0.75 },
  { t: 22.95, x: 540, y: 390, s: 0.78 },
];
const crownAt = (t: number) => {
  if (t >= T.s7) {
    // kameraya hizla gelir; ekrani tamamen kaplar
    const u = clamp((t - T.s7) / 0.92);
    return { x: 540, y: 390 + (960 - 390) * easeInOut(u), s: 0.78 * Math.exp(Math.log(44 / 0.78) * u * u) };
  }
  if (t <= CROWN_KEYS[0].t) return CROWN_KEYS[0];
  for (let i = 0; i < CROWN_KEYS.length - 1; i++) {
    const a = CROWN_KEYS[i];
    const b = CROWN_KEYS[i + 1];
    if (t >= a.t && t < b.t) {
      const k = easeInOut((t - a.t) / (b.t - a.t));
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, s: a.s + (b.s - a.s) * k };
    }
  }
  return CROWN_KEYS[CROWN_KEYS.length - 1];
};

// ---------------------------------------------------------------- yardimci katmanlar
const LetterBadge: React.FC<{ letter: string; size?: number }> = ({ letter, size = 96 }) => (
  <div style={{ position: "absolute", left: -size * 0.2, top: -size * 0.2, width: size, height: size, borderRadius: "50%", background: GOLD, color: "#17120a", fontFamily, fontWeight: 700, fontSize: size * 0.72, lineHeight: `${size}px`, textAlign: "center", boxShadow: "0 6px 20px rgba(0,0,0,0.55)", zIndex: 3 }}>{letter}</div>
);

const Cover: React.FC<{ file: string; x: number; y: number; size: number; letter?: string; opacity?: number; scale?: number; origin?: string }> = ({ file, x, y, size, letter, opacity = 1, scale = 1, origin = "50% 50%" }) => (
  <div style={{ position: "absolute", left: x, top: y, width: size, height: size, opacity, scale, transformOrigin: origin }}>
    <Img src={staticFile(file)} style={{ width: size, height: size, objectFit: "cover", borderRadius: 8, display: "block", boxShadow: "0 22px 60px rgba(0,0,0,0.65)" }} />
    {letter ? <LetterBadge letter={letter} size={Math.max(64, size * 0.2)} /> : null}
  </div>
);

const Pill: React.FC<{ text: string; color?: string; size?: number }> = ({ text, color = "#fff", size = 38 }) => (
  <div style={{ display: "inline-block", padding: "8px 24px", borderRadius: 40, background: "rgba(10,10,14,0.78)", border: `3px solid ${GOLD}`, color, fontFamily: mono, fontWeight: 700, fontSize: size, letterSpacing: 2, whiteSpace: "nowrap" }}>{text}</div>
);

const Title: React.FC<{ title: string; artist: string; width: number; align?: "left" | "center"; max?: number }> = ({ title, artist, width, align = "center", max = 64 }) => (
  <div style={{ width, textAlign: align }}>
    <div style={{ fontFamily, fontWeight: 700, fontSize: fit(title, max, width, 0.5), lineHeight: 1.05, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 4px 22px rgba(0,0,0,0.9)" }}>{title}</div>
    <div style={{ fontFamily, fontWeight: 500, fontSize: fit(artist, 40, width, 0.46), color: "rgba(255,255,255,0.78)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 6 }}>{artist}</div>
  </div>
);

// ---------------------------------------------------------------- kilometre sayaci
const DIGIT_H = 140;
const DIGIT_W = 88;
const Wheel: React.FC<{ pos: number; blur: number; color: string }> = ({ pos, blur, color }) => {
  const p = ((pos % 10) + 10) % 10;
  return (
    <div style={{ width: DIGIT_W, height: DIGIT_H, overflow: "hidden", position: "relative", borderRadius: 12, background: "linear-gradient(180deg,#14141b,#0a0a0f 50%,#14141b)", border: "2px solid rgba(255,210,77,0.45)" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: DIGIT_W, translate: `0px ${-(p + 10) * DIGIT_H + 0}px`, filter: blur > 0.3 ? `blur(${blur}px)` : "none" }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} style={{ height: DIGIT_H, lineHeight: `${DIGIT_H}px`, textAlign: "center", fontFamily: mono, fontWeight: 700, fontSize: 112, color }}>{i % 10}</div>
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 72%, rgba(0,0,0,0.55) 100%)" }} />
    </div>
  );
};

const Odometer: React.FC<{ value: number; speed: number; snap: number; settle: number; color: string; digits: number }> = ({ value, speed, snap, settle, color, digits }) => {
  const cells: React.ReactNode[] = [];
  for (let i = digits - 1; i >= 0; i--) {
    // donerken surekli konum; kilitlenmeye dogru (settle 0->1) her teker tam rakama oturur
    const cont = value / 10 ** i;
    const pos = Math.floor(cont + 1e-6) + (cont - Math.floor(cont + 1e-6)) * (1 - settle) + snap;
    // alt hanelerde hiz arttikca bulaniklik
    const spin = speed / 10 ** i;
    cells.push(<Wheel key={i} pos={pos} blur={clamp(spin / 90, 0, 1) * 7} color={color} />);
    if (i > 0 && i % 3 === 0) cells.push(<div key={`d${i}`} style={{ width: 22, textAlign: "center", fontFamily: mono, fontWeight: 700, fontSize: 80, color: GOLD, alignSelf: "flex-end", lineHeight: "70px" }}>.</div>);
  }
  return <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>{cells}</div>;
};

// ---------------------------------------------------------------- VHS / CRT katmani
const Vhs: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const band = ((t * 330) % 2300) - 250;
  const nx = Math.floor(rnd(frame, 11) * 256);
  const ny = Math.floor(rnd(frame, 12) * 256);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile("zirve-noise.png")})`, backgroundPosition: `${nx}px ${ny}px`, opacity: 0.06 }} />
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.13) 0px, rgba(0,0,0,0.13) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)" }} />
      <div style={{ position: "absolute", left: 0, top: band, width: W, height: 90, background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,235,190,0.07), rgba(255,255,255,0))" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 78% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

// kisa "kaset sarma" kesmesi: yatay kara panel + bozuk seritler
const TapeWipe: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const u = clamp((t - 5.8) / 0.34);
  if (u <= 0 || u >= 1) return null;
  const x = -1400 + (W + 1400) * easeInOut(u);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 40 }}>
      <div style={{ position: "absolute", left: x, top: 0, width: 1400, height: 1920, background: "#000" }} />
      {Array.from({ length: 16 }).map((_, i) => {
        const y = rnd(frame, i + 30) * 1900;
        const h = 6 + rnd(frame, i + 60) * 46;
        return <div key={i} style={{ position: "absolute", left: x + 1400 - 260 - rnd(frame, i + 90) * 220, top: y, width: 520, height: h, background: i % 3 === 0 ? "rgba(255,235,190,0.55)" : i % 3 === 1 ? "rgba(255,40,90,0.45)" : "rgba(40,220,255,0.45)" }} />;
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- sahneler
const Scene1: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  const out = 1 - clamp((t - 2.0) / 0.3);
  const pop = easeOutBack((t - 0.2) / 0.4);
  const amp = t < 0.55 ? 7 * (1 - clamp((t - 0.2) / 0.35)) : t >= T.crack && t < T.crack + 0.25 ? 5 : 1.5;
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: 1010, textAlign: "center", opacity: clamp((t - 0.2) / 0.2) * out, scale: 0.9 + 0.1 * pop }}>
      {COPY.hook.map((line, i) => (
        <div key={i} style={{ fontFamily, fontWeight: 700, fontSize: fit(line, 132, 960, 0.5), lineHeight: 1.04, color: i === 0 ? "#fff" : GOLD, textShadow: fringe(amp), whiteSpace: "nowrap" }}>{line}</div>
      ))}
    </div>
  );
};

const Scene2: React.FC<{ t: number }> = ({ t }) => {
  const lineP = easeOutCubic((t - T.split) / 0.35);
  const aIn = easeOutCubic((t - T.split) / 0.55);
  const bP = easeOutCubic((t - T.bArrive) / 0.95);
  return (
    <>
      <div style={{ position: "absolute", left: 538, top: 470, width: 4, height: 800 * lineP, background: AMBER, boxShadow: `0 0 24px ${AMBER}`, opacity: 0.9 }} />
      <Cover file="zirve-cover-a.jpg" x={50} y={610} size={440} letter="A" opacity={aIn} scale={0.92 + 0.08 * aIn} />
      <div style={{ position: "absolute", left: 50, top: 540, opacity: aIn }}><Pill text={`${A.rank} NUMARA`} size={36} /></div>
      <div style={{ position: "absolute", left: 50, top: 1086, opacity: aIn }}><Title title={A.title} artist={A.artist} width={440} /></div>

      <div style={{ position: "absolute", left: 590, top: 540, opacity: bP }}><Pill text={`${B.rank} NUMARA`} size={36} /></div>
      <Cover file="zirve-cover-b.jpg" x={590 + (1 - bP) * 640} y={610} size={440} letter="B" opacity={clamp(bP * 2.2)} scale={0.5 + 0.5 * bP} />
      <div style={{ position: "absolute", left: 590, top: 1086, opacity: bP }}><Title title={B.title} artist={B.artist} width={440} /></div>
    </>
  );
};

const Scene3: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.cut;
  const inA = easeOutBack(u / 0.5);
  return (
    <>
      <div style={{ position: "absolute", left: 140, top: 330, width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,190,60,0.34) 0%, rgba(255,150,40,0.12) 45%, rgba(0,0,0,0) 70%)" }} />
      <Cover file="zirve-cover-a.jpg" x={240} y={560} size={600} letter="A" scale={0.9 + 0.1 * clamp(inA)} opacity={clamp(u / 0.25)} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1178, textAlign: "center", opacity: clamp((u - 0.3) / 0.3) }}>
        <div style={{ fontFamily, fontWeight: 500, fontSize: 54, letterSpacing: 12, color: GOLD, textShadow: "0 4px 18px rgba(0,0,0,0.9)" }}>TAHTTA:</div>
        <div style={{ fontFamily, fontWeight: 700, fontSize: fit(A.title, 108, 940, 0.52), lineHeight: 1.02, color: "#fff", whiteSpace: "nowrap", textShadow: fringe(1.5) }}>{A.title.toLocaleUpperCase("tr-TR")}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1392, display: "flex", justifyContent: "center", gap: 22, opacity: clamp((u - 0.6) / 0.3) }}>
        <Pill text="GÜNCEL SIRA: #1" size={36} />
        <Pill text={`${dots(A.streams)} DİNLENME`} color={GOLD} size={36} />
      </div>
    </>
  );
};

const Streaks: React.FC<{ t: number; speed: number }> = ({ t, speed }) => (
  <>
    {Array.from({ length: 22 }).map((_, i) => {
      const x = 60 + rnd(i, 3) * 960;
      const len = 120 + rnd(i, 4) * 260;
      const v = (500 + rnd(i, 5) * 900) * speed;
      const y = ((t * v + rnd(i, 6) * 2400) % 2400) - 300;
      return <div key={i} style={{ position: "absolute", left: x, top: y, width: 3, height: len, background: "linear-gradient(180deg, rgba(255,159,46,0), rgba(255,159,46,0.55))", opacity: clamp(speed * 1.2) * 0.8 }} />;
    })}
  </>
);

const Scene4: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.s4;
  const inB = easeOutCubic(u / 0.6);
  const run = clamp((t - T.odo0) / (T.lock - T.odo0));
  const e = easeOutCubic(run);
  const prev = GAP_PREV ?? GAP_NOW;
  const value = prev + (GAP_NOW - prev) * e;
  const speed = t < T.lock ? Math.abs(GAP_NOW - prev) * 3 * (1 - run) ** 2 * 6 + 40 * (t >= T.odo0 ? 1 : 0) : 0;
  const snap = t >= T.lock ? -0.14 * Math.exp(-(t - T.lock) * 14) * Math.cos((t - T.lock) * 38) : 0;
  const locked = t >= T.lock;
  const digits = String(Math.max(prev, GAP_NOW)).length;
  const head = COPY.s4;
  const amp = locked && t < T.lock + 0.25 ? 6 : 1.5;
  return (
    <>
      <Streaks t={t} speed={t < T.lock ? 1 : Math.exp(-(t - T.lock) * 6)} />
      <div style={{ position: "absolute", left: 40, right: 40, top: 330, textAlign: "center", opacity: clamp((u - 0.35) / 0.3), scale: 0.92 + 0.08 * easeOutBack((u - 0.35) / 0.4) }}>
        {head.map((line, i) => (
          <div key={i} style={{ fontFamily, fontWeight: 700, fontSize: fit(line, 100, 960, 0.5), lineHeight: 1.04, color: i === 0 ? "#fff" : GOLD, textShadow: fringe(amp), whiteSpace: "nowrap" }}>{line}</div>
        ))}
      </div>
      <Cover file="zirve-cover-b.jpg" x={310} y={565 + (1 - inB) * 90} size={460} letter="B" opacity={inB} />
      <div style={{ position: "absolute", left: 140, top: 1045, opacity: clamp((u - 0.2) / 0.3) }}><Title title={B.title} artist={B.artist} width={800} max={58} /></div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 1182, textAlign: "center", fontFamily: mono, fontWeight: 700, fontSize: 34, letterSpacing: 10, color: GOLD, opacity: clamp((t - 10.3) / 0.3) }}>FARK</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1228, opacity: clamp((t - 10.3) / 0.3), translate: `${locked ? (rnd(Math.floor(t * 30), 5) - 0.5) * 14 * Math.exp(-(t - T.lock) * 14) : 0}px 0px` }}>
        <Odometer value={value} speed={speed} snap={snap} settle={easeInOut((t - (T.lock - 0.45)) / 0.45)} color={locked ? GOLD : "#fff"} digits={digits} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1384, display: "flex", justifyContent: "center", alignItems: "center", gap: 18, opacity: clamp((t - 10.7) / 0.3) }}>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 30, letterSpacing: 2, color: "rgba(255,255,255,0.72)" }}>DİNLENME</div>
        {GAP_PREV != null && CLOSED != null ? (
          <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 30, letterSpacing: 1, color: "rgba(255,255,255,0.72)" }}>{`· DÜNKÜ LİSTE ${dots(GAP_PREV)}`}</div>
        ) : null}
        {locked && CLOSED != null ? (
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 36, color: CLOSED > 0 ? GREEN : AMBER, scale: easeOutBack((t - T.lock) / 0.35) }}>{`${CLOSED > 0 ? "−" : "+"}${dots(Math.abs(CLOSED))}`}</div>
        ) : null}
      </div>
    </>
  );
};

const LANE_A = 90;
const LANE_B = 590;
const LANE_W = 400;
const COVER = 300;
const TRACK_TOP = 950;
const FINISH_TOP = 580;

const Scene5: React.FC<{ t: number }> = ({ t }) => {
  const tm = Math.min(t, T.frz0);
  const u = easeInOut((tm - (T.s5 + 0.1)) / 1.4);
  const topA = TRACK_TOP - (TRACK_TOP - FINISH_TOP) * u;
  const topB = TRACK_TOP - (TRACK_TOP - FINISH_TOP) * u * SHARE_B;
  const grow = easeOutCubic((tm - 16.1) / 0.95);
  const frozen = t >= T.frz0;
  const after = t >= T.frz1;
  const q = clamp((t - T.frz1) / 0.3);
  const slam = after ? easeOutBack((t - T.frz1) / 0.35) : 0;
  return (
    <>
      {[LANE_A, LANE_B].map((x, i) => (
        <div key={i} style={{ position: "absolute", left: x, top: 470, width: LANE_W, height: 790, borderRadius: 18, background: "linear-gradient(180deg, rgba(255,159,46,0.10), rgba(255,255,255,0.03))", borderLeft: "2px dashed rgba(255,210,77,0.25)", borderRight: "2px dashed rgba(255,210,77,0.25)" }} />
      ))}
      <div style={{ position: "absolute", left: 70, top: 520, width: 940, height: 28, backgroundImage: "repeating-conic-gradient(#fff 0% 25%, #111 0% 50%)", backgroundSize: "28px 28px", opacity: 0.9, boxShadow: `0 0 26px ${GOLD}` }} />
      <Cover file="zirve-cover-a.jpg" x={LANE_A + (LANE_W - COVER) / 2} y={topA} size={COVER} letter="A" />
      <Cover file="zirve-cover-b.jpg" x={LANE_B + (LANE_W - COVER) / 2} y={topB} size={COVER} letter="B" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 950, textAlign: "center", opacity: clamp(grow * 3) }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 34, letterSpacing: 10, color: GOLD }}>FARK</div>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 150, lineHeight: 1.05, color: "#fff", scale: 0.55 + 0.45 * grow + (frozen && !after ? 0.04 : 0), textShadow: fringe(frozen ? 5 : 2) }}>{dots(GAP_NOW * grow)}</div>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 34, letterSpacing: 4, color: "rgba(255,255,255,0.75)" }}>DİNLENME</div>
      </div>
      {after ? (
        <div style={{ position: "absolute", left: 40, right: 40, top: 1222, textAlign: "center", opacity: q, scale: 0.9 + 0.1 * slam }}>
          {COPY.s5.map((line, i) => (
            <div key={i} style={{ fontFamily, fontWeight: 700, fontSize: fit(line, 96, 960, 0.5), lineHeight: 1.04, color: i === 0 ? "#fff" : GOLD, textShadow: fringe(t < T.frz1 + 0.3 ? 5 : 1.5), whiteSpace: "nowrap" }}>{line}</div>
          ))}
        </div>
      ) : null}
    </>
  );
};

const Scene6: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T.s6;
  const inK = easeOutBack(u / 0.5);
  const out = 1 - clamp((t - 23.25) / 0.3);
  // isik cizgisi iki kart arasinda gidip gelir
  const head = 300 + 480 * (0.5 - 0.5 * Math.cos(u * Math.PI)); // 2 sn'de bir gidis-donus
  const card = (side: "a" | "b", x: number, info: SideT) => (
    <div style={{ position: "absolute", left: x, top: 470, width: 460, height: 640, borderRadius: 26, background: "linear-gradient(180deg,#16161e,#0b0b10)", border: `3px solid ${GOLD}`, boxShadow: "0 0 40px rgba(255,190,60,0.25), 0 20px 50px rgba(0,0,0,0.6)", scale: clamp(inK), opacity: clamp(u / 0.2) }}>
      <Img src={staticFile(`zirve-cover-${side}.jpg`)} style={{ position: "absolute", left: 30, top: 30, width: 400, height: 400, objectFit: "cover", borderRadius: 8, display: "block" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 418, textAlign: "center", fontFamily, fontWeight: 700, fontSize: 200, lineHeight: 1, color: GOLD, textShadow: "0 6px 26px rgba(0,0,0,0.9)" }}>{side === "a" ? "A" : "B"}</div>
    </div>
  );
  return (
    <div style={{ opacity: out }}>
      {card("a", 60, A)}
      {card("b", 560, B)}
      <div style={{ position: "absolute", left: 290, top: 788, width: 500, height: 4, background: "rgba(255,210,77,0.2)", opacity: clamp(u / 0.4) }} />
      <div style={{ position: "absolute", left: head - 90, top: 780, width: 180, height: 20, borderRadius: 10, background: `radial-gradient(ellipse, #fff 0%, ${GOLD} 40%, rgba(255,210,77,0) 75%)`, boxShadow: `0 0 28px ${GOLD}`, opacity: clamp(u / 0.4) }} />
      <div style={{ position: "absolute", left: 40, right: 40, top: 1150, textAlign: "center", opacity: clamp((u - 0.3) / 0.3), scale: 0.92 + 0.08 * easeOutBack((u - 0.3) / 0.4) }}>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 168, lineHeight: 1.0, color: "#fff", textShadow: fringe(1.5), whiteSpace: "nowrap" }}>A MI, B Mİ?</div>
        <div style={{ fontFamily, fontWeight: 500, fontSize: 56, letterSpacing: 7, color: GOLD, marginTop: 10, textShadow: "0 4px 20px rgba(0,0,0,0.9)" }}>YORUMA TEK HARF YAZ</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- ana kompozisyon
export const Zirve: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  // sarsinti: catlak, kilitlenme, donma sonrasi
  const hit = (t0: number, a: number, k: number) => (t >= t0 ? a * Math.exp(-(t - t0) * k) : 0);
  const sa = hit(T.crack, 14, 9) + hit(T.lock, 10, 12) + hit(T.frz1, 8, 10);
  const shakeX = (rnd(frame, 21) - 0.5) * 2 * sa;
  const shakeY = (rnd(frame, 22) - 0.5) * 2 * sa;
  const push = inWin(t, T.cut, T.s4) ? 1 + 0.06 * clamp((t - T.cut) / (T.s4 - T.cut)) : 1;

  const crown = crownAt(t);
  const crownIn = clamp((t - 0.15) / 0.5) * (t < 0.6 ? (rnd(frame, 7) > 0.3 ? 1 : 0.2) : 1);
  const crack = clamp((t - T.crack) / 0.25);
  const bob = inWin(t, 19.55, T.s7) ? Math.sin((t - 19.55) * 3) * 9 : 0;
  const crownW = 400 * crown.s;
  const crownGlow = (inWin(t, T.cut, T.s4) ? 1.6 : 1) * (0.9 + bass * 0.5);

  const bgGlow = clamp((t - 0.3) / 1.2);
  const flashA = t >= T.crack ? Math.exp(-(t - T.crack) * 14) * 0.38 : 0;
  const frz = inWin(t, T.frz0, T.frz1);
  const flashFrame = frame === Math.round(T.flash * fps);
  const blackEnd = clamp((t - 23.72) / 0.22);

  const capNow = CAPS.find((c) => t >= c.t0 && t < c.t1);

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily }}>
      <Audio src={staticFile("zirve-audio.wav")} />

      {/* zemin: tam siyahtan koyu antrasite, amber isik */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 60% at 50% 42%, rgba(255,150,40,${(0.12 + bass * 0.1) * bgGlow}) 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, rgba(14,14,20,${bgGlow}) 0%, rgba(6,6,9,${bgGlow}) 100%)` }} />

      <AbsoluteFill style={{ transform: `translate(${shakeX}px, ${shakeY}px) scale(${push})`, transformOrigin: "50% 46%" }}>
        {t >= 0.9 && t < T.s7 ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: 104, textAlign: "center", fontFamily: mono, fontWeight: 500, fontSize: 28, letterSpacing: 9, color: "rgba(255,255,255,0.5)", opacity: clamp((t - 0.9) / 0.4) }}>@YENISARKILARIM</div>
        ) : null}
        {t >= T.split && t < T.s7 ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: 146, textAlign: "center", fontFamily: mono, fontWeight: 500, fontSize: 28, letterSpacing: 3, color: "rgba(255,210,77,0.8)", opacity: clamp((t - T.split) / 0.3) }}>{`TÜRKİYE GÜNLÜK LİSTE · ${data.chartDate}`}</div>
        ) : null}

        {inWin(t, T.split, T.cut) ? <Scene2 t={t} /> : null}
        {inWin(t, T.cut, T.s4) ? <Scene3 t={t} /> : null}
        {inWin(t, T.s4, T.s5) ? <Scene4 t={t} /> : null}
        {inWin(t, T.s5, T.s6) ? <Scene5 t={t} /> : null}
        {inWin(t, T.s6, T.s7 + 0.6) ? <Scene6 t={t} /> : null}

        {/* tac: tek katman, sahneler boyunca konum/olcek degistirir (kapaklarin arkasi/ustu icin kapaklardan ONCE cizilmez; z-index ile ayarli) */}
        {t >= 0.15 ? (
          <div style={{ position: "absolute", left: crown.x - crownW / 2, top: crown.y - (crownW * 0.75) / 2 + bob, opacity: crownIn, zIndex: inWin(t, T.cut, T.s4) ? -1 : 6 }}>
            <Crown id="main" width={crownW} crack={crack} glow={crownGlow} />
          </div>
        ) : null}

        {t < T.split ? <Scene1 t={t} frame={frame} /> : null}
      </AbsoluteFill>

      {/* kamera onunde tacin kapladigi karartma ve donma */}
      <AbsoluteFill style={{ background: "#000", opacity: blackEnd, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: `rgba(255,236,190,${flashA})`, pointerEvents: "none" }} />
      {frz ? (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", left: 0, top: rnd(frame, i + 40) * 1900, width: W, height: 4 + rnd(frame, i + 70) * 22, background: "rgba(255,255,255,0.1)" }} />
          ))}
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.18)" }} />
        </AbsoluteFill>
      ) : null}

      <TapeWipe t={t} frame={frame} />
      <div style={{ opacity: clamp(t / 0.5) * (1 - blackEnd) }}><Vhs t={t} frame={frame} /></div>

      {/* yanmis altyazi: en fazla 4-5 kelimelik satirlar, alt arayuzun ustunde */}
      {capNow && !flashFrame ? (
        <div style={{ position: "absolute", left: 60, right: 60, top: 1488, textAlign: "center", fontFamily, fontWeight: 700, fontSize: 62, lineHeight: 1.08, color: "#fff", textShadow: "0 4px 0 rgba(0,0,0,0.9), 0 0 26px rgba(0,0,0,0.95)", whiteSpace: "nowrap" }}>{capNow.text}</div>
      ) : null}

      {/* bir karelik "SONUC YARIN" flasi */}
      {flashFrame ? (
        <AbsoluteFill style={{ background: "#fff", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily, fontWeight: 700, fontSize: 200, lineHeight: 1.0, color: "#000", textAlign: "center" }}>SONUÇ<br />YARIN</div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

export const ZIRVE_SECONDS = DUR;
