import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-risev.json";

// "Yukselen sarki" sablonu: CANLI YAYIN. TV/spor yayin grafigi dili: "SIRA ATLADI" vurusu, DUN -> BUGUN karsilastirmasi,
// donen sira gostergesi (odometre), +N slam ve alt bant. Rakamlar gercek: dun/bugun sirasi, gunluk + toplam stream.
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

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

const NAVY = "#050b22";
const ACCENT = `hsl(${HUE}, 96%, 60%)`;
const ACCENT_D = `hsl(${HUE}, 90%, 38%)`;
const YELLOW = "#ffd60a";
const WHITE = "#ffffff";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (u: number) => clamp(u) * clamp(u) * (3 - 2 * clamp(u));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));
const fmt = (n: number) => (n >= 1e7 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`);

// donen rakam: mekanik odometre gibi; ust basamak yalnizca alt basamak tasinca doner
const DigitRoll: React.FC<{ v: number; place: number; size: number; color: string; glow?: string; blur?: number }> = ({ v, place, size, color, glow, blur = 0 }) => {
  const H = size * 1.06;
  const W = size * 0.56;
  const q = Math.floor(v / 10 ** place) % 10;
  const lowerPos = place === 0 ? 0 : (v / 10 ** (place - 1)) % 10;
  const idx = place === 0 ? v % 10 : q + clamp(lowerPos - 9, 0, 1);
  return (
    <div style={{ width: W, height: H, overflow: "hidden", position: "relative", WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 13%, #000 87%, transparent 100%)", maskImage: "linear-gradient(180deg, transparent 0%, #000 13%, #000 87%, transparent 100%)" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, translate: `0px ${-idx * H}px`, filter: blur > 0.3 ? `blur(${blur}px)` : "none" }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
          <div key={i} style={{ height: H, lineHeight: `${H}px`, fontSize: size, fontWeight: 700, textAlign: "center", color, textShadow: glow }}>
            {d}
          </div>
        ))}
      </div>
    </div>
  );
};

const Chevrons: React.FC<{ t: number; color: string }> = ({ t, color }) => (
  <svg width="120" height="150" viewBox="0 0 120 150">
    {[0, 1, 2].map((i) => (
      <path key={i} d={`M${14 + i * 34} 20 L${48 + i * 34} 75 L${14 + i * 34} 130`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" opacity={0.25 + 0.75 * Math.max(0, Math.sin(t * 9 - i * 0.9))} />
    ))}
  </svg>
);

export const RiseYayin: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.3);
  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const outroT = clamp((t - OUTRO) / 0.6);
  const arrived = t >= ARRIVAL;
  const da = t - ARRIVAL;

  // vurus: SIRA ATLADI
  const slamIn = easeOutBack((t - 0.3) / 0.35);
  const slamOut = clamp((t - (START - 0.45)) / 0.4);
  const shake = Math.max(0, 1 - (t - 0.3) / 0.45) * Math.sin(t * 90) * 14;

  // odometre
  const u = clamp((t - START) / (ARRIVAL - START));
  const v = FROM - CHANGE * smooth(u);
  const nFrom = String(FROM).length;
  const numSize = Math.min(360, 430 / (nFrom * 0.56));
  const places = Array.from({ length: nFrom }, (_, i) => nFrom - 1 - i).filter((p) => p === 0 || Math.round(v) >= 10 ** p);
  const cmpIn = easeOutCubic((t - (START - 0.5)) / 0.5);
  // hizli donerken hareket bulanikligi (basamak basina kare basina kayma)
  const vel = u > 0 && u < 1 ? (CHANGE * 6 * u * (1 - u)) / (ARRIVAL - START) : 0;
  const blurFor = (p: number) => clamp((vel / 10 ** p / fps - 0.3) / 0.9) * 7;

  // +N slam
  const plusP = arrived ? easeOutBack(da / 0.45) : 0;
  const plusN = Math.round(CHANGE * easeOutCubic(da / 0.6));
  const plusShake = arrived ? Math.max(0, 1 - da / 0.4) * Math.sin(da * 110) * 12 : 0;
  const plusSize = Math.min(330, 520 / (String(CHANGE).length * 0.52 + 0.4));

  // alt bant
  const lowerP = easeOutCubic((t - (ARRIVAL + 1.0)) / 0.6);
  const toTop = TO - 1;
  const artistSize = fit(ARTIST, 88, 620, 0.5);
  const titleSize = fit(TITLE, 56, 620, 0.5);

  return (
    <AbsoluteFill style={{ background: NAVY, fontFamily }}>
      <Audio src={staticFile("risev-soundtrack.wav")} />

      {/* yayin arka plani */}
      <AbsoluteFill style={{ background: `linear-gradient(165deg, #040a1f 0%, #0a1c52 52%, #040a1f 100%)`, opacity: fadeIn }} />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: -300 + i * 420 + ((t * (24 + i * 10)) % 140),
            top: -200,
            width: 190 + i * 70,
            height: 2400,
            background: "linear-gradient(180deg, rgba(40,86,214,0), rgba(40,86,214,1), rgba(40,86,214,0))",
            opacity: 0.2 + bass * 0.1,
            rotate: "17deg",
            transformOrigin: "50% 50%",
          }}
        />
      ))}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 55% at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)" }} />

      {/* ust cubuk */}
      <div style={{ position: "absolute", left: 0, top: 64, width: 1080, display: "flex", alignItems: "center", opacity: fadeIn }}>
        <div style={{ background: "#e11d2e", color: WHITE, fontWeight: 700, fontSize: 40, letterSpacing: 5, padding: "8px 28px 8px 40px" }}>CANLI</div>
        <div style={{ background: WHITE, color: NAVY, fontWeight: 700, fontSize: 40, letterSpacing: 5, padding: "8px 28px" }}>TÜRKİYE GÜNLÜK LİSTE</div>
        <div style={{ marginLeft: "auto", paddingRight: 40, fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: "rgba(255,255,255,0.8)" }}>{data.date}</div>
      </div>

      {/* SIRA ATLADI vurusu */}
      {t < START ? (
        <div style={{ position: "absolute", left: 0, top: 640, width: 1080, textAlign: "center", opacity: clamp((t - 0.3) / 0.1) * (1 - slamOut), scale: 1.6 - 0.6 * slamIn, translate: `${shake}px 0px` }}>
          <div style={{ display: "inline-block", background: YELLOW, color: NAVY, fontWeight: 700, fontSize: 250, lineHeight: 1.0, letterSpacing: 4, padding: "6px 60px 0", transform: "skewX(-8deg)", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>SIRA</div>
          <br />
          <div style={{ display: "inline-block", background: WHITE, color: NAVY, fontWeight: 700, fontSize: 250, lineHeight: 1.0, letterSpacing: 4, padding: "6px 60px 0", transform: "skewX(-8deg)", marginTop: -4, boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>ATLADI</div>
        </div>
      ) : null}

      {/* DUN -> BUGUN */}
      {t >= START - 0.5 ? (
        <>
          <div style={{ position: "absolute", left: 40, top: 390, width: 460, textAlign: "center", opacity: cmpIn * (arrived ? 1 - 0.55 * clamp(da / 0.5) : 1), translate: `${(1 - cmpIn) * -80}px 0px` }}>
            <div style={{ display: "inline-block", fontWeight: 700, fontSize: 44, letterSpacing: 12, color: "rgba(255,255,255,0.75)", borderBottom: "4px solid rgba(255,255,255,0.4)", paddingBottom: 6 }}>DÜN</div>
            <div style={{ fontWeight: 700, fontSize: numSize, lineHeight: `${numSize * 1.06}px`, color: "rgba(255,255,255,0.55)", marginTop: 26 }}>{FROM}</div>
          </div>
          <div style={{ position: "absolute", left: 480, top: 640, opacity: cmpIn }}>
            <Chevrons t={t} color={arrived ? YELLOW : WHITE} />
          </div>
          <div style={{ position: "absolute", left: 580, top: 390, width: 460, textAlign: "center", opacity: cmpIn, translate: `${(1 - cmpIn) * 80}px 0px` }}>
            <div style={{ display: "inline-block", fontWeight: 700, fontSize: 44, letterSpacing: 12, color: ACCENT, borderBottom: `4px solid ${ACCENT}`, paddingBottom: 6 }}>BUGÜN</div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 26, scale: arrived ? 1 + 0.08 * Math.exp(-6 * da) : 1, filter: arrived ? `drop-shadow(0 0 ${28 * Math.exp(-2.5 * da) + 8}px ${ACCENT})` : "none" }}>
              {places.map((p) => (
                <DigitRoll key={p} v={v} place={p} size={numSize} color={arrived ? WHITE : "rgba(255,255,255,0.92)"} glow={`0 0 36px ${ACCENT}`} blur={blurFor(p)} />
              ))}
            </div>
          </div>
          {/* varis halkasi */}
          {arrived ? (
            <div style={{ position: "absolute", left: 810 - 230, top: 650 - 230, width: 460, height: 460, borderRadius: "50%", border: `8px solid ${ACCENT}`, opacity: 0.8 * (1 - clamp(da / 0.8)), scale: 0.4 + 1.2 * easeOutCubic(da / 0.8) }} />
          ) : null}
        </>
      ) : null}

      {/* +N slam */}
      {arrived ? (
        <div style={{ position: "absolute", left: 0, top: 900, width: 1080, display: "flex", justifyContent: "center", alignItems: "center", gap: 34, opacity: clamp(da / 0.1) * (1 - outroT), scale: 0.6 + 0.4 * plusP, translate: `${plusShake}px 0px` }}>
          <svg width="170" height="190" viewBox="0 0 20 22">
            <path d="M10 1 L19 13 H13 V21 H7 V13 H1 Z" fill={YELLOW} />
          </svg>
          <div style={{ fontWeight: 700, fontSize: plusSize, lineHeight: 1, color: YELLOW, textShadow: "0 12px 50px rgba(0,0,0,0.6)" }}>+{plusN}</div>
          <div style={{ fontWeight: 700, fontSize: 120, lineHeight: 0.95, color: WHITE, letterSpacing: 4 }}>
            SIRA
            <div style={{ fontWeight: 500, fontSize: 40, letterSpacing: 6, color: "rgba(255,255,255,0.75)", marginTop: 8 }}>YÜKSELDİ</div>
          </div>
        </div>
      ) : null}

      {/* alt bant */}
      {lowerP > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 1290, width: 1080, translate: `${(1 - lowerP) * -1100}px 0px`, opacity: 1 - outroT }}>
          <div style={{ display: "flex", alignItems: "stretch", height: 330 }}>
            <div style={{ width: 330, height: 330, borderRight: `10px solid ${ACCENT}`, overflow: "hidden", flexShrink: 0, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
              <Img src={staticFile("risev-cover.jpg")} style={{ width: 330, height: 330, objectFit: "cover" }} />
            </div>
            <div style={{ flex: 1, background: WHITE, color: NAVY, padding: "22px 36px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 36, letterSpacing: 8, color: ACCENT_D }}>YENİ SIRA · #{TO}</div>
              <div style={{ fontWeight: 700, fontSize: artistSize, lineHeight: 1.02, whiteSpace: "nowrap", marginTop: 4 }}>{ARTIST}</div>
              <div style={{ fontWeight: 500, fontSize: titleSize, lineHeight: 1.05, whiteSpace: "nowrap", color: "rgba(5,11,34,0.78)" }}>{TITLE}</div>
            </div>
          </div>
          <div style={{ display: "flex", background: NAVY, borderTop: `8px solid ${ACCENT}` }}>
            {[
              { k: "GÜNLÜK", v: fmt(data.daily * easeOutCubic((t - ARRIVAL - 1.2) / 1.2)) },
              { k: "TOPLAM", v: fmt(data.total * easeOutCubic((t - ARRIVAL - 1.4) / 1.2)) },
              { k: toTop > 0 ? "ZİRVEYE" : "SIRA", v: toTop > 0 ? `${toTop} SIRA` : "ZİRVEDE" },
            ].map((s, i) => (
              <div key={s.k} style={{ flex: 1, padding: "16px 0 18px", textAlign: "center", borderLeft: i > 0 ? "2px solid rgba(255,255,255,0.18)" : "none" }}>
                <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 6, color: "rgba(255,255,255,0.6)" }}>{s.k}</div>
                <div style={{ fontWeight: 700, fontSize: 60, color: WHITE, lineHeight: 1.1 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* marka cubugu */}
      <div style={{ position: "absolute", left: 0, bottom: 0, width: 1080, height: 96, background: "#e11d2e", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", boxSizing: "border-box", opacity: fadeIn }}>
        <div style={{ fontWeight: 700, fontSize: 48, letterSpacing: 6, color: WHITE }}>@YENISARKILARIM</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ width: 11, height: 8 + (bands[i + 1] ?? 0) * 46, background: WHITE, opacity: 0.55 + 0.45 * (bands[i + 1] ?? 0) }} />
          ))}
        </div>
      </div>

      {/* kapanis */}
      {outroT > 0 ? (
        <>
          <AbsoluteFill style={{ background: `rgba(5,11,34,${0.93 * outroT})` }} />
          <div style={{ position: "absolute", left: 0, top: 640, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
            <div style={{ display: "inline-block", background: YELLOW, color: NAVY, fontWeight: 700, fontSize: 56, letterSpacing: 8, padding: "6px 36px" }}>{toTop > 0 ? `ZİRVEYE ${toTop} SIRA KALDI` : "ZİRVEDE"}</div>
            <div style={{ fontWeight: 700, fontSize: 150, lineHeight: 1.0, color: WHITE, marginTop: 50 }}>SENCE</div>
            <div style={{ fontWeight: 700, fontSize: 150, lineHeight: 1.0, color: ACCENT }}>ÇIKAR MI?</div>
          </div>
        </>
      ) : null}

      <AbsoluteFill style={{ background: WHITE, opacity: arrived ? 0.7 * Math.exp(-12 * da) : 0, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
