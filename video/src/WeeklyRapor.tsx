import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-wk.json";

// Haftalik liste sablonu: HAFTANIN RAPORU. Story formatinda kartlar: zirve, en cok yukselen, en yuksek yeni giris, listenin kidemlisi, Top 5 ozeti.
// Kartlar haftalik liste verisinden turetilir; tum rakamlar gercektir.
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

type Big = { value: number; decimals: number; prefix: string; suffix: string };
type Row = { rank: number; title: string; artist: string; change: number | string | null; weeks: number | null; cover: string };
type Card = { type: string; label: string; title: string; artist: string; rank: number; cover: string; hue: number; big: Big; caption: string; pills: string[]; rows: Row[] };
const CARDS = data.cards as unknown as Card[];
const STARTS = data.cardStarts as number[];
const BANDS = data.bands as number[][];
const INTRO = data.intro;
const CARD_LEN = data.cardLen;
const TOP5_LEN = data.top5Len;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const N = CARDS.length;

const GREEN = "#2ee59a";
const DOWN = "#ff5c6c";
const GOLD = "#ffcf3a";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));

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

const bigText = (b: Big, k: number) => `${b.prefix}${(b.value * k).toFixed(b.decimals).replace(".", ",")}${b.suffix}`;

export const WeeklyRapor: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.35);
  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const outroT = clamp((t - OUTRO) / 0.6);

  const ci = t < INTRO ? -1 : Math.max(0, STARTS.filter((s) => s <= t + 0.0001).length - 1);
  const card = ci >= 0 ? CARDS[ci] : null;
  const dur = ci === N - 1 ? TOP5_LEN : CARD_LEN;
  const lt = card ? t - STARTS[ci] : 0;
  const inP = easeOutCubic(lt / 0.35);
  const hue = card?.hue ?? CARDS[0].hue;
  const accent = `hsl(${hue}, 90%, 60%)`;

  // story cubuklari
  const barP = (k: number) => (t >= OUTRO ? 1 : ci < 0 ? 0 : k < ci ? 1 : k === ci ? clamp(lt / dur) : 0);

  const introLines = [
    { t: "HAFTALIK", s: 230, c: "#fff" },
    { t: "RAPOR", s: 230, c: `hsl(${CARDS[0].hue},92%,62%)` },
  ];

  return (
    <AbsoluteFill style={{ background: "#06050c", fontFamily }}>
      <Audio src={staticFile("wk-soundtrack.wav")} />

      {/* arka plan: kapak bulaniklastirilmis */}
      {card ? (
        <AbsoluteFill style={{ opacity: fadeIn }}>
          <Img src={staticFile(card.cover)} style={{ position: "absolute", left: -300, top: -200, width: 1680, height: 2320, objectFit: "cover", filter: "blur(70px) saturate(1.5) brightness(0.55)", scale: 1 + 0.12 * clamp(lt / dur) + 0.04 * bass }} />
          <AbsoluteFill style={{ background: `linear-gradient(180deg, hsla(${hue},60%,14%,0.55) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.72) 100%)` }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 100% 55% at 50% 30%, hsla(${CARDS[0].hue},80%,34%,0.6) 0%, #06050c 72%)`, opacity: fadeIn }} />
      )}

      {/* story cubuklari + baslik */}
      <div style={{ position: "absolute", left: 50, top: 64, width: 980, display: "flex", gap: 10, opacity: fadeIn * (1 - outroT) }}>
        {CARDS.map((_, k) => (
          <div key={k} style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.28)", overflow: "hidden" }}>
            <div style={{ width: `${barP(k) * 100}%`, height: 8, background: "#fff" }} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 50, top: 100, width: 980, display: "flex", alignItems: "center", gap: 18, opacity: fadeIn * (1 - outroT) }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e11d2e", color: "#fff", fontFamily: inter, fontWeight: 800, fontSize: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
        <div>
          <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 34, color: "#fff" }}>Spotify TR · Haftalık Rapor</div>
          <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 24, color: "rgba(255,255,255,0.65)" }}>{data.date}</div>
        </div>
      </div>

      {/* intro */}
      {t < INTRO ? (
        <div style={{ position: "absolute", left: 60, top: 600, opacity: 1 - clamp((t - (INTRO - 0.3)) / 0.3) }}>
          {introLines.map((l, i) => {
            const p = easeOutCubic((t - 0.15 - i * 0.25) / 0.45);
            return (
              <div key={l.t} style={{ overflow: "hidden", height: l.s * 1.04 }}>
                <div style={{ translate: `0px ${(1 - p) * l.s * 1.1}px`, fontWeight: 700, fontSize: l.s, lineHeight: 1.04, color: l.c, letterSpacing: 4 }}>{l.t}</div>
              </div>
            );
          })}
          <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 44, letterSpacing: 6, color: "rgba(255,255,255,0.85)", marginTop: 30, opacity: clamp((t - 0.9) / 0.4) }}>{N - 1} HIZLI GERÇEK + TOP 5</div>
        </div>
      ) : null}

      {/* ---- bilgi karti ---- */}
      {card && card.type !== "top5" ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: 1 - outroT, translate: `${(1 - inP) * 1100}px 0px` }}>
          <div style={{ position: "absolute", left: 50 + (1 - inP) * -60, top: 250 }}>
            <div style={{ display: "inline-block", background: accent, color: "#0a0612", fontWeight: 700, fontSize: 46, letterSpacing: 6, padding: "6px 30px", borderRadius: 10 }}>{card.label}</div>
          </div>
          <div style={{ position: "absolute", left: 240, top: 350, width: 600, height: 600, rotate: `${-4 + (1 - inP) * -8}deg`, scale: (0.8 + 0.2 * easeOutBack(lt / 0.55)) * (1 + bass * 0.02), borderRadius: 34, overflow: "hidden", border: "6px solid rgba(255,255,255,0.9)", boxShadow: `0 40px 110px hsla(${hue},90%,50%,0.55), 0 24px 70px rgba(0,0,0,0.6)` }}>
            <Img src={staticFile(card.cover)} style={{ width: 588, height: 588, objectFit: "cover" }} />
            {card.rank === 1 ? <div style={{ position: "absolute", right: 18, top: 18, background: GOLD, color: "#1a1300", fontWeight: 700, fontSize: 40, letterSpacing: 3, padding: "2px 18px", borderRadius: 8 }}>#1</div> : null}
          </div>
          <div style={{ position: "absolute", left: 0, top: 985, width: 1080, textAlign: "center", opacity: clamp((lt - 0.3) / 0.25) }}>
            <div style={{ fontWeight: 700, fontSize: Math.min(300, 960 / (bigText(card.big, 1).length * 0.5)), lineHeight: 1.0, color: "#fff", textShadow: `0 0 60px hsla(${hue},90%,55%,0.7)`, scale: 1 + 0.06 * Math.exp(-6 * Math.max(0, lt - 1.2)) }}>{bigText(card.big, easeOutCubic((lt - 0.35) / 0.9))}</div>
            <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 38, letterSpacing: 6, color: "rgba(255,255,255,0.82)", marginTop: 16 }}>{card.caption}</div>
          </div>
          <div style={{ position: "absolute", left: 60, top: 1390, width: 960, textAlign: "center", opacity: clamp((lt - 0.6) / 0.3), translate: `0px ${(1 - easeOutCubic((lt - 0.6) / 0.4)) * 40}px` }}>
            <div style={{ fontWeight: 700, fontSize: fit(card.title, 96, 960, 0.5), lineHeight: 1.0, color: "#fff", whiteSpace: "nowrap" }}>{card.title}</div>
            <div style={{ fontFamily: inter, fontWeight: 700, fontSize: fit(card.artist, 48, 960, 0.52), color: accent, marginTop: 8, whiteSpace: "nowrap" }}>{card.artist}</div>
          </div>
          <div style={{ position: "absolute", left: 0, top: 1600, width: 1080, display: "flex", justifyContent: "center", gap: 18, opacity: clamp((lt - 0.95) / 0.3) }}>
            {card.pills.map((p) => (
              <div key={p} style={{ height: 70, display: "inline-flex", alignItems: "center", padding: "0 28px", borderRadius: 36, background: "rgba(0,0,0,0.42)", border: "2px solid rgba(255,255,255,0.35)", color: "#fff", fontFamily: inter, fontWeight: 800, fontSize: 30, letterSpacing: 1, whiteSpace: "nowrap" }}>
                {p}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- Top 5 ozeti ---- */}
      {card && card.type === "top5" ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: 1 - outroT, translate: `${(1 - inP) * 1100}px 0px` }}>
          <div style={{ position: "absolute", left: 50, top: 250 }}>
            <div style={{ display: "inline-block", background: accent, color: "#0a0612", fontWeight: 700, fontSize: 46, letterSpacing: 6, padding: "6px 30px", borderRadius: 10 }}>{card.label}</div>
          </div>
          {card.rows.map((r, i) => {
            const p = easeOutCubic((lt - 0.25 - i * 0.2) / 0.4);
            const top = 360 + i * 232;
            return (
              <div key={r.rank} style={{ position: "absolute", left: 50, top, width: 980, height: 208, borderRadius: 26, background: i === 0 ? "rgba(255,207,58,0.18)" : "rgba(0,0,0,0.42)", border: i === 0 ? `3px solid ${GOLD}` : "2px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", gap: 26, padding: "0 26px", boxSizing: "border-box", opacity: p, translate: `${(1 - p) * 500}px 0px` }}>
                <div style={{ width: 100, textAlign: "center", fontWeight: 700, fontSize: 130, lineHeight: 1, color: i === 0 ? GOLD : "#fff" }}>{r.rank}</div>
                <div style={{ width: 158, height: 158, borderRadius: 16, overflow: "hidden", flexShrink: 0, border: "3px solid rgba(255,255,255,0.7)" }}>
                  <Img src={staticFile(r.cover)} style={{ width: 152, height: 152, objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: fit(r.title, 62, 520, 0.5), lineHeight: 1.05, color: "#fff", whiteSpace: "nowrap" }}>{r.title}</div>
                  <div style={{ fontFamily: inter, fontWeight: 600, fontSize: fit(r.artist, 38, 520, 0.54), color: "rgba(255,255,255,0.72)", whiteSpace: "nowrap" }}>{r.artist}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 14, alignItems: "center" }}>
                    <Move change={r.change} size={30} />
                    {r.weeks ? <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 26, color: "rgba(255,255,255,0.7)" }}>{r.weeks === 1 ? "İLK HAFTA" : `${r.weeks}. HAFTA`}</span> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* marka */}
      <div style={{ position: "absolute", left: 0, top: 1830, width: 1080, textAlign: "center", fontFamily: mono, fontWeight: 700, fontSize: 30, letterSpacing: 7, color: "rgba(255,255,255,0.85)", opacity: fadeIn * (1 - outroT) }}>@YENISARKILARIM</div>

      {/* kapanis */}
      {outroT > 0 ? (
        <>
          <AbsoluteFill style={{ background: `rgba(6,5,12,${0.94 * outroT})` }} />
          <div style={{ position: "absolute", left: 0, top: 700, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
            <div style={{ fontWeight: 700, fontSize: 150, lineHeight: 1.0, color: "#fff" }}>SENCE HAFTAYA</div>
            <div style={{ fontWeight: 700, fontSize: 150, lineHeight: 1.0, color: `hsl(${CARDS[0].hue},92%,62%)` }}>ZİRVE KİMİN?</div>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 40, letterSpacing: 7, color: GOLD, marginTop: 56 }}>@YENISARKILARIM</div>
          </div>
        </>
      ) : null}

      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
