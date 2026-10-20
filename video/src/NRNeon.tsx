import React from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadNeon } from "@remotion/google-fonts/TiltNeon";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-nrvar.json";

// "Yeni cikti" sablonu: NEON SAHNE. Dumanli sahne + neon tup yazilar: ince yanip sonme ile "YENI CIKTI" yanar,
// sanatci ismi neon olarak yazilir, kapak neon cerceveyle acilir.
const { fontFamily } = loadNeon("normal", { subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

const BANDS = data.bands as number[][];
const HUE = data.hue;
const ARTIST = data.artist.toLocaleUpperCase("tr");
const TITLE = data.title.toLocaleUpperCase("tr");
const REVEAL = data.reveal;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const HAS_BG = Boolean((data as { bg?: boolean }).bg);
const BG_SECONDS = (data as { bgSeconds?: number }).bgSeconds ?? 0;
// iki neon rengi: kapak tonu + tamamlayici
const C1 = `hsl(${HUE}, 100%, 62%)`;
const C2 = `hsl(${(HUE + 150) % 360}, 100%, 64%)`;
const WHITE_HOT = "#fff7fb";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const hash = (a: number, b = 0): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (text: string, max: number, width: number, k = 0.62) => Math.min(max, width / (Math.max(text.length, 3) * k));

// neon yanip sonme: [0,1] parlaklik; ignite saniyesinden sonra yanar, ilk 0.8 sn arizali titrer
function neonPower(t: number, ignite: number, seed: number, frame: number): number {
  if (t < ignite) return 0;
  const k = t - ignite;
  if (k < 0.9) return rnd(frame, seed) > 0.45 ? 1 : 0.12;
  return rnd(Math.floor(frame / 2), seed + 9) > 0.985 ? 0.55 : 1;
}

const neonShadow = (color: string, scale = 1) =>
  `0 0 ${4 * scale}px ${WHITE_HOT}, 0 0 ${14 * scale}px ${color}, 0 0 ${34 * scale}px ${color}, 0 0 ${74 * scale}px ${color}, 0 0 ${130 * scale}px ${color}`;

export const NRNeon: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.5);
  const fadeOut = clamp((t - (DUR - 0.8)) / 0.8);
  const revealed = t >= REVEAL;
  const dr = t - REVEAL;
  const outroT = clamp((t - OUTRO) / 0.7);

  const pNew = neonPower(t, 0.9, 3, frame);
  const pArtist = neonPower(t, 2.4, 7, frame);
  const pFrame = neonPower(t, REVEAL, 11, frame);
  const pTitle = neonPower(t, REVEAL + 0.5, 13, frame);

  // sanatci adi neon tup gibi harf harf yanar
  const letters = ARTIST.split("");
  const artistSize = fit(ARTIST, 170, 940, 0.62);
  const titleSize = fit(TITLE, 92, 940, 0.62);
  const lit = (i: number) => (t - 2.4 - i * 0.07 > 0 ? 1 : 0);

  const pulse = 1 + bass * 0.05;

  return (
    <AbsoluteFill style={{ background: "#04030a", fontFamily }}>
      <Audio src={staticFile("nrvar-soundtrack.wav")} />

      {/* arka plan: neon sahne dongusu ya da yedek */}
      <AbsoluteFill style={{ opacity: fadeIn }}>
        {HAS_BG ? (
          <Loop durationInFrames={Math.max(1, Math.round(BG_SECONDS * fps))}>
            <OffthreadVideo src={staticFile("nrvar-bg.mp4")} muted style={{ width: 1080, height: 1920, objectFit: "cover", filter: `hue-rotate(${HUE - 300}deg) brightness(0.85) saturate(1.2)` }} />
          </Loop>
        ) : (
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse 80% 55% at 50% 60%, hsla(${HUE},90%,35%,0.55) 0%, rgba(4,3,10,1) 70%), radial-gradient(ellipse 60% 40% at 20% 20%, hsla(${(HUE + 150) % 360},90%,40%,0.4) 0%, rgba(0,0,0,0) 70%)`,
            }}
          />
        )}
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(2,1,8,0.6) 0%, rgba(2,1,8,0.1) 45%, rgba(2,1,8,0.7) 100%)" }} />
      </AbsoluteFill>

      {/* ust neon: YENI CIKTI */}
      {revealed ? (
        <div style={{ position: "absolute", left: 0, top: 130, width: 1080, textAlign: "center", opacity: pNew * fadeIn * (1 - outroT) }}>
          <div style={{ fontSize: 84, letterSpacing: 14, color: WHITE_HOT, textShadow: neonShadow(C2, 0.8), whiteSpace: "nowrap" }}>YENİ ÇIKTI</div>
        </div>
      ) : (
        <>
          <div style={{ position: "absolute", left: 0, top: 150, width: 1080, textAlign: "center", opacity: pNew * fadeIn }}>
            <div style={{ fontSize: 118, letterSpacing: 10, color: WHITE_HOT, textShadow: neonShadow(C2) }}>YENİ</div>
            <div style={{ fontSize: 118, letterSpacing: 10, color: WHITE_HOT, textShadow: neonShadow(C2), marginTop: -10 }}>ÇIKTI</div>
          </div>
          {/* neon cizgi */}
          <div style={{ position: "absolute", left: 270, top: 520, width: 540, height: 8, borderRadius: 4, background: WHITE_HOT, boxShadow: `0 0 12px ${C2}, 0 0 36px ${C2}, 0 0 80px ${C2}`, opacity: pNew * fadeIn }} />
        </>
      )}

      {/* sahnenin ortasi: sanatci adi harf harf */}
      {!revealed ? (
        <div style={{ position: "absolute", left: 0, top: 1130, width: 1080, textAlign: "center", opacity: 1 - clamp((t - (REVEAL - 0.3)) / 0.3) }}>
          <div style={{ fontSize: 44, letterSpacing: 18, color: C1, textShadow: `0 0 20px ${C1}`, opacity: clamp((t - 1.8) / 0.4) * 0.9, marginBottom: 26 }}>
            SAHNEDE
          </div>
          <div style={{ fontSize: artistSize, lineHeight: 1.05, color: WHITE_HOT, whiteSpace: "nowrap", scale: pulse }}>
            {letters.map((ch, i) => {
              const on = lit(i);
              const p = on ? neonPower(t, 2.4 + i * 0.07, 20 + i, frame) : 0;
              return (
                <span key={i} style={{ opacity: p * pArtist > 0 ? p : 0.06, textShadow: p > 0.5 ? neonShadow(C1, 1.2) : "none" }}>
                  {ch}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* acilis: kapak neon cercevede */}
      {revealed ? (
        <>
          <div
            style={{
              position: "absolute",
              left: 170,
              top: 330,
              width: 740,
              height: 740,
              scale: (0.75 + 0.25 * easeOutBack(dr / 0.55)) * pulse,
              opacity: clamp(dr / 0.15) * (1 - outroT),
            }}
          >
            <div style={{ position: "absolute", inset: -22, border: `8px solid ${WHITE_HOT}`, borderRadius: 14, boxShadow: `0 0 14px ${C1}, 0 0 40px ${C1}, 0 0 90px ${C1}, inset 0 0 40px ${C1}`, opacity: pFrame }} />
            <div style={{ position: "absolute", inset: -58, border: `6px solid ${WHITE_HOT}`, borderRadius: 24, boxShadow: `0 0 14px ${C2}, 0 0 40px ${C2}, 0 0 90px ${C2}, inset 0 0 40px ${C2}`, opacity: pFrame * 0.9 }} />
            <Img src={staticFile("nrvar-cover.jpg")} style={{ width: 740, height: 740, objectFit: "cover", borderRadius: 6 }} />
          </div>
          <div style={{ position: "absolute", left: 0, top: 1210, width: 1080, textAlign: "center", opacity: pTitle * (1 - outroT), padding: "0 70px", boxSizing: "border-box" }}>
            <div style={{ fontSize: titleSize, lineHeight: 1.08, color: WHITE_HOT, textShadow: neonShadow(C1, 0.9), whiteSpace: "nowrap" }}>{TITLE}</div>
            <div style={{ fontSize: 46, letterSpacing: 10, color: C2, textShadow: `0 0 18px ${C2}, 0 0 44px ${C2}`, marginTop: 20, whiteSpace: "nowrap" }}>{ARTIST}</div>
          </div>
          <div style={{ position: "absolute", left: 0, top: 1580, width: 1080, textAlign: "center", opacity: clamp((dr - 1.0) / 0.5) * (1 - outroT) }}>
            <div style={{ display: "inline-block", padding: "14px 44px", border: `4px solid ${WHITE_HOT}`, borderRadius: 60, color: WHITE_HOT, fontSize: 44, letterSpacing: 8, boxShadow: `0 0 12px ${C2}, 0 0 34px ${C2}, inset 0 0 22px ${C2}`, textShadow: `0 0 16px ${C2}` }}>
              SPOTIFY&apos;DA
            </div>
          </div>
        </>
      ) : null}

      {/* kapanis */}
      {outroT > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 900, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 46, letterSpacing: 8, color: WHITE_HOT, textShadow: `0 0 18px ${C1}, 0 0 50px ${C1}` }}>@YENISARKILARIM</div>
        </div>
      ) : null}

      {/* acilista kisa neon patlamasi */}
      <AbsoluteFill style={{ background: C1, opacity: revealed ? 0.55 * Math.exp(-10 * dr) : 0, pointerEvents: "none", mixBlendMode: "screen" }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, textAlign: "center", fontFamily: mono, fontWeight: 500, fontSize: 26, letterSpacing: 5, color: "rgba(255,255,255,0.5)", paddingTop: 64, opacity: fadeIn * (1 - clamp(t - 0.9)) }}>
        {data.dateText}
      </div>
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
