import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-cs.json";

// "Spotify arka videosu" sablonu: sarkinin Spotify Canvas'i (dikey dongu video) tam ekran arka plan, ustte olay etiketi, altta kapak + sarki bilgisi.
// Tek sarkilik olaylar (yeni cikti, liste hareketi, yil donumu...) icin; ses sarkinin onizlemesi. Canvas src/canvasSong.js'te sureye kadar donguye alinir.

const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

const BANDS = data.bands as number[][];
const DUR = data.durationSeconds as number;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (s: string, max: number, width: number, k = 0.5) => Math.min(max, Math.floor(width / (Math.max(1, s.length) * k)));

export const CanvasSong: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;
  const accent = `hsl(${data.hue}, 88%, 62%)`;

  const pill = easeOutBack((t - 0.15) / 0.45);
  const info = easeOutCubic((t - 0.35) / 0.55);
  const chip = easeOutBack((t - 0.8) / 0.45);
  const fadeOut = clamp((t - (DUR - 0.35)) / 0.35);
  const title = String(data.title);
  const artist = String(data.artist);

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily }}>
      <Audio src={staticFile("cs-audio.wav")} />

      {/* Spotify Canvas: tam ekran, hafif yaklasma */}
      <AbsoluteFill style={{ scale: 1 + 0.035 * clamp(t / DUR) + 0.006 * bass }}>
        <OffthreadVideo src={staticFile("cs-canvas.mp4")} muted style={{ width: 1080, height: 1920, objectFit: "cover" }} />
      </AbsoluteFill>

      {/* okunabilirlik icin ust ve alt karartma */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.72) 100%)" }} />

      {/* olay etiketi */}
      <div style={{ position: "absolute", left: 60, top: 150, opacity: clamp(pill), scale: 0.85 + 0.15 * clamp(pill), transformOrigin: "left center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "12px 30px", borderRadius: 40, background: accent, color: "#0b0b10", fontWeight: 700, fontSize: 46, letterSpacing: 4, boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}>
          {String(data.label)}
        </div>
      </div>
      <div style={{ position: "absolute", right: 60, top: 160, fontFamily: mono, fontWeight: 500, fontSize: 26, letterSpacing: 4, color: "rgba(255,255,255,0.75)", textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>@YENISARKILARIM</div>

      {/* sarki bilgisi: kapak + baslik + sanatci (TikTok alt arayuzunun ustunde) */}
      <div style={{ position: "absolute", left: 60, right: 100, top: 1170, display: "flex", gap: 30, alignItems: "center", opacity: info, translate: `0px ${(1 - info) * 60}px` }}>
        <Img src={staticFile("cs-cover.jpg")} style={{ width: 190, height: 190, borderRadius: 20, objectFit: "cover", boxShadow: "0 16px 40px rgba(0,0,0,0.6)", scale: 1 + 0.02 * bass }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: fit(title, 86, 700, 0.48), lineHeight: 1.04, color: "#fff", textShadow: "0 4px 24px rgba(0,0,0,0.85)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>
          <div style={{ fontWeight: 500, fontSize: fit(artist, 50, 700, 0.46), color: "rgba(255,255,255,0.88)", marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 3px 16px rgba(0,0,0,0.85)" }}>{artist}</div>
        </div>
      </div>
      {data.chip ? (
        <div style={{ position: "absolute", left: 60, top: 1400, opacity: clamp(chip), scale: 0.85 + 0.15 * clamp(chip), transformOrigin: "left center" }}>
          <div style={{ display: "inline-block", padding: "8px 26px", borderRadius: 14, background: "rgba(10,10,14,0.7)", border: `3px solid ${accent}`, fontFamily: mono, fontWeight: 700, fontSize: 40, letterSpacing: 2, color: "#fff" }}>{String(data.chip)}</div>
        </div>
      ) : null}

      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
