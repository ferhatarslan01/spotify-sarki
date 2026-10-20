import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import data from "./data-risev.json";

// "Yukselen sarki" sablonu: DERGI KARTI. Duz renk bloklari + dev tipografi, kartlar arasi renk perdeleri (Wrapped tarzi).
// Rakamlar gercek: dun/bugun sirasi, gunluk + toplam stream, zirveye kalan sira.
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });

const BANDS = data.bands as number[][];
const ARTIST = data.artist.toLocaleUpperCase("tr");
const TITLE = data.title.toLocaleUpperCase("tr");
const FROM = data.from;
const TO = data.to;
const CHANGE = data.change;
const START = data.start;
const ARRIVAL = data.arrival;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const HUE = data.hue;
const C2T = (data.marks as { c2?: number }).c2 ?? 3.0;
const C3T = (data.marks as { c3?: number }).c3 ?? 7.0;

const C1 = `hsl(${HUE}, 90%, 56%)`;
const C2 = `hsl(${(HUE + 170) % 360}, 80%, 64%)`;
const DARK = "#0c0c10";
const CREAM = "#fff4df";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (text: string, max: number, width: number, k = 0.46) => Math.min(max, width / (Math.max(text.length, 3) * k));
const fmt = (n: number) => (n >= 1e7 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`);

// satir maskeli yukari kayma
const Line: React.FC<{ lt: number; delay: number; size: number; color: string; bg?: string; children: React.ReactNode; pad?: string }> = ({ lt, delay, size, color, bg, children, pad }) => {
  const p = easeOutCubic((lt - delay) / 0.5);
  return (
    <div style={{ overflow: "hidden", height: size * 1.02, marginBottom: 6 }}>
      <div style={{ translate: `0px ${(1 - p) * size * 1.1}px`, display: "inline-block", background: bg, padding: pad, color, fontWeight: 700, fontSize: size, lineHeight: `${size * 1.02}px`, letterSpacing: 2, whiteSpace: "nowrap" }}>{children}</div>
    </div>
  );
};

export const RiseKart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;
  const fadeOut = clamp((t - (DUR - 0.6)) / 0.6);

  const card = t < C2T ? 1 : t < C3T ? 2 : t < OUTRO ? 3 : 4;
  const t0 = [0, 0, C2T, C3T, OUTRO][card];
  const lt = t - t0;

  // perdeler: iki renk blogu soldan sola suzulur, ortada (t0) kart degisir
  const wipe = (center: number, off: number) => {
    const p = clamp((t - (center - 0.28 + off)) / 0.56);
    return (1 - p * 2) * 1500 - 210;
  };
  const wipeActive = (center: number) => t >= center - 0.3 && t <= center + 0.4;

  const n = Math.round(CHANGE * easeOutCubic((t - START) / (ARRIVAL - START)));
  const arrived = t >= ARRIVAL;
  const da = t - ARRIVAL;
  const bigSize = Math.min(560, 940 / (String(CHANGE).length * 0.5 + 0.35));
  const toTop = TO - 1;

  // zirve cubugu: 50 ya da 100 dilim; solda en dusuk sira, sagda #1
  const S = TO <= 50 ? 50 : 100;
  const segW = 940 / S;
  const barP = easeOutCubic((lt - 1.6) / 1.4);
  const lit = Math.round((S - Math.min(S, TO) + 1) * barP);
  const fromSeg = S - Math.min(S, FROM); // onceki konum (dilim indeksi)

  const titleSize = fit(TITLE, 150, 940, 0.46);
  const artistSize = fit(ARTIST, 84, 940, 0.5);
  const coverP = easeOutBack(lt / 0.6);

  return (
    <AbsoluteFill style={{ background: DARK, fontFamily }}>
      <Audio src={staticFile("risev-soundtrack.wav")} />

      {/* ---- KART 1: giris ---- */}
      {card === 1 ? (
        <AbsoluteFill style={{ background: C1 }}>
          <div style={{ position: "absolute", right: -330, bottom: -260, width: 940, height: 940, borderRadius: "50%", border: `34px solid ${CREAM}`, opacity: 0.35, scale: 1 + bass * 0.06 }} />
          <div style={{ position: "absolute", left: -140, top: 1180, width: 520, height: 520, background: DARK, rotate: "18deg", opacity: 0.9 }} />
          <div style={{ position: "absolute", left: 70, top: 120, fontFamily: inter, fontWeight: 700, fontSize: 36, letterSpacing: 6, color: DARK }}>
            TÜRKİYE · GÜNLÜK LİSTE · {data.date}
          </div>
          <div style={{ position: "absolute", left: 70, top: 480 }}>
            <Line lt={lt} delay={0.25} size={250} color={CREAM}>BUGÜN</Line>
            <Line lt={lt} delay={0.65} size={fit("BİR ŞARKI", 250, 940, 0.5)} color={DARK}>BİR ŞARKI</Line>
            <div style={{ height: 24 }} />
            <Line lt={lt} delay={1.05} size={170} color={C1} bg={DARK} pad="0 30px">UÇUŞA GEÇTİ</Line>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ---- KART 2: sira atlama ---- */}
      {card === 2 ? (
        <AbsoluteFill style={{ background: DARK }}>
          <div style={{ position: "absolute", left: 540 - 520, top: 560 - 520 + 220, width: 1040, height: 1040, borderRadius: "50%", background: C1, opacity: 0.16 + bass * 0.1, scale: arrived ? 1 + 0.15 * Math.exp(-4 * da) : 1 }} />
          <div style={{ position: "absolute", left: 70, top: 120, fontFamily: inter, fontWeight: 700, fontSize: 36, letterSpacing: 6, color: C1 }}>SIRA ATLADI</div>
          <div style={{ position: "absolute", left: 0, top: 330, width: 1080, textAlign: "center", fontWeight: 700, fontSize: bigSize, lineHeight: 1, color: CREAM, scale: arrived ? 1 + 0.07 * Math.exp(-7 * da) : 1 }}>
            <span style={{ color: C1 }}>+</span>
            {n}
          </div>
          <div style={{ position: "absolute", left: 0, top: 330 + bigSize * 1.0, width: 1080, textAlign: "center", fontWeight: 700, fontSize: 250, lineHeight: 1, color: "transparent", WebkitTextStroke: `7px ${CREAM}`, letterSpacing: 10 }}>SIRA</div>
          <div style={{ position: "absolute", left: 0, top: 330 + bigSize + 330, width: 1080, display: "flex", justifyContent: "center", alignItems: "center", gap: 30, opacity: clamp((lt - 0.8) / 0.4) }}>
            <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 70, color: "rgba(255,244,223,0.6)", border: "5px solid rgba(255,244,223,0.4)", borderRadius: 60, padding: "6px 36px" }}>#{FROM}</div>
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none" stroke={C1} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 40 H100 M70 10 L104 40 L70 70" />
            </svg>
            <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 70, color: DARK, background: arrived ? C1 : CREAM, borderRadius: 60, padding: "6px 36px", scale: arrived ? 1 + 0.12 * Math.exp(-7 * da) : 1 }}>#{TO}</div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ---- KART 3: sarki ---- */}
      {card === 3 ? (
        <AbsoluteFill style={{ background: CREAM }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 150, background: C2 }} />
          <div style={{ position: "absolute", left: 60, top: 52, fontFamily: inter, fontWeight: 800, fontSize: 44, letterSpacing: 6, color: DARK }}>YENİ SIRA · #{TO}</div>
          <div style={{ position: "absolute", right: 60, top: 60, fontFamily: inter, fontWeight: 600, fontSize: 30, color: DARK }}>{data.date}</div>
          <div style={{ position: "absolute", left: 230, top: 230 + (1 - coverP) * 60, width: 620, height: 620, rotate: "-3deg", scale: (0.8 + 0.2 * coverP) * (1 + bass * 0.02), opacity: clamp(lt / 0.15), boxShadow: `26px 26px 0 ${DARK}`, border: `8px solid ${DARK}` }}>
            <Img src={staticFile("risev-cover.jpg")} style={{ width: 604, height: 604, objectFit: "cover", display: "block" }} />
          </div>
          <div style={{ position: "absolute", left: 70, top: 950, width: 940, opacity: clamp((lt - 0.3) / 0.3), translate: `0px ${(1 - easeOutCubic((lt - 0.3) / 0.5)) * 50}px` }}>
            <div style={{ fontWeight: 700, fontSize: titleSize, lineHeight: 1.0, color: DARK, whiteSpace: "nowrap" }}>{TITLE}</div>
            <div style={{ fontWeight: 700, fontSize: artistSize, lineHeight: 1.1, color: DARK, opacity: 0.7, marginTop: 6, whiteSpace: "nowrap" }}>{ARTIST}</div>
          </div>
          <div style={{ position: "absolute", left: 70, top: 1270, display: "flex", gap: 22, opacity: clamp((lt - 0.7) / 0.3) }}>
            {[
              { k: "GÜNLÜK", v: fmt(data.daily * easeOutCubic((lt - 0.8) / 1.2)) },
              { k: "TOPLAM", v: fmt(data.total * easeOutCubic((lt - 0.9) / 1.2)) },
            ].map((c) => (
              <div key={c.k} style={{ background: DARK, color: CREAM, borderRadius: 24, padding: "14px 36px 18px" }}>
                <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 26, letterSpacing: 5, opacity: 0.7 }}>{c.k}</div>
                <div style={{ fontWeight: 700, fontSize: 84, lineHeight: 1.05 }}>{c.v}</div>
              </div>
            ))}
            <div style={{ background: C1, color: DARK, borderRadius: 24, padding: "14px 36px 18px" }}>
              <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 26, letterSpacing: 5, opacity: 0.75 }}>DEĞİŞİM</div>
              <div style={{ fontWeight: 700, fontSize: 84, lineHeight: 1.05 }}>+{CHANGE}</div>
            </div>
          </div>
          <div style={{ position: "absolute", left: 70, top: 1520, width: 940, opacity: clamp((lt - 1.3) / 0.3) }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: inter, fontWeight: 800, fontSize: 32, letterSpacing: 4, color: DARK, marginBottom: 16 }}>
              <span>{toTop > 0 ? `ZİRVEYE ${toTop} SIRA KALDI` : "ZİRVEDE"}</span>
              <span style={{ opacity: 0.55 }}>#{S} → #1</span>
            </div>
            <div style={{ display: "flex", gap: 0, height: 78, position: "relative" }}>
              {Array.from({ length: S }).map((_, i) => {
                const on = i < lit;
                const isNow = i === lit - 1 && lit > 0;
                return <div key={i} style={{ width: segW - 3, marginRight: 3, height: isNow ? 78 : 56, marginTop: isNow ? 0 : 11, background: on ? (isNow ? C1 : DARK) : "rgba(12,12,16,0.14)", borderRadius: 3 }} />;
              })}
              {fromSeg >= 0 && fromSeg < S ? <div style={{ position: "absolute", left: fromSeg * segW - 2, top: -16, width: 6, height: 110, background: C1, opacity: 0.0 }} /> : null}
            </div>
          </div>
          <div style={{ position: "absolute", left: 70, bottom: 70, fontFamily: inter, fontWeight: 800, fontSize: 44, letterSpacing: 6, color: DARK }}>@YENISARKILARIM</div>
        </AbsoluteFill>
      ) : null}

      {/* ---- KART 4: kapanis ---- */}
      {card === 4 ? (
        <AbsoluteFill style={{ background: C2 }}>
          <div style={{ position: "absolute", left: -200, bottom: -300, width: 900, height: 900, borderRadius: "50%", background: DARK, opacity: 0.12 }} />
          <div style={{ position: "absolute", left: 70, top: 130, fontFamily: inter, fontWeight: 800, fontSize: 40, letterSpacing: 6, color: DARK }}>{toTop > 0 ? `ZİRVEYE ${toTop} SIRA KALDI` : "ZİRVEDE"}</div>
          <div style={{ position: "absolute", left: 70, top: 330 }}>
            <Line lt={lt} delay={0.15} size={265} color={DARK}>SENCE</Line>
            <Line lt={lt} delay={0.4} size={265} color={CREAM} bg={DARK} pad="0 24px">ZİRVEYE</Line>
            <Line lt={lt} delay={0.65} size={265} color={DARK}>ÇIKAR</Line>
            <Line lt={lt} delay={0.9} size={265} color={DARK}>Mİ?</Line>
          </div>
          <div style={{ position: "absolute", left: 70, bottom: 120, fontFamily: inter, fontWeight: 800, fontSize: 54, letterSpacing: 6, color: DARK, opacity: clamp((lt - 1.2) / 0.4) }}>@YENISARKILARIM</div>
        </AbsoluteFill>
      ) : null}

      {/* ---- perdeler ---- */}
      {[C2T, C3T, OUTRO].map((c, i) =>
        wipeActive(c) ? (
          <React.Fragment key={c}>
            <div style={{ position: "absolute", left: wipe(c, 0.0), top: 0, width: 1500, height: 1920, background: i === 1 ? C1 : DARK, transform: "skewX(-10deg)" }} />
            <div style={{ position: "absolute", left: wipe(c, 0.09), top: 0, width: 1500, height: 1920, background: i === 0 ? C2 : i === 1 ? DARK : C1, transform: "skewX(-10deg)" }} />
          </React.Fragment>
        ) : null
      )}

      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
