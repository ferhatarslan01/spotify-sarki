import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-wk.json";

// Haftalik liste sablonu: HIT LISTESI GERI SAYIMI. 10 -> 1; ustte o anki sarki (sira degisimi, kacinci hafta, haftalik dinlenme),
// altta liste asagidan yukari dolar; #1 final sahnesi. Tum rakamlar gercek haftalik liste verisidir.
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

type Item = { rank: number; title: string; artist: string; streams: string; change: number | string | null; weeks: number | null; peak: number | null; peakTimes: number; cover: string; hue: number };
const ITEMS = data.items as unknown as Item[];
const BANDS = data.bands as number[][];
const START = data.start;
const STEP = data.step;
const HERO = data.hero;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const N = ITEMS.length;

const RED = "#e11d2e";
const GREEN = "#2ee59a";
const DOWN = "#ff5c6c";
const GOLD = "#ffcf3a";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeInCubic = (x: number) => clamp(x) ** 3;
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));
const hueLerp = (a: number, b: number, k: number) => {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + d * k + 360) % 360;
};

const Tri: React.FC<{ color: string; down?: boolean; size?: number }> = ({ color, down, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{ rotate: down ? "180deg" : "0deg", flexShrink: 0 }}>
    <path d="M10 3 L18 16 H2 Z" fill={color} />
  </svg>
);

const Move: React.FC<{ change: number | string | null; size: number }> = ({ change, size }) => {
  if (change === null || change === undefined) return null;
  if (change === "NEW") return <span style={{ background: GOLD, color: "#1a1300", fontFamily: inter, fontWeight: 800, fontSize: size * 0.8, letterSpacing: 2, padding: `${size * 0.05}px ${size * 0.36}px`, borderRadius: size * 0.3 }}>YENİ</span>;
  if (change === 0) return <span style={{ color: "rgba(255,255,255,0.6)", fontFamily: mono, fontWeight: 700, fontSize: size }}>=</span>;
  const n = Number(change);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.22, color: n > 0 ? GREEN : DOWN, fontFamily: mono, fontWeight: 700, fontSize: size }}>
      <Tri color={n > 0 ? GREEN : DOWN} down={n < 0} size={size * 0.85} />
      {Math.abs(n)}
    </span>
  );
};

const Chip: React.FC<{ children: React.ReactNode; bg?: string; color?: string; border?: string }> = ({ children, bg = "rgba(255,255,255,0.12)", color = "#fff", border = "rgba(255,255,255,0.28)" }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 66, padding: "0 26px", borderRadius: 34, background: bg, border: `2px solid ${border}`, color, fontFamily: inter, fontWeight: 800, fontSize: 32, letterSpacing: 1, whiteSpace: "nowrap" }}>{children}</div>
);

export const WeeklyCountdown: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.35);
  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const outroT = clamp((t - OUTRO) / 0.6);

  const idx = t < START ? -1 : Math.min(N - 1, Math.floor((t - START) / STEP));
  const cur = idx >= 0 ? ITEMS[idx] : null;
  const prev = idx > 0 ? ITEMS[idx - 1] : null;
  const itemStart = START + Math.max(0, idx) * STEP;
  const lt = t - itemStart;
  const isHero = idx === N - 1 && t >= HERO;
  const hlt = t - HERO;

  const hue0 = ITEMS[N - 1]?.hue ?? 30;
  const hueNow = cur ? hueLerp(prev?.hue ?? hue0, cur.hue, easeOutCubic(lt / 0.35)) : hue0;
  const accent = `hsl(${hueNow}, 92%, 60%)`;

  // ---- intro
  const introLines = ["BU HAFTA", "TÜRKİYE'DE", "EN ÇOK DİNLENEN", `${N} ŞARKI`];
  const introOut = easeInCubic((t - (START - 0.35)) / 0.35);

  const cardIn = easeOutCubic(lt / 0.3);
  const rankSize = cur ? Math.min(470, 520 / (String(cur.rank).length * 0.52)) : 470;
  const titleSize = cur ? fit(cur.title, 100, 940, 0.5) : 90;
  const artistSize = cur ? fit(cur.artist, 54, 940, 0.52) : 50;

  return (
    <AbsoluteFill style={{ background: "#07060f", fontFamily }}>
      <Audio src={staticFile("wk-soundtrack.wav")} />

      {/* arka plan: o anki sarkinin tonu */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 100% 55% at 50% 22%, hsla(${hueNow},80%,${isHero ? 40 : 32}%,${0.6 + bass * 0.15}) 0%, #07060f 72%)`, opacity: fadeIn }} />
      <AbsoluteFill style={{ background: "repeating-linear-gradient(115deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 90px, rgba(0,0,0,0) 90px, rgba(0,0,0,0) 180px)" }} />

      {/* ust cubuk */}
      <div style={{ position: "absolute", left: 0, top: 60, width: 1080, display: "flex", alignItems: "center", opacity: fadeIn }}>
        <div style={{ background: RED, color: "#fff", fontWeight: 700, fontSize: 42, letterSpacing: 5, padding: "8px 28px 8px 40px" }}>HAFTALIK</div>
        <div style={{ background: "#fff", color: "#07060f", fontWeight: 700, fontSize: 42, letterSpacing: 5, padding: "8px 28px" }}>TOP {N}</div>
        <div style={{ marginLeft: "auto", paddingRight: 40, fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: "rgba(255,255,255,0.8)" }}>{data.date}</div>
      </div>
      <div style={{ position: "absolute", left: 40, top: 152, fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 6, color: "rgba(255,255,255,0.55)", opacity: fadeIn }}>SPOTIFY TÜRKİYE · HİT LİSTESİ</div>

      {/* intro */}
      {t < START ? (
        <div style={{ position: "absolute", left: 60, top: 300, opacity: 1 - introOut, translate: `${-introOut * 400}px 0px` }}>
          {introLines.map((l, i) => {
            const p = easeOutCubic((t - 0.25 - i * 0.28) / 0.45);
            const size = i === 2 ? 128 : i === 3 ? 230 : i === 0 ? 150 : 170;
            return (
              <div key={l} style={{ overflow: "hidden", height: size * 1.04 }}>
                <div style={{ translate: `0px ${(1 - p) * size * 1.1}px`, fontWeight: 700, fontSize: size, lineHeight: 1.04, color: i === 3 ? `hsl(${hue0},92%,62%)` : "#fff", letterSpacing: 2, whiteSpace: "nowrap" }}>{l}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ---- o anki sarki ---- */}
      {cur ? (
        <>
          {/* onceki kart cikis */}
          {prev && lt < 0.28 ? (
            <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1040, translate: `${-easeInCubic(lt / 0.28) * 1100}px 0px`, opacity: 1 - lt / 0.28 }}>
              <div style={{ position: "absolute", left: 560, top: 190, width: 480, textAlign: "right", fontFamily: fontFamily, fontWeight: 700, fontSize: 470, lineHeight: 1, color: `hsl(${prev.hue},90%,60%)`, opacity: 0.9 }}>{prev.rank}</div>
              <div style={{ position: "absolute", left: 60, top: 250, width: 470, height: 470, borderRadius: 18, overflow: "hidden" }}>
                <Img src={staticFile(prev.cover)} style={{ width: 470, height: 470, objectFit: "cover" }} />
              </div>
            </div>
          ) : null}

          <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1040, opacity: (1 - outroT) * (lt < 0.28 && prev ? 0 : 1), translate: `${(1 - cardIn) * 1100}px 0px` }}>
            {/* dev sira numarasi */}
            <div
              style={{
                position: "absolute",
                left: 540,
                top: 205 - (470 - rankSize) / 2,
                width: 500,
                textAlign: "right",
                fontWeight: 700,
                fontSize: rankSize,
                lineHeight: 1,
                color: isHero ? GOLD : accent,
                textShadow: `0 0 ${50 + bass * 50}px ${isHero ? "rgba(255,207,58,0.55)" : `hsla(${hueNow},90%,55%,0.55)`}`,
                scale: 1 + (isHero ? 0.05 * Math.exp(-5 * hlt) : 0.0),
              }}
            >
              {isHero ? "1" : cur.rank}
            </div>
            {isHero ? (
              <svg width="150" height="110" viewBox="0 0 24 18" style={{ position: "absolute", left: 800, top: 130 }}>
                <path d="M2 16 L1 5 L7 10 L12 2 L17 10 L23 5 L22 16 Z" fill={GOLD} />
              </svg>
            ) : null}
            {/* kapak */}
            <div style={{ position: "absolute", left: 60, top: 250, width: 470, height: 470, rotate: `${-3 + (1 - cardIn) * -6}deg`, scale: (isHero ? 1.04 : 1) * (1 + bass * 0.02), borderRadius: 20, overflow: "hidden", border: `6px solid ${isHero ? GOLD : "#fff"}`, boxShadow: `0 30px 90px hsla(${hueNow},90%,50%,0.55), 0 20px 60px rgba(0,0,0,0.6)` }}>
              <Img src={staticFile(cur.cover)} style={{ width: 458, height: 458, objectFit: "cover" }} />
              {isHero ? <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 62%)", translate: `${(clamp(hlt / 0.9) * 2 - 1) * 700}px 0px`, mixBlendMode: "screen", opacity: hlt < 0.9 ? 1 : 0 }} /> : null}
            </div>
            {/* baslik */}
            <div style={{ position: "absolute", left: 60, top: 760, width: 960 }}>
              {isHero ? <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 8, color: GOLD, marginBottom: 6 }}>HAFTANIN ZİRVESİ</div> : null}
              <div style={{ fontWeight: 700, fontSize: titleSize, lineHeight: 1.0, color: "#fff", whiteSpace: "nowrap" }}>{cur.title}</div>
              <div style={{ fontFamily: inter, fontWeight: 700, fontSize: artistSize, color: accent, marginTop: 6, whiteSpace: "nowrap" }}>{cur.artist}</div>
            </div>
            {/* rozetler */}
            <div style={{ position: "absolute", left: 60, top: 960, display: "flex", gap: 14, alignItems: "center" }}>
              {cur.change !== null ? (
                <Chip bg="rgba(0,0,0,0.35)">
                  <Move change={cur.change} size={32} />
                </Chip>
              ) : null}
              {cur.weeks ? <Chip>{cur.weeks === 1 ? "İLK HAFTA" : `${cur.weeks}. HAFTA`}</Chip> : null}
              <Chip bg={isHero ? "rgba(255,207,58,0.2)" : "rgba(255,255,255,0.12)"} border={isHero ? GOLD : "rgba(255,255,255,0.28)"}>
                {cur.streams} DİNLENME
              </Chip>
            </div>
          </div>
        </>
      ) : null}

      {/* ---- liste ---- */}
      <div style={{ position: "absolute", left: 40, top: 1050, width: 1000, opacity: fadeIn * (1 - outroT * 0.9) }}>
        {Array.from({ length: N }).map((_, i) => {
          const rank = i + 1;
          const k = N - 1 - i; // bu siranin ITEMS indeksi
          const it = ITEMS[k];
          const rowStart = START + k * STEP;
          const shown = t >= rowStart;
          const p = easeOutCubic((t - rowStart) / 0.3);
          const isCur = idx === k;
          return (
            <div key={rank} style={{ position: "relative", height: 66, marginBottom: 2, display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: shown ? (isCur ? `hsla(${it.hue},85%,50%,0.32)` : "rgba(255,255,255,0.07)") : "transparent", border: shown ? (isCur ? `2px solid hsla(${it.hue},90%,65%,0.9)` : "2px solid rgba(255,255,255,0.06)") : "2px dashed rgba(255,255,255,0.08)", opacity: shown ? p : 1 }} />
              <div style={{ width: 84, textAlign: "center", fontFamily: mono, fontWeight: 700, fontSize: 36, color: shown ? (rank === 1 ? GOLD : "#fff") : "rgba(255,255,255,0.18)", position: "relative" }}>{rank}</div>
              {shown ? (
                <div style={{ position: "relative", display: "flex", alignItems: "center", width: 916, opacity: p, translate: `${(1 - p) * -60}px 0px` }}>
                  <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", marginRight: 18, flexShrink: 0 }}>
                    <Img src={staticFile(it.cover)} style={{ width: 52, height: 52, objectFit: "cover" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontFamily: inter, fontWeight: 700, fontSize: 31, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {it.title}
                    <span style={{ fontWeight: 500, fontSize: 25, color: "rgba(255,255,255,0.6)", marginLeft: 14 }}>{it.artist}</span>
                  </div>
                  <div style={{ width: 96, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                    <Move change={it.change} size={26} />
                  </div>
                  <div style={{ width: 130, textAlign: "right", fontFamily: mono, fontWeight: 700, fontSize: 27, color: "rgba(255,255,255,0.85)", flexShrink: 0 }}>{it.streams}</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* marka */}
      <div style={{ position: "absolute", left: 0, bottom: 0, width: 1080, height: 84, background: RED, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", boxSizing: "border-box", opacity: fadeIn }}>
        <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 6, color: "#fff" }}>@YENISARKILARIM</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 50 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ width: 10, height: 8 + (bands[i + 1] ?? 0) * 40, background: "#fff", opacity: 0.55 + 0.45 * (bands[i + 1] ?? 0) }} />
          ))}
        </div>
      </div>

      {/* kapanis */}
      {outroT > 0 ? (
        <>
          <AbsoluteFill style={{ background: `rgba(7,6,15,${0.94 * outroT})` }} />
          <div style={{ position: "absolute", left: 0, top: 620, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
            <div style={{ display: "inline-block", background: GOLD, color: "#1a1300", fontWeight: 700, fontSize: 52, letterSpacing: 8, padding: "6px 36px" }}>#1 · {ITEMS[N - 1].title.toLocaleUpperCase("tr")}</div>
            <div style={{ fontWeight: 700, fontSize: 140, lineHeight: 1.0, color: "#fff", marginTop: 54 }}>SENCE HAFTAYA</div>
            <div style={{ fontWeight: 700, fontSize: 140, lineHeight: 1.0, color: `hsl(${hue0},92%,62%)` }}>ZİRVE KİMİN?</div>
          </div>
        </>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: t >= HERO ? 0.75 * Math.exp(-11 * hlt) : 0, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
