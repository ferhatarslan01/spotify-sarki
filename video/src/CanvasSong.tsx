import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-cs.json";

// "Spotify arka videosu" sablonu: sarkinin Spotify Canvas'i (dikey dongu video) tam ekran ve ON PLANDA.
// Video hicbir donusum gormez (yaklasma/buyume yok, karartma yok): src/canvasSong.js onu 1080x1920'ye Lanczos ile hazirlar, burada piksel pikseldir.
// Yazilar videoyu kapatmasin diye: kucuk bir bilgi blogu yalnizca ilk saniyelerde gorunur, sonra cekilir; geriye sadece kucuk bir imza kalir.
// Ses sarkinin onizlemesi. Tek sarkilik olaylar (yeni cikti, liste hareketi, yil donumu...) icin.

const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

const DUR = data.durationSeconds as number;
const SHOW_START = 0.35; // bilgi blogu girisi
const SHOW_END = 4.6; // bilgi blogu cikisi baslar
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeInCubic = (x: number) => clamp(x) ** 3;
const fit = (s: string, max: number, width: number, k = 0.5) => Math.min(max, Math.floor(width / (Math.max(1, s.length) * k)));

export const CanvasSong: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const accent = `hsl(${data.hue}, 88%, 62%)`;

  // 0 -> 1 girer, tut, 1 -> 0 cikar
  const inP = easeOutCubic((t - SHOW_START) / 0.5);
  const outP = easeInCubic((t - SHOW_END) / 0.55);
  const vis = clamp(inP) * (1 - clamp(outP));
  const slide = (1 - clamp(inP)) * 40 + clamp(outP) * 40;
  const fadeOut = clamp((t - (DUR - 0.25)) / 0.25);
  const title = String(data.title);
  const artist = String(data.artist);
  const shadow = "0 2px 14px rgba(0,0,0,0.75), 0 0 3px rgba(0,0,0,0.6)";

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily }}>
      <Audio src={staticFile("cs-audio.wav")} />

      {/* Spotify Canvas: tam ekran, donusumsuz */}
      <OffthreadVideo src={staticFile("cs-canvas.mp4")} muted style={{ width: 1080, height: 1920, objectFit: "cover" }} />

      {/* yalnizca bilgi blogunun arkasinda, o gorunurken, cok hafif golge (okunabilirlik) */}
      <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 26%)", opacity: vis, pointerEvents: "none" }} />

      {/* bilgi blogu: kucuk, TikTok alt arayuzunun ustunde, sadece ilk saniyelerde */}
      <div style={{ position: "absolute", left: 56, right: 150, top: 1330, opacity: vis, translate: `0px ${slide}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ display: "inline-flex", padding: "6px 20px", borderRadius: 30, background: accent, color: "#0b0b10", fontWeight: 700, fontSize: 30, letterSpacing: 3 }}>{String(data.label)}</div>
          {data.chip ? <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 26, letterSpacing: 2, color: "#fff", textShadow: shadow }}>{String(data.chip)}</div> : null}
        </div>
        <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
          <Img src={staticFile("cs-cover.jpg")} style={{ width: 128, height: 128, borderRadius: 14, objectFit: "cover", boxShadow: "0 8px 24px rgba(0,0,0,0.55)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: fit(title, 62, 720, 0.47), lineHeight: 1.05, color: "#fff", textShadow: shadow, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>
            <div style={{ fontWeight: 500, fontSize: fit(artist, 38, 720, 0.45), color: "rgba(255,255,255,0.92)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: shadow }}>{artist}</div>
          </div>
        </div>
      </div>

      {/* kalici imza: kucuk, yari saydam */}
      <div style={{ position: "absolute", left: 56, top: 150, fontFamily: mono, fontWeight: 500, fontSize: 22, letterSpacing: 4, color: "rgba(255,255,255,0.7)", textShadow: shadow }}>@YENISARKILARIM</div>

      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
