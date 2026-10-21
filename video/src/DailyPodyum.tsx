import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-dy.json";

// Gunluk Top 5 sablonu: PODYUM. 5 -> 1 basamaklar yukselir, kapaklar tepeye konar; #1'de spot isigi, tac ve konfeti.
// Tum rakamlar gercek gunluk liste verisidir (sira degisimi, kac gun listede, gunluk dinlenme).
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

type Item = { rank: number; title: string; artist: string; streams: string; change: number | string | null; days: number | null; peak: number | null; peakTimes: number; moveText: string; daysText: string; peakText: string; cover: string; hue: number; at: number; len: number };
const ITEMS = data.items as unknown as Item[];
const BANDS = data.bands as number[][];
const INTRO = data.intro;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const N = ITEMS.length;

const GOLD = "#ffcf3a";
const GREEN = "#2ee59a";
const DOWN = "#ff5c6c";
const FLOOR_Y = 1480;

// slot (soldan saga): 4 2 1 3 5
const SLOT_X: Record<number, number> = { 4: 30, 2: 236, 1: 442, 3: 648, 5: 854 };
const BLOCK_H: Record<number, number> = { 1: 590, 2: 490, 3: 405, 4: 335, 5: 270 };
const BW = 196;
const COVER = 184;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const bounce = (x: number) => {
  const y = clamp(x);
  if (y < 1 / 2.75) return 7.5625 * y * y;
  if (y < 2 / 2.75) return 7.5625 * (y - 1.5 / 2.75) ** 2 + 0.75;
  if (y < 2.5 / 2.75) return 7.5625 * (y - 2.25 / 2.75) ** 2 + 0.9375;
  return 7.5625 * (y - 2.625 / 2.75) ** 2 + 0.984375;
};
const hash = (a: number, b = 0): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));

const Tri: React.FC<{ color: string; down?: boolean; size?: number }> = ({ color, down, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{ rotate: down ? "180deg" : "0deg", flexShrink: 0 }}>
    <path d="M10 3 L18 16 H2 Z" fill={color} />
  </svg>
);

const Move: React.FC<{ change: number | string | null; size: number }> = ({ change, size }) => {
  if (change === null || change === undefined) return null;
  if (change === "NEW") return <span style={{ background: GOLD, color: "#1a1300", fontFamily: inter, fontWeight: 800, fontSize: size * 0.8, letterSpacing: 2, padding: `${size * 0.05}px ${size * 0.36}px`, borderRadius: size * 0.3 }}>YENİ</span>;
  if (change === 0) return <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: mono, fontWeight: 700, fontSize: size }}>=</span>;
  const n = Number(change);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.22, color: n > 0 ? GREEN : DOWN, fontFamily: mono, fontWeight: 700, fontSize: size }}>
      <Tri color={n > 0 ? GREEN : DOWN} down={n < 0} size={size * 0.85} />
      {Math.abs(n)}
    </span>
  );
};

const Chip: React.FC<{ children: React.ReactNode; gold?: boolean }> = ({ children, gold }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 56, padding: "0 22px", borderRadius: 28, background: gold ? "rgba(255,207,58,0.2)" : "rgba(255,255,255,0.12)", border: `2px solid ${gold ? GOLD : "rgba(255,255,255,0.3)"}`, color: "#fff", fontFamily: inter, fontWeight: 800, fontSize: 27, whiteSpace: "nowrap" }}>{children}</div>
);

export const DailyPodyum: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.35);
  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const outroT = clamp((t - OUTRO) / 0.6);

  const heroAt = ITEMS[N - 1].at;
  const heroDt = t - heroAt;
  const heroOn = t >= heroAt + 0.4;
  const idx = ITEMS.filter((it) => t >= it.at - 0.1).length - 1;
  const cur = idx >= 0 ? ITEMS[idx] : null;
  const isHero = idx === N - 1;
  const hue0 = ITEMS[N - 1].hue;

  // spot isiklari: hero'da parlar
  const beam = isHero ? 0.55 + 0.25 * clamp(heroDt / 0.5) : 0.22 + 0.06 * Math.sin(t * 1.3);
  const sweep = isHero ? 0 : Math.sin(t * 0.9) * 120;

  const introOut = clamp((t - (INTRO - 0.4)) / 0.4);

  return (
    <AbsoluteFill style={{ background: "#07050f", fontFamily }}>
      <Audio src={staticFile("dy-soundtrack.wav")} />

      {/* sahne */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #0b0822 0%, #170d36 48%, #0a0618 100%)", opacity: fadeIn }} />
      <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: "absolute", left: 0, top: 0, opacity: fadeIn }}>
        <defs>
          <linearGradient id="beamL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={isHero ? "rgba(255,226,140,0.9)" : "rgba(190,170,255,0.7)"} />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id="bb">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <g opacity={beam}>
          <polygon points={`40,-60 200,-60 ${540 + sweep + 160},${FLOOR_Y} ${540 + sweep - 160},${FLOOR_Y}`} fill="url(#beamL)" />
          <polygon points={`880,-60 1040,-60 ${540 - sweep + 160},${FLOOR_Y} ${540 - sweep - 160},${FLOOR_Y}`} fill="url(#beamL)" />
        </g>
      </svg>
      {/* zemin */}
      <div style={{ position: "absolute", left: 0, top: FLOOR_Y, width: 1080, height: 1920 - FLOOR_Y, background: "linear-gradient(180deg, #1d1342 0%, #07040f 100%)", borderTop: "3px solid rgba(255,255,255,0.18)", opacity: fadeIn }} />

      {/* ust baslik */}
      <div style={{ position: "absolute", left: 40, top: 66, fontFamily: mono, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: "rgba(255,255,255,0.7)", opacity: fadeIn * (1 - outroT) }}>SPOTIFY TR · GÜNLÜK TOP 5</div>
      <div style={{ position: "absolute", right: 40, top: 66, fontFamily: mono, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: "rgba(255,255,255,0.7)", opacity: fadeIn * (1 - outroT) }}>{data.date}</div>

      {/* intro */}
      {t < INTRO ? (
        <div style={{ position: "absolute", left: 0, top: 640, width: 1080, textAlign: "center", opacity: 1 - introOut }}>
          {["BUGÜNÜN", "PODYUMU"].map((l, i) => {
            const p = easeOutCubic((t - 0.2 - i * 0.28) / 0.45);
            return (
              <div key={l} style={{ overflow: "hidden", height: 215 }}>
                <div style={{ translate: `0px ${(1 - p) * 230}px`, fontWeight: 700, fontSize: 200, lineHeight: 1.05, letterSpacing: 4, color: i === 1 ? GOLD : "#fff" }}>{l}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* o anki sarki bilgisi */}
      {cur ? (
        <div key={cur.rank} style={{ position: "absolute", left: 50, top: 150, width: 980, opacity: (1 - outroT) * clamp((t - cur.at + 0.1) / 0.3), translate: `0px ${(1 - easeOutCubic((t - cur.at + 0.1) / 0.45)) * 70}px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 170, lineHeight: 0.95, color: isHero ? GOLD : `hsl(${cur.hue},90%,62%)`, textShadow: `0 0 50px ${isHero ? "rgba(255,207,58,0.5)" : `hsla(${cur.hue},90%,55%,0.5)`}` }}>#{cur.rank}</div>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: isHero ? GOLD : "rgba(255,255,255,0.65)" }}>{isHero ? "BUGÜNÜN ZİRVESİ" : "PODYUMA GİRDİ"}</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: fit(cur.title, 92, 980, 0.5), lineHeight: 1.02, color: "#fff", whiteSpace: "nowrap", marginTop: 4 }}>{cur.title}</div>
          <div style={{ fontFamily: inter, fontWeight: 700, fontSize: fit(cur.artist, 48, 980, 0.52), color: `hsl(${cur.hue},90%,66%)`, whiteSpace: "nowrap", marginTop: 2 }}>{cur.artist}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center" }}>
            {cur.change !== null ? (
              <Chip>
                <Move change={cur.change} size={30} />
                <span style={{ fontSize: 24, opacity: 0.85 }}>{cur.change === 0 ? "AYNI SIRA" : ""}</span>
              </Chip>
            ) : null}
            {cur.daysText ? <Chip>{cur.daysText}</Chip> : null}
            <Chip gold={isHero}>{cur.streams} DİNLENME</Chip>
          </div>
        </div>
      ) : null}

      {/* podyum */}
      {ITEMS.map((it) => {
        const h = BLOCK_H[it.rank];
        const x = SLOT_X[it.rank];
        const top = FLOOR_Y - h;
        const rise = easeOutCubic((t - (it.at - 0.15)) / 0.55);
        const drop = t >= it.at + 0.3 ? bounce((t - (it.at + 0.3)) / 0.5) : 0;
        const shown = t >= it.at - 0.15;
        if (!shown) return null;
        const hero = it.rank === 1;
        const col = hero ? GOLD : `hsl(${it.hue},75%,52%)`;
        const colD = hero ? "#b8860b" : `hsl(${it.hue},70%,30%)`;
        return (
          <div key={it.rank} style={{ opacity: 1 - outroT * 0.9 }}>
            {/* blok */}
            <div style={{ position: "absolute", left: x, top: top + (1 - rise) * (h + 60), width: BW, height: h, background: `linear-gradient(180deg, ${col} 0%, ${colD} 100%)`, borderRadius: "6px 6px 0 0", boxShadow: "0 30px 60px rgba(0,0,0,0.55), inset 0 0 0 3px rgba(255,255,255,0.18)" }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: BW, height: 22, background: "rgba(255,255,255,0.28)", borderRadius: "6px 6px 0 0" }} />
              <div style={{ position: "absolute", left: 0, top: 40, width: BW, textAlign: "center", fontWeight: 700, fontSize: hero ? 190 : 150, lineHeight: 1, color: "rgba(255,255,255,0.92)", textShadow: "0 6px 20px rgba(0,0,0,0.35)" }}>{it.rank}</div>
              <div style={{ position: "absolute", left: 0, bottom: 18, width: BW, display: "flex", justifyContent: "center" }}>
                <Move change={it.change} size={30} />
              </div>
            </div>
            {/* kapak */}
            <div style={{ position: "absolute", left: x + (BW - COVER) / 2, top: top - COVER - 14 - (1 - drop) * 520 + (1 - rise) * (h + 60), width: COVER, height: COVER, borderRadius: 14, overflow: "hidden", border: `5px solid ${hero ? GOLD : "#fff"}`, boxShadow: `0 20px 50px rgba(0,0,0,0.6), 0 0 ${hero ? 80 : 24}px ${hero ? "rgba(255,207,58,0.6)" : `hsla(${it.hue},90%,55%,0.5)`}`, opacity: drop > 0 ? 1 : 0, scale: hero ? 1.12 : 1, transformOrigin: "50% 100%" }}>
              <Img src={staticFile(it.cover)} style={{ width: COVER - 10, height: COVER - 10, objectFit: "cover" }} />
            </div>
            {/* isim levhasi */}
            <div style={{ position: "absolute", left: x, top: FLOOR_Y + 24, width: BW, opacity: clamp((t - it.at - 0.5) / 0.3), textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 30, lineHeight: 1.05, color: "#fff", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.title}</div>
              <div style={{ fontFamily: inter, fontWeight: 600, fontSize: 22, color: "rgba(255,255,255,0.65)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.artist}</div>
            </div>
          </div>
        );
      })}

      {/* tac + konfeti */}
      {heroOn ? (
        <svg width="150" height="94" viewBox="0 0 24 15" style={{ position: "absolute", left: SLOT_X[1] + BW / 2 - 75, top: FLOOR_Y - BLOCK_H[1] - COVER * 1.12 - 14 - 100 + Math.sin(t * 4) * 4, opacity: clamp((t - heroAt - 0.4) / 0.3) * (1 - outroT) }}>
          <path d="M2 14 L1 4 L7 9 L12 1 L17 9 L23 4 L22 14 Z" fill={GOLD} />
        </svg>
      ) : null}
      {heroOn && heroDt < 4
        ? Array.from({ length: 70 }).map((_, i) => {
            const dtc = t - (heroAt + 0.45);
            if (dtc < 0) return null;
            const vx = (rnd(i, 1) - 0.5) * 1500;
            const vy = -(500 + rnd(i, 2) * 1000);
            const x = SLOT_X[1] + BW / 2 + vx * dtc * 0.7;
            const y = FLOOR_Y - BLOCK_H[1] - 200 + vy * dtc + 0.5 * 1700 * dtc * dtc;
            const colors = [GOLD, "#fff", "#ff5c8a", "#5ee7ff", "#a78bfa"];
            return <div key={i} style={{ position: "absolute", left: x, top: y, width: 12 + rnd(i, 4) * 14, height: 20 + rnd(i, 5) * 14, background: colors[i % colors.length], rotate: `${(rnd(i, 3) - 0.5) * 1400 * dtc}deg`, opacity: clamp((3.4 - dtc) / 0.8) }} />;
          })
        : null}

      {/* marka */}
      <div style={{ position: "absolute", left: 0, bottom: 0, width: 1080, height: 84, background: "#e11d2e", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", boxSizing: "border-box", opacity: fadeIn }}>
        <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 6, color: "#fff" }}>@YENISARKILARIM</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 50 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ width: 10, height: 8 + (bands[i + 1] ?? 0) * 40 + bass * 4, background: "#fff", opacity: 0.55 + 0.45 * (bands[i + 1] ?? 0) }} />
          ))}
        </div>
      </div>

      {/* kapanis */}
      {outroT > 0 ? (
        <>
          <AbsoluteFill style={{ background: `rgba(7,5,15,${0.94 * outroT})` }} />
          <div style={{ position: "absolute", left: 0, top: 640, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
            <div style={{ display: "inline-block", background: GOLD, color: "#1a1300", fontWeight: 700, fontSize: 52, letterSpacing: 8, padding: "6px 36px" }}>ZİRVE · {ITEMS[N - 1].title.toLocaleUpperCase("tr")}</div>
            <div style={{ fontWeight: 700, fontSize: 140, lineHeight: 1.0, color: "#fff", marginTop: 54 }}>SENCE YARIN</div>
            <div style={{ fontWeight: 700, fontSize: 140, lineHeight: 1.0, color: `hsl(${hue0},92%,62%)` }}>PODYUMDA KİM?</div>
          </div>
        </>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: t >= heroAt + 0.4 ? 0.7 * Math.exp(-11 * (t - heroAt - 0.4)) : 0, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
