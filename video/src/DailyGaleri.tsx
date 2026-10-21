import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadOldStd } from "@remotion/google-fonts/OldStandardTT";
import data from "./data-dy.json";

// Gunluk Top 5 sablonu: GALERI (muze sergisi). Kamera duvar boyunca 5'ten 1'e kayar; her kapak cerceveli bir eser, altinda muze etiketi.
// Etiket bilgileri gercek gunluk veridir: dinlenme, listede kac gun, en yuksek sira, sira degisimi.
const { fontFamily: cinzel } = loadCinzel("normal", { weights: ["400", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: playfair } = loadPlayfair("normal", { weights: ["700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: playfairIt } = loadPlayfair("italic", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: oldstd } = loadOldStd("normal", { weights: ["400", "700"], subsets: ["latin", "latin-ext"] });

type Item = { rank: number; title: string; artist: string; streams: string; total: string; change: number | string | null; days: number | null; peak: number | null; peakTimes: number; moveText: string; daysText: string; peakText: string; cover: string; hue: number; at: number; len: number };
const ITEMS = data.items as unknown as Item[]; // 5, 4, 3, 2, 1 sirasiyla
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const N = ITEMS.length;

const WALL_STEP = 1050; // eserler arasi mesafe (dunya px)
const GOLD1 = "#f3d675";
const GOLD2 = "#8a6a1f";
const INK = "#2a2118";
const PLAQUE = "#f8f4ea";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeInOut = (x: number) => (clamp(x) < 0.5 ? 4 * clamp(x) ** 3 : 1 - (-2 * clamp(x) + 2) ** 3 / 2);
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const hash = (a: number, b = 0): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));

const PAN = 0.8; // kamera kayma suresi

export const DailyGaleri: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const fadeIn = clamp(t / 0.5);
  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const outroT = clamp((t - OUTRO) / 0.6);

  // kamera: i. eser ITEMS[i].at aninda ortalanmis olur; oncesinde PAN sure kayar
  let camIdx = 0;
  for (let i = 1; i < N; i++) {
    const p = easeInOut((t - (ITEMS[i].at - PAN)) / PAN);
    camIdx += p;
  }
  const cam = camIdx * WALL_STEP;
  const cur = ITEMS.filter((it) => t >= it.at - 0.15).length - 1;
  const heroAt = ITEMS[N - 1].at;

  return (
    <AbsoluteFill style={{ background: "#14110d" }}>
      <Audio src={staticFile("dy-soundtrack.wav")} />

      {/* duvar */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #cfc8ba 0%, #bdb5a4 55%, #a39b89 100%)", opacity: fadeIn }} />
      {/* duvar sinirlari (kamerayla kayar) */}
      {Array.from({ length: 8 }).map((_, k) => (
        <div key={k} style={{ position: "absolute", left: 540 + (k - 1) * WALL_STEP + WALL_STEP / 2 - cam, top: 0, width: 6, height: 1560, background: "rgba(0,0,0,0.08)", boxShadow: "2px 0 0 rgba(255,255,255,0.25)" }} />
      ))}
      {/* tavan silmesi */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 120, background: "linear-gradient(180deg, #efe9dc 0%, #d9d1c1 70%, rgba(0,0,0,0.12) 100%)", opacity: fadeIn }} />
      {/* zemin + sus tahtasi */}
      <div style={{ position: "absolute", left: 0, top: 1560, width: 1080, height: 40, background: "linear-gradient(180deg, #5a4a3a 0%, #3b2f24 100%)", opacity: fadeIn }} />
      <div style={{ position: "absolute", left: 0, top: 1600, width: 1080, height: 320, background: "linear-gradient(180deg, #6b4a2c 0%, #3a2616 100%)", opacity: fadeIn }}>
        {Array.from({ length: 14 }).map((_, k) => (
          <div key={k} style={{ position: "absolute", left: ((540 + (k - 3) * 220 - cam * 1.25) % 1700) - 300, top: 0, width: 3, height: 320, background: "rgba(0,0,0,0.25)" }} />
        ))}
        <div style={{ position: "absolute", left: 0, top: 120, width: 1080, height: 3, background: "rgba(0,0,0,0.2)" }} />
        <div style={{ position: "absolute", left: 0, top: 230, width: 1080, height: 3, background: "rgba(0,0,0,0.2)" }} />
      </div>

      {/* eserler */}
      {ITEMS.map((it, i) => {
        const hero = i === N - 1;
        const S = hero ? 720 : 620; // resim kenari
        const frameW = S + 2 * 38 + 2 * 24;
        const cx = 540 + i * WALL_STEP - cam;
        if (cx < -frameW || cx > 1080 + frameW) return null;
        const top = hero ? 220 : 290;
        const lit = clamp((t - (it.at - 0.45)) / 0.4) * (cur === i ? 1 : 0.0) + (cur > i ? 0.18 : 0) + (cur < i ? 0.12 : 0);
        const arriveP = easeOutCubic((t - it.at) / 0.5);
        return (
          <div key={it.rank}>
            {/* spot isigi konisi */}
            <svg width="1080" height="1700" viewBox="0 0 1080 1700" style={{ position: "absolute", left: cx - 540, top: 0, opacity: lit * 0.9 }}>
              <defs>
                <linearGradient id={`cone${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="rgba(255,244,214,0.95)" />
                  <stop offset="1" stopColor="rgba(255,244,214,0)" />
                </linearGradient>
              </defs>
              <polygon points={`${540 - 30},120 ${540 + 30},120 ${540 + frameW * 0.78},${top + S + 150} ${540 - frameW * 0.78},${top + S + 150}`} fill={`url(#cone${i})`} opacity="0.55" />
            </svg>
            <div style={{ position: "absolute", left: cx - 60, top: 96, width: 120, height: 34, borderRadius: "0 0 40px 40px", background: "linear-gradient(180deg, #3a2f20, #1b140c)", boxShadow: lit > 0.5 ? "0 0 36px rgba(255,236,170,0.9)" : "none" }} />
            {/* cerceve */}
            <div style={{ position: "absolute", left: cx - frameW / 2, top, width: frameW, height: frameW, background: `linear-gradient(135deg, ${GOLD2} 0%, ${GOLD1} 28%, ${GOLD2} 52%, ${GOLD1} 78%, ${GOLD2} 100%)`, boxShadow: "0 50px 80px rgba(0,0,0,0.4), inset 0 0 0 4px rgba(0,0,0,0.35)", padding: 38, boxSizing: "border-box", filter: `brightness(${0.62 + 0.38 * Math.min(1, lit + (cur === i ? 0.3 : 0))})` }}>
              <div style={{ width: "100%", height: "100%", background: "#f4efe2", padding: 24, boxSizing: "border-box", boxShadow: "inset 0 0 0 3px rgba(0,0,0,0.25), inset 0 8px 24px rgba(0,0,0,0.35)" }}>
                <Img src={staticFile(it.cover)} style={{ width: S, height: S, objectFit: "cover", display: "block", boxShadow: "0 0 0 2px rgba(0,0,0,0.4)" }} />
              </div>
              {hero ? <div style={{ position: "absolute", left: "50%", top: -34, translate: "-50% 0", background: "#8e1a24", color: "#f8f4ea", fontFamily: cinzel, fontWeight: 700, fontSize: 30, letterSpacing: 8, padding: "6px 28px", border: `3px solid ${GOLD1}` }}>SERGİNİN YILDIZI</div> : null}
            </div>
            {/* muze etiketi */}
            <div style={{ position: "absolute", left: cx - 340, top: top + frameW + 50, width: 680, background: PLAQUE, boxShadow: "0 14px 34px rgba(0,0,0,0.35)", border: "2px solid rgba(0,0,0,0.25)", padding: "20px 32px 22px", opacity: arriveP, translate: `0px ${(1 - arriveP) * 30}px` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: cinzel, fontWeight: 700, fontSize: 26, letterSpacing: 5, color: "#8e1a24" }}>
                <span>ESER Nº {it.rank}</span>
                <span style={{ color: INK, opacity: 0.6 }}>{data.date}</span>
              </div>
              <div style={{ fontFamily: playfairIt, fontWeight: 700, fontSize: fit(it.title, 68, 610, 0.5), color: INK, lineHeight: 1.05, marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</div>
              <div style={{ fontFamily: oldstd, fontWeight: 700, fontSize: fit(it.artist, 38, 610, 0.5), color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.artist}</div>
              <div style={{ borderTop: "2px solid rgba(42,33,24,0.35)", margin: "12px 0 10px" }} />
              <div style={{ fontFamily: oldstd, fontWeight: 400, fontSize: 29, lineHeight: 1.3, color: INK }}>
                Teknik: Spotify Türkiye günlük listesi
                <br />
                Dinlenme: <b>{it.streams}</b>
                {it.daysText ? <> · Listede <b>{it.daysText.toLocaleLowerCase("tr")}</b></> : null}
                <br />
                {it.peakText ? <>{it.peakText.charAt(0) + it.peakText.slice(1).toLocaleLowerCase("tr")}</> : null}
                {it.moveText ? <> · {it.moveText.charAt(0) + it.moveText.slice(1).toLocaleLowerCase("tr")}</> : null}
              </div>
            </div>
          </div>
        );
      })}

      {/* toz parcaciklari (isik huzmesinde) */}
      {Array.from({ length: 28 }).map((_, i) => {
        const x = (rnd(i, 1) * 1080 + t * (6 + rnd(i, 2) * 10) - cam * 0.2 + 5000) % 1080;
        const y = (rnd(i, 3) * 1500 - t * (8 + rnd(i, 4) * 14) + 5000) % 1500;
        return <div key={i} style={{ position: "absolute", left: x, top: y + 100, width: 3, height: 3, borderRadius: "50%", background: "rgba(255,244,214,0.9)", opacity: 0.18 + 0.4 * rnd(i, 5) }} />;
      })}

      {/* ust baslik */}
      <div style={{ position: "absolute", left: 0, top: 22, width: 1080, textAlign: "center", fontFamily: cinzel, fontWeight: 700, fontSize: 30, letterSpacing: 10, color: "#3b2f24", opacity: fadeIn * (1 - outroT) }}>SPOTIFY TR · GÜNÜN SERGİSİ</div>

      {/* ilerleme noktalari */}
      <div style={{ position: "absolute", left: 0, top: 1800, width: 1080, display: "flex", justifyContent: "center", gap: 18, opacity: fadeIn * (1 - outroT) }}>
        {ITEMS.map((it, i) => (
          <div key={it.rank} style={{ width: i === cur ? 70 : 18, height: 18, borderRadius: 9, background: i === cur ? GOLD1 : "rgba(255,255,255,0.35)" }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, top: 1850, width: 1080, textAlign: "center", fontFamily: cinzel, fontWeight: 700, fontSize: 28, letterSpacing: 8, color: "rgba(255,255,255,0.8)", opacity: fadeIn * (1 - outroT) }}>@YENISARKILARIM</div>

      {/* kapanis */}
      {outroT > 0 ? (
        <>
          <AbsoluteFill style={{ background: `rgba(14,11,8,${0.93 * outroT})` }} />
          <div style={{ position: "absolute", left: 0, top: 650, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
            <div style={{ display: "inline-block", border: `3px solid ${GOLD1}`, color: GOLD1, fontFamily: cinzel, fontWeight: 700, fontSize: 40, letterSpacing: 8, padding: "6px 30px" }}>SERGİNİN YILDIZI · {ITEMS[N - 1].title.toLocaleUpperCase("tr")}</div>
            <div style={{ fontFamily: playfair, fontWeight: 700, fontSize: 120, lineHeight: 1.05, color: "#f8f4ea", marginTop: 56 }}>SENCE SERGİNİN</div>
            <div style={{ fontFamily: playfair, fontWeight: 700, fontSize: 120, lineHeight: 1.05, color: GOLD1 }}>YILDIZI KİM?</div>
          </div>
        </>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: t >= heroAt && t < heroAt + 0.6 ? 0.28 * (1 - (t - heroAt) / 0.6) : 0, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
