import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-player.json";

const { fontFamily } = loadOswald("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});
const { fontFamily: mono } = loadMono("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});

const BANDS = data.bands as number[][];
// Sessiz mod: ses onizlemesi bulunamadiginda kapak hareketi (oynatici ogeleri ve ses yok).
const SILENT = Boolean((data as { silent?: boolean }).silent);
const LABEL = (data as { label?: string }).label || "ŞİMDİ ÇALIYOR";
const DURATION = data.durationSeconds;
const SIZE = 1080;
const MARGIN = 64;
const clampOpt = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// kare kapak + oynatici arayuzu ("sarki caliyormus gibi")
export const CoverPlayer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = (bands[0] + bands[1] + bands[2] + bands[3]) / 4 || 0;

  const progress = Math.min(1, t / DURATION);
  const slideUp = interpolate(t, [0.1, 0.7], [1, 0], { ...clampOpt, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const fadeOut = interpolate(t, [DURATION - 0.6, DURATION], [0, 1], clampOpt);
  const coverScale = 1.005 + 0.035 * progress + bass * 0.012;

  const titleSize = Math.min(78, 940 / (Math.max(data.title.length, 8) * 0.46));
  const artistSize = Math.min(46, 940 / (Math.max(data.artist.length, 8) * 0.5));

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily }}>
      {SILENT ? null : <Audio src={staticFile("player-soundtrack.wav")} />}

      {/* kapak */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={staticFile("player-cover.jpg")}
          style={{ width: SIZE, height: SIZE, objectFit: "cover", scale: coverScale }}
        />
      </AbsoluteFill>

      {/* alt gradyan */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: SIZE,
          height: 620,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 42%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* ust sol: simdi caliyor */}
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          top: 56,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 24px 12px 20px",
          borderRadius: 40,
          background: "rgba(0,0,0,0.55)",
          translate: `0px ${-slideUp * 140}px`,
        }}
      >
        <div style={{ display: SILENT ? "none" : "flex", alignItems: "flex-end", gap: 4, height: 30 }}>
          {[2, 6, 10, 14].map((b, i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 8 + (bands[b] ?? 0) * 22,
                borderRadius: 3,
                background: "#1DB954",
              }}
            />
          ))}
        </div>
        <div style={{ fontFamily, fontWeight: 500, fontSize: 30, letterSpacing: 4, color: "#fff" }}>
          {LABEL}
        </div>
      </div>

      {/* alt: oynatici */}
      <div
        style={{
          position: "absolute",
          left: MARGIN,
          right: MARGIN,
          bottom: 56,
          translate: `0px ${slideUp * 220}px`,
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: titleSize,
            lineHeight: 1.05,
            color: "#fff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {data.title}
        </div>
        <div
          style={{
            fontFamily,
            fontWeight: 500,
            fontSize: artistSize,
            color: "rgba(255,255,255,0.78)",
            marginTop: 4,
          }}
        >
          {data.artist}
        </div>

        {/* ilerleme cubugu, sureler ve kontroller (sessiz modda yok) */}
        <div style={{ display: SILENT ? "none" : "block" }}>
        <div style={{ position: "relative", height: 24, marginTop: 30 }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 8,
              height: 8,
              borderRadius: 4,
              background: "rgba(255,255,255,0.28)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 8,
              width: `${progress * 100}%`,
              height: 8,
              borderRadius: 4,
              background: "#fff",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `calc(${progress * 100}% - 12px)`,
              top: 0,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            fontFamily: mono,
            fontWeight: 500,
            fontSize: 26,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <span>{mmss(t)}</span>
          <span>{`-${mmss(Math.max(0, DURATION - t))}`}</span>
        </div>

        {/* kontroller */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 64,
            marginTop: 22,
          }}
        >
          <svg width="52" height="52" viewBox="0 0 52 52">
            <rect x="8" y="10" width="6" height="32" rx="2" fill="#fff" fillOpacity="0.9" />
            <polygon points="44,10 44,42 18,26" fill="#fff" fillOpacity="0.9" />
          </svg>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              scale: 1 + bass * 0.05,
            }}
          >
            <div style={{ width: 11, height: 38, borderRadius: 3, background: "#000" }} />
            <div style={{ width: 11, height: 38, borderRadius: 3, background: "#000" }} />
          </div>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <rect x="38" y="10" width="6" height="32" rx="2" fill="#fff" fillOpacity="0.9" />
            <polygon points="8,10 8,42 34,26" fill="#fff" fillOpacity="0.9" />
          </svg>
        </div>
        </div>
      </div>

      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
