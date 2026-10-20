import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-nrvar.json";

// "Yeni cikti" sablonu: TAHMIN ET. Sarki bastan calar, kapak bulanik; her saniye netlesir, harf ipuclari gelir,
// geri sayim biter ve cevap acilir. Izleyici merak boslugu yuzunden sona kadar kalir.
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

const BANDS = data.bands as number[][];
const HUE = data.hue;
const ARTIST = data.artist.toLocaleUpperCase("tr");
const TITLE = data.title.toLocaleUpperCase("tr");
const REVEAL = data.reveal;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const START = 0.4; // sarkinin basladigi an
const ACCENT = `hsl(${HUE}, 95%, 60%)`;
const ACCENT2 = `hsl(${(HUE + 40) % 360}, 90%, 55%)`;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const hash = (a: number, b = 0): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));

// hangi harfler (indeks) ipucu olarak acilir: ilk harf, sonra sabit karisik sira
const letterIdx = ARTIST.split("").map((c, i) => ({ c, i })).filter((x) => x.c !== " ");
const order = [...letterIdx].sort((a, b) => hash(a.i, 5) - hash(b.i, 5)).map((x) => x.i);
const firstIdx = letterIdx[0]?.i ?? 0;
const hintIdx2 = order.filter((i) => i !== firstIdx).slice(0, Math.max(1, Math.floor(letterIdx.length * 0.4)));

export const NRTahmin: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.35);
  const fadeOut = clamp((t - (DUR - 0.8)) / 0.8);
  const revealed = t >= REVEAL;
  const dr = t - REVEAL;
  const outroT = clamp((t - OUTRO) / 0.6);
  const flash = revealed ? 0.9 * Math.exp(-9 * dr) : 0;

  // bulaniklik: START'ta 70px, REVEAL'da 0
  const prog = clamp((t - START) / (REVEAL - START));
  const blur = revealed ? 0 : 64 * (1 - prog) ** 1.6 + 2;
  const qOpacity = revealed ? 0 : clamp(1.1 - prog * 1.6);

  // ipucu evresi
  const phase = revealed ? 3 : t < 3.5 ? 0 : t < 6.0 ? 1 : 2;
  const sub = ["SANATÇIYI BUL", "İLK HARF GELDİ", "SON İPUÇLARI", "DOĞRU CEVAP"][phase];

  const left = Math.max(0, Math.ceil(REVEAL - t));
  const secFrac = 1 - ((REVEAL - t) % 1);
  const ringPct = clamp((REVEAL - t) / (REVEAL - START));

  // harf kutulari
  const chars = ARTIST.split("");
  const box = Math.min(74, 940 / Math.max(chars.length, 4));
  const shown = (i: number) => revealed || (phase >= 1 && i === firstIdx) || (phase >= 2 && hintIdx2.includes(i));

  const titleSize = fit(TITLE, 120, 940, 0.5);
  const artistSize = fit(ARTIST, 80, 940, 0.52);

  return (
    <AbsoluteFill style={{ background: "#07060d", fontFamily }}>
      <Audio src={staticFile("nrvar-soundtrack.wav")} />

      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 60% at 50% 35%, hsla(${HUE},80%,28%,0.65) 0%, rgba(7,6,13,1) 70%), linear-gradient(180deg, #07060d, #0d0a1a)`,
          opacity: fadeIn,
        }}
      />

      {/* baslik */}
      <div style={{ position: "absolute", left: 0, top: 120, width: 1080, textAlign: "center", opacity: fadeIn * (1 - outroT) }}>
        <div style={{ fontWeight: 700, fontSize: 104, lineHeight: 1.02, color: "#fff", letterSpacing: 2, translate: `0px ${(1 - easeOutBack(t / 0.5)) * -60}px` }}>
          {revealed ? "İŞTE CEVAP!" : "BU ŞARKIYI"}
        </div>
        {!revealed ? (
          <div style={{ fontWeight: 700, fontSize: 104, lineHeight: 1.02, color: ACCENT, letterSpacing: 2 }}>TANIDIN MI?</div>
        ) : (
          <div style={{ fontWeight: 500, fontSize: 52, letterSpacing: 10, color: ACCENT, marginTop: 6 }}>YENİ ÇIKTI</div>
        )}
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 34, letterSpacing: 8, color: "rgba(255,255,255,0.7)", marginTop: 18 }}>{sub}</div>
      </div>

      {/* kapak */}
      <div
        style={{
          position: "absolute",
          left: 170,
          top: 470,
          width: 740,
          height: 740,
          overflow: "hidden",
          borderRadius: 24,
          scale: (revealed ? 1 + 0.06 * Math.exp(-6 * dr) : 1) * (1 + bass * 0.03),
          opacity: fadeIn * (1 - outroT),
          boxShadow: `0 0 ${60 + bass * 100}px hsla(${HUE},90%,55%,0.5), 0 30px 90px rgba(0,0,0,0.7)`,
          border: "3px solid rgba(255,255,255,0.2)",
        }}
      >
        <Img src={staticFile("nrvar-cover.jpg")} style={{ width: 740, height: 740, objectFit: "cover", filter: `blur(${blur}px) brightness(${revealed ? 1 : 0.7 + 0.3 * prog})`, scale: revealed ? 1 : 1.25 }} />
        {!revealed ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 420, color: "#fff", opacity: qOpacity, textShadow: `0 0 60px ${ACCENT}` }}>?</div>
        ) : null}
      </div>

      {/* ipucu paneli */}
      {!revealed ? (
        <div style={{ position: "absolute", left: 70, top: 1270, width: 940, display: "flex", justifyContent: "center", gap: 10, flexWrap: "nowrap", opacity: fadeIn }}>
          {chars.map((ch, i) =>
            ch === " " ? (
              <div key={i} style={{ width: box * 0.5 }} />
            ) : (
              <div
                key={i}
                style={{
                  width: box,
                  height: box * 1.25,
                  borderRadius: 10,
                  background: shown(i) ? ACCENT : "rgba(255,255,255,0.1)",
                  border: `3px solid ${shown(i) ? "#fff" : "rgba(255,255,255,0.35)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: box * 0.82,
                  color: "#08060f",
                  scale: shown(i) && ((phase === 1 && i === firstIdx && t - 3.5 < 0.4) || (phase === 2 && t - 6.0 < 0.4)) ? 1.15 : 1,
                }}
              >
                {shown(i) ? ch : ""}
              </div>
            )
          )}
        </div>
      ) : (
        <div style={{ position: "absolute", left: 0, top: 1260, width: 1080, textAlign: "center", opacity: clamp(dr / 0.3) * (1 - outroT), translate: `0px ${(1 - easeOutCubic(dr / 0.5)) * 40}px` }}>
          <div style={{ fontWeight: 700, fontSize: titleSize, lineHeight: 1.05, color: "#fff", padding: "0 70px", textShadow: "0 10px 40px rgba(0,0,0,0.9)" }}>{TITLE}</div>
          <div style={{ fontWeight: 700, fontSize: artistSize, letterSpacing: 6, color: ACCENT, marginTop: 14 }}>{ARTIST}</div>
        </div>
      )}

      {/* geri sayim halkasi */}
      {!revealed ? (
        <div style={{ position: "absolute", left: 440, top: 1480, width: 200, height: 200, opacity: fadeIn, scale: 1 + 0.07 * Math.exp(-8 * secFrac) }}>
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="86" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.18)" strokeWidth="12" />
            <circle cx="100" cy="100" r="86" fill="none" stroke={ACCENT} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 86}`} strokeDashoffset={`${2 * Math.PI * 86 * (1 - ringPct)}`} transform="rotate(-90 100 100)" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 110, color: "#fff" }}>{left}</div>
        </div>
      ) : (
        <div style={{ position: "absolute", left: 0, top: 1530, width: 1080, textAlign: "center", opacity: clamp((dr - 0.5) / 0.4) * (1 - outroT) }}>
          <div style={{ display: "inline-block", padding: "16px 50px", border: `3px solid ${ACCENT}`, color: "#fff", fontWeight: 700, fontSize: 46, letterSpacing: 8, background: "rgba(0,0,0,0.45)" }}>ŞİMDİ SPOTIFY&apos;DA</div>
        </div>
      )}

      {/* dalga cubuklari */}
      <div style={{ position: "absolute", left: 60, top: 1730, width: 960, height: 130, display: "flex", alignItems: "flex-end", justifyContent: "space-between", opacity: fadeIn * (1 - outroT) }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} style={{ width: 28, height: 10 + (bands[i] ?? 0) * 118, borderRadius: 8, background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT2})`, opacity: 0.55 + 0.4 * (bands[i] ?? 0) }} />
        ))}
      </div>

      {/* kapanis */}
      {outroT > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 860, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
          <div style={{ fontWeight: 700, fontSize: 96, color: "#fff", letterSpacing: 2 }}>DOĞRU BİLDİN Mİ?</div>
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 44, letterSpacing: 8, color: ACCENT, marginTop: 30 }}>@YENISARKILARIM</div>
        </div>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
