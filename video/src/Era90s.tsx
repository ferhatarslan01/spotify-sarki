import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import { Anniversary } from "./Anniversary";
import data from "./data-era90.json";

const { fontFamily } = loadOswald("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});
const { fontFamily: mono } = loadMono("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});

const BANDS = data.bands as number[][];
const INTRO = data.introSeconds; // giris suresi (sn)
const S1_END = data.scene1End; // 1. sahne bitisi / 2. sahne baslangici
const KNOB = data.knobAt; // elin dugmeye dokundugu an: muzik ve ses cubugu buradan baslar
const FADE = 0.45; // sahneler arasi capraz erime
const AMBER = "#ffb42a";
const GREEN = "#3ddc84";
const RED = "#ff5a5f";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const hash = (a: number, b = 0): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;

// radyo sesi: dugme cevrilince yukselir (ses efektiyle ayni egri: prepAnniversaryEra)
const volume = (t: number) => (t < KNOB ? 0.06 : 0.06 + 0.94 * clamp((t - KNOB) / (INTRO - KNOB)) ** 1.7);

// ---------------------------------------------------------------- giris (radyo)
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;
  const vol = volume(t);

  const s2 = clamp((t - (S1_END - FADE)) / FADE); // 2. sahnenin opakligi
  const s1Zoom = 1 + 0.03 * clamp(t / S1_END);
  const s2Pulse = 1.03 + bass * 0.09 * (0.3 + vol); // hoparlor ses yukseldikce daha cok atar
  const s2Bright = 1 + bass * 0.6 * (0.3 + vol);

  const labelIn = easeOutCubic((t - 0.7) / 0.5) * (1 - clamp((t - 3.2) / 0.5));
  const segments = 10;
  const lit = Math.max(1, Math.round(1 + (segments - 1) * clamp((vol - 0.06) / 0.94)));

  return (
    <AbsoluteFill style={{ background: "#050505", fontFamily }}>
      <Audio src={staticFile("era90-intro.wav")} />

      {/* sahne 1: radyonun basinda oturan */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <OffthreadVideo
          src={staticFile("era90-s1.mp4")}
          muted
          style={{ width: 1080, height: 1920, objectFit: "cover", scale: s1Zoom, filter: "brightness(1.15) contrast(1.05)" }}
        />
      </AbsoluteFill>

      {/* sahne 2: hoparlor (bas ile atar) */}
      {s2 > 0 ? (
        <AbsoluteFill style={{ opacity: s2, overflow: "hidden" }}>
          <OffthreadVideo
            src={staticFile("era90-s2.mp4")}
            muted
            startFrom={0}
            style={{ width: 1080, height: 1920, objectFit: "cover", scale: s2Pulse, filter: `brightness(${s2Bright})` }}
          />
        </AbsoluteFill>
      ) : null}

      {/* vinyet + hafif gren */}
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 80% 70% at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }}
      />
      <AbsoluteFill style={{ opacity: 0.06, mixBlendMode: "screen" }}>
        {Array.from({ length: 70 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: rnd(frame, i) * 1080,
              top: rnd(frame, 100 + i) * 1920,
              width: 2 + rnd(frame, 200 + i) * 5,
              height: 2 + rnd(frame, 300 + i) * 5,
              background: "#fff",
            }}
          />
        ))}
      </AbsoluteFill>

      {/* donem etiketi */}
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          width: 1080,
          textAlign: "center",
          opacity: labelIn,
          translate: `0px ${(1 - labelIn) * -30}px`,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 150, letterSpacing: 14, color: AMBER, textShadow: "0 6px 30px rgba(0,0,0,0.7)" }}>
          90&apos;LAR
        </div>
      </div>

      {/* ses seviyesi cubugu */}
      <div style={{ position: "absolute", left: 70, bottom: 120, display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 34, letterSpacing: 4, color: "rgba(255,255,255,0.85)", marginRight: 10, paddingBottom: 2 }}>
          VOL
        </div>
        {Array.from({ length: segments }).map((_, i) => {
          const on = i < lit;
          const col = i < 6 ? GREEN : i < 8 ? AMBER : RED;
          return (
            <div
              key={i}
              style={{
                width: 22,
                height: 26 + i * 6,
                borderRadius: 4,
                background: on ? col : "rgba(255,255,255,0.12)",
                boxShadow: on ? `0 0 14px ${col}` : "none",
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- giris + "kac yil oldu"
export const Era90s: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const introFrames = Math.round(INTRO * fps);

  // CRT acilisi hissi: giris bitiminde beyaz parlama
  const flash = Math.max(0, 1 - Math.abs(t - INTRO) / 0.3) * 0.9;

  return (
    <AbsoluteFill style={{ background: "#050505" }}>
      <Sequence durationInFrames={introFrames}>
        <Intro />
      </Sequence>
      <Sequence from={introFrames}>
        <Anniversary />
      </Sequence>
      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
