import React from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-nrvar.json";

// "Yeni cikti" sablonu: FRAGMAN. Sinema fragmani dili: karanlik projektor odasi, yazi vurusu (BU HAFTA / YENI BIR SARKI / SANATCI),
// sonra beyaz flas ve kapak "afis" olarak acilir, sarki baslar.
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
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
const ACCENT = `hsl(${HUE}, 92%, 62%)`;

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
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;

// yazi fit: genislik 960 px
const fit = (text: string, max: number, k = 0.5) => Math.min(max, 960 / (Math.max(text.length, 3) * k));

// vurus (slam) animasyonu: t0'da buyuk baslar, hizla yerine oturur; [t0, t1) araliginda gorunur
const Slam: React.FC<{ t: number; t0: number; t1: number; children: React.ReactNode; top: number }> = ({ t, t0, t1, children, top }) => {
  if (t < t0 || t >= t1) return null;
  const k = easeOutBack((t - t0) / 0.28);
  const out = clamp((t1 - t) / 0.18);
  const shake = Math.max(0, 1 - (t - t0) / 0.35) * Math.sin(t * 90) * 14;
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        width: 1080,
        textAlign: "center",
        opacity: clamp((t - t0) / 0.06) * out,
        scale: 1.55 - 0.55 * k,
        translate: `${shake}px ${shake * -0.5}px`,
      }}
    >
      {children}
    </div>
  );
};

export const NRFragman: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const revealed = t >= REVEAL;
  const dr = t - REVEAL;
  const flash = revealed ? 0.95 * Math.exp(-8 * dr) : 0;
  const flicker = 0.55 + 0.45 * (Math.sin(frame * 2.3) * 0.5 + 0.5) * (rnd(frame, 3) > 0.12 ? 1 : 0.4);
  const fadeIn = clamp(t / 0.7);
  const fadeOut = clamp((t - (DUR - 0.8)) / 0.8);

  const coverIn = easeOutBack(dr / 0.6);
  const sweep = clamp((dr - 0.25) / 0.9);
  const titleSize = fit(TITLE, 150, 0.46);
  const artistSize = fit(ARTIST, 240, 0.5);
  const outroT = clamp((t - OUTRO) / 0.7);

  return (
    <AbsoluteFill style={{ background: "#020203", fontFamily }}>
      <Audio src={staticFile("nrvar-soundtrack.wav")} />

      {/* arka plan: projektor odasi (ComfyUI dongusu) ya da yedek isik huzmesi */}
      <AbsoluteFill style={{ opacity: fadeIn * (revealed ? 0.85 : 0.35 + 0.35 * flicker) }}>
        {HAS_BG ? (
          <Loop durationInFrames={Math.max(1, Math.round(BG_SECONDS * fps))}>
            <OffthreadVideo
              src={staticFile("nrvar-bg.mp4")}
              muted
              style={{ width: 1080, height: 1920, objectFit: "cover", filter: "brightness(1.15) contrast(1.1)" }}
            />
          </Loop>
        ) : (
          <>
            <AbsoluteFill
              style={{
                background:
                  "linear-gradient(118deg, rgba(0,0,0,0) 30%, rgba(255,236,190,0.38) 46%, rgba(255,236,190,0.08) 62%, rgba(0,0,0,0) 78%)",
              }}
            />
            {Array.from({ length: 70 }).map((_, i) => {
              const x = rnd(i, 1) * 1080;
              const y = 1920 - ((rnd(i, 2) * 1920 + t * (24 + rnd(i, 3) * 40)) % 2000);
              const s = 2 + rnd(i, 4) * 5;
              return (
                <div
                  key={i}
                  style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: "50%", background: "rgba(255,240,210,0.55)", opacity: 0.25 + rnd(i, 5) * 0.6 }}
                />
              );
            })}
          </>
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.78) 100%)" }} />

      {/* ince sinema serit cubuklari */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 150, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, bottom: 0, width: 1080, height: 150, background: "#000" }} />
      <div style={{ position: "absolute", left: 60, top: 62, fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 6, color: "rgba(255,255,255,0.55)" }}>
        YENİ ÇIKTI
      </div>
      <div style={{ position: "absolute", right: 60, top: 62, fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: "rgba(255,255,255,0.55)" }}>
        {data.dateText}
      </div>

      {/* fragman yazilari */}
      <Slam t={t} t0={1.0} t1={2.3} top={820}>
        <div style={{ fontWeight: 500, fontSize: 70, letterSpacing: 30, color: "#b9b9b9" }}>BU HAFTA</div>
      </Slam>
      <Slam t={t} t0={2.5} t1={3.9} top={780}>
        <div style={{ fontWeight: 700, fontSize: 122, lineHeight: 1.02, color: "#fff", textShadow: "0 10px 50px rgba(0,0,0,0.9)" }}>YENİ BİR</div>
        <div style={{ fontWeight: 700, fontSize: 122, lineHeight: 1.02, color: ACCENT, textShadow: "0 10px 50px rgba(0,0,0,0.9)" }}>ŞARKI</div>
      </Slam>
      <Slam t={t} t0={4.1} t1={5.95} top={760}>
        <div style={{ fontWeight: 700, fontSize: artistSize, lineHeight: 1.0, color: "#fff", letterSpacing: 2, textShadow: "0 12px 60px rgba(0,0,0,0.95)" }}>{ARTIST}</div>
        <div style={{ margin: "26px auto 0", width: 420, height: 6, background: ACCENT, boxShadow: `0 0 30px ${ACCENT}` }} />
      </Slam>

      {/* acilis: kapak "afis" */}
      {revealed ? (
        <>
          <div
            style={{
              position: "absolute",
              left: 150,
              top: 330,
              width: 780,
              height: 780,
              overflow: "hidden",
              scale: (0.78 + 0.22 * coverIn) * (1 + bass * 0.025) * (1 + 0.04 * clamp(dr / 6)),
              opacity: clamp(dr / 0.12) * (1 - outroT),
              boxShadow: `0 0 ${110 + bass * 120}px hsla(${HUE},90%,55%,0.55), 0 30px 90px rgba(0,0,0,0.8)`,
              border: "2px solid rgba(255,255,255,0.18)",
            }}
          >
            <Img src={staticFile("nrvar-cover.jpg")} style={{ width: 780, height: 780, objectFit: "cover" }} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(105deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.65) 50%, rgba(255,255,255,0) 62%)",
                translate: `${(sweep * 2 - 1) * 900}px 0px`,
                mixBlendMode: "screen",
                opacity: sweep > 0 && sweep < 1 ? 1 : 0,
              }}
            />
          </div>
          <div style={{ position: "absolute", left: 0, top: 1170, width: 1080, textAlign: "center", opacity: clamp((dr - 0.3) / 0.4) * (1 - outroT), translate: `0px ${(1 - easeOutCubic((dr - 0.3) / 0.5)) * 40}px` }}>
            <div style={{ fontWeight: 700, fontSize: titleSize, lineHeight: 1.04, color: "#fff", padding: "0 60px", textShadow: "0 10px 40px rgba(0,0,0,0.9)" }}>{TITLE}</div>
            <div style={{ fontWeight: 500, fontSize: 46, letterSpacing: 10, color: ACCENT, marginTop: 14 }}>{ARTIST}</div>
          </div>
          <div style={{ position: "absolute", left: 0, top: 1530, width: 1080, textAlign: "center", opacity: clamp((dr - 0.9) / 0.5) * (1 - outroT) }}>
            <div
              style={{
                display: "inline-block",
                padding: "16px 44px",
                border: `3px solid ${ACCENT}`,
                color: "#fff",
                fontWeight: 700,
                fontSize: 44,
                letterSpacing: 8,
                background: "rgba(0,0,0,0.45)",
              }}
            >
              ŞİMDİ SPOTIFY&apos;DA
            </div>
          </div>
        </>
      ) : null}

      {/* kapanis */}
      {outroT > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 900, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 44, letterSpacing: 8, color: "#fff" }}>@YENISARKILARIM</div>
        </div>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
