import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-nrvar.json";

// "Yeni cikti" sablonu: RADYO. Gece yarisi frekans aranir, parazit icinde kaybolup bulunur; sinyal oturunca kapak parazitten acilir
// ve sarki berraklasir. Izleyici "bulacak mi?" gerilimiyle kalir.
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

const BANDS = data.bands as number[][];
const ARTIST = data.artist.toLocaleUpperCase("tr");
const TITLE = data.title.toLocaleUpperCase("tr");
const REVEAL = data.reveal;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const AMBER = "#ffb23e";
const AMBER_D = "#7a4a10";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeInOut = (x: number) => (clamp(x) < 0.5 ? 2 * clamp(x) ** 2 : 1 - (-2 * clamp(x) + 2) ** 2 / 2);
const hash = (a: number, b = 0): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));

// istasyon frekansi: sarkidan turetilir (88.0-107.9)
let seedStr = 0;
for (const ch of `${data.artist}${data.title}`) seedStr = (seedStr * 31 + ch.charCodeAt(0)) >>> 0;
const LOCK = Math.round((88 + 1 + (seedStr % 190) / 10) * 10) / 10;
const clampF = (f: number) => Math.min(107.5, Math.max(88.4, f));
const KEYS: [number, number][] = [
  [0.0, clampF(LOCK - 9)],
  [0.9, clampF(LOCK - 3)],
  [1.7, clampF(LOCK + 8)],
  [2.6, clampF(LOCK - 5)],
  [3.4, clampF(LOCK + 4)],
  [4.2, clampF(LOCK - 1.8)],
  [4.9, clampF(LOCK + 0.7)],
  [REVEAL, LOCK],
];
function freqAt(t: number): number {
  if (t >= REVEAL) return LOCK;
  for (let i = 1; i < KEYS.length; i++) {
    if (t <= KEYS[i][0]) {
      const [t0, f0] = KEYS[i - 1];
      const [t1, f1] = KEYS[i];
      return f0 + (f1 - f0) * easeInOut((t - t0) / (t1 - t0));
    }
  }
  return LOCK;
}
const scaleX = (f: number) => ((f - 88) / 20) * 840; // 840 px'lik kadran

export const NRRadyo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.4);
  const fadeOut = clamp((t - (DUR - 0.8)) / 0.8);
  const revealed = t >= REVEAL;
  const dr = t - REVEAL;
  const outroT = clamp((t - OUTRO) / 0.6);

  const lockProg = clamp((t - 3.0) / (REVEAL - 3.0)); // sinyal netlesme
  const jitter = (1 - lockProg) * 0.55 * (rnd(frame, 2) - 0.5);
  const f = freqAt(t) + jitter;
  const needleX = scaleX(f);

  // parazit: sinyal yaklastikca azalir; kisa kesintilerle titrer
  const staticAmt = revealed ? Math.max(0, 0.25 * Math.exp(-6 * dr)) : clamp(1 - lockProg * 0.92) * (0.85 + 0.15 * rnd(frame, 7));
  const shiftX = revealed ? 0 : (rnd(frame, 3) - 0.5) * 38 * (1 - lockProg) * (rnd(frame, 4) > 0.55 ? 1 : 0.2);
  const coverBlur = revealed ? 0 : (1 - lockProg) * 22;
  const coverShow = clamp((t - 2.6) / 2.4); // kapak parazit altindan belirir
  const eye = clamp(lockProg) ** 2 + (revealed ? 1 : 0);

  const type = Math.floor(clamp((dr - 0.3) / 1.0) * `${ARTIST} · ${TITLE}`.length);
  const station = `${ARTIST} · ${TITLE}`.slice(0, type);
  const stSize = fit(`${ARTIST} · ${TITLE}`, 62, 900, 0.52);
  const dispF = f.toFixed(1);

  return (
    <AbsoluteFill style={{ background: "#120a05", fontFamily }}>
      <Audio src={staticFile("nrvar-soundtrack.wav")} />

      <AbsoluteFill style={{ background: "radial-gradient(ellipse 100% 70% at 50% 40%, #3b2412 0%, #1a0f07 55%, #0b0603 100%)", opacity: fadeIn }} />

      {/* ust yazi */}
      <div style={{ position: "absolute", left: 0, top: 70, width: 1080, textAlign: "center", opacity: fadeIn }}>
        <div style={{ fontWeight: 500, fontSize: 38, letterSpacing: 14, color: AMBER }}>GECE YARISI · FM</div>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 26, letterSpacing: 5, color: "rgba(255,178,62,0.6)", marginTop: 10 }}>{data.dateText}</div>
      </div>

      {/* ekran: parazit -> kapak */}
      <div style={{ position: "absolute", left: 140, top: 230, width: 800, height: 800, borderRadius: 36, overflow: "hidden", background: "#050403", boxShadow: "0 0 0 14px #2a190c, 0 0 0 18px #5a3a1c, 0 40px 90px rgba(0,0,0,0.75)", opacity: fadeIn * (1 - outroT), scale: 1 + bass * 0.015 }}>
        <Img
          src={staticFile("nrvar-cover.jpg")}
          style={{ position: "absolute", left: 20 + shiftX, top: 20, width: 760, height: 760, objectFit: "cover", opacity: coverShow, filter: `blur(${coverBlur}px) contrast(1.1) saturate(${revealed ? 1.05 : 0.7})` }}
        />
        {staticAmt > 0.02 ? (
          <svg width="800" height="800" viewBox="0 0 400 400" style={{ position: "absolute", inset: 0, opacity: staticAmt, mixBlendMode: "screen" }}>
            <filter id="nz" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" seed={frame % 97} />
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncR type="linear" slope="1.8" intercept="-0.2" />
                <feFuncG type="linear" slope="1.8" intercept="-0.2" />
                <feFuncB type="linear" slope="1.8" intercept="-0.2" />
              </feComponentTransfer>
            </filter>
            <rect width="400" height="400" filter="url(#nz)" />
          </svg>
        ) : null}
        {/* tarama cizgileri */}
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(180deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 6px)" }} />
        {!revealed ? (
          <div style={{ position: "absolute", left: 0, top: 360, width: 800, textAlign: "center", fontWeight: 700, fontSize: 76, letterSpacing: 10, color: AMBER, opacity: clamp(1 - coverShow * 1.2) * (rnd(Math.floor(frame / 3), 9) > 0.15 ? 1 : 0.2), textShadow: `0 0 24px ${AMBER}` }}>
            SİNYAL ARANIYOR
          </div>
        ) : null}
        <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 120px rgba(0,0,0,0.65)" }} />
      </div>

      {/* frekans ekrani */}
      <div style={{ position: "absolute", left: 90, top: 1090, width: 900, height: 128, borderRadius: 18, background: "#150c04", boxShadow: "inset 0 0 0 4px #5a3a1c, 0 14px 40px rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", opacity: fadeIn * (1 - outroT) }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 92, color: AMBER, textShadow: `0 0 22px ${AMBER}` }}>
          {dispF}
          <span style={{ fontSize: 44, marginLeft: 14 }}>FM</span>
        </div>
        <div style={{ textAlign: "right", color: AMBER, fontWeight: 700, fontSize: 40, letterSpacing: 4, textShadow: `0 0 16px ${AMBER}` }}>
          {revealed ? "SİNYAL TAMAM" : lockProg > 0.5 ? "YAKLAŞTI..." : "ARANIYOR"}
        </div>
      </div>

      {/* kadran */}
      <div style={{ position: "absolute", left: 120, top: 1250, width: 840, height: 130, opacity: fadeIn * (1 - outroT) }}>
        <div style={{ position: "absolute", left: -30, top: 0, width: 900, height: 130, borderRadius: 14, background: "linear-gradient(180deg, #3a2512 0%, #24160a 100%)", boxShadow: "inset 0 0 0 4px #6b4521" }} />
        {Array.from({ length: 41 }).map((_, i) => {
          const major = i % 5 === 0;
          return <div key={i} style={{ position: "absolute", left: (i / 40) * 840 - 1.5, top: major ? 18 : 30, width: 3, height: major ? 50 : 28, background: AMBER, opacity: 0.8 }} />;
        })}
        {[88, 93, 98, 103, 108].map((n) => (
          <div key={n} style={{ position: "absolute", left: scaleX(n) - 30, top: 76, width: 60, textAlign: "center", fontFamily: mono, fontWeight: 700, fontSize: 26, color: AMBER, opacity: 0.85 }}>
            {n}
          </div>
        ))}
        <div style={{ position: "absolute", left: needleX - 3, top: 4, width: 6, height: 122, background: "#ff3d2e", boxShadow: "0 0 18px #ff3d2e", borderRadius: 3 }} />
      </div>

      {/* dugmeler + ayar gozu */}
      <div style={{ position: "absolute", left: 90, top: 1420, width: 900, height: 240, opacity: fadeIn * (1 - outroT) }}>
        {[0, 1].map((k) => (
          <div key={k} style={{ position: "absolute", left: k === 0 ? 30 : 640, top: 10, width: 230, height: 230, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #6d6d70 0%, #2b2b2e 70%)", boxShadow: "0 20px 40px rgba(0,0,0,0.6), inset 0 0 0 6px #17171a", rotate: `${(k === 0 ? f * 22 : -f * 11) % 360}deg` }}>
            <div style={{ position: "absolute", left: 107, top: 14, width: 16, height: 70, background: "#e8e8e8", borderRadius: 8 }} />
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} style={{ position: "absolute", left: 113, top: 0, width: 4, height: 14, background: "#101012", transformOrigin: "2px 115px", rotate: `${i * 15}deg` }} />
            ))}
          </div>
        ))}
        <div style={{ position: "absolute", left: 320, top: 36, width: 260, height: 170, borderRadius: 24, background: "#0b0804", boxShadow: "inset 0 0 0 4px #5a3a1c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, rgba(120,255,140,${0.25 + 0.75 * eye}) 0%, rgba(30,120,50,${0.2 + 0.5 * eye}) 55%, #0a1a0c 100%)`, boxShadow: `0 0 ${10 + 60 * eye}px rgba(80,255,120,${0.2 + 0.7 * eye})` }} />
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "rgba(120,255,140,0.8)" }}>SİNYAL</div>
        </div>
      </div>

      {/* istasyon adi */}
      {revealed ? (
        <div style={{ position: "absolute", left: 90, top: 1700, width: 900, opacity: clamp(dr / 0.3) * (1 - outroT) }}>
          <div style={{ fontWeight: 500, fontSize: 34, letterSpacing: 10, color: "rgba(255,178,62,0.75)" }}>ŞİMDİ ÇALIYOR · YENİ ÇIKTI</div>
          <div style={{ fontWeight: 700, fontSize: stSize, color: "#fff", whiteSpace: "nowrap", marginTop: 8, textShadow: `0 0 22px ${AMBER_D}` }}>
            {station}
            {Math.floor(t * 3) % 2 === 0 ? <span style={{ display: "inline-block", width: 10, height: "0.85em", background: AMBER, marginLeft: 6, verticalAlign: "-0.08em" }} /> : null}
          </div>
        </div>
      ) : null}

      {outroT > 0 ? <AbsoluteFill style={{ background: "#000", opacity: 0.5 * outroT, pointerEvents: "none" }} /> : null}

      {/* kapanis */}
      {outroT > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 880, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut), textShadow: "0 4px 30px rgba(0,0,0,0.9)" }}>
          <div style={{ fontWeight: 700, fontSize: 80, color: AMBER, letterSpacing: 6 }}>FREKANSI KAÇIRMA</div>
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 46, letterSpacing: 8, color: "#fff", marginTop: 26 }}>@YENISARKILARIM</div>
        </div>
      ) : null}

      <AbsoluteFill style={{ background: AMBER, opacity: revealed ? 0.5 * Math.exp(-10 * dr) : 0, mixBlendMode: "screen", pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
