import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import data from "./data-risev.json";

// "Yukselen sarki" sablonu: TRANSFER HABERI. "SON DAKIKA: transfer cok yakin" -> sozlesme + imza -> RESMEN damgasi + konfeti -> forma (numara = yeni sira) ve oyuncu karti.
// Rakamlar gercek: dun/bugun sirasi, gunluk + toplam stream, zirveye kalan sira.
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: hand } = loadCaveat("normal", { weights: ["700"], subsets: ["latin", "latin-ext"] });

const BANDS = data.bands as number[][];
const ARTIST = data.artist.toLocaleUpperCase("tr");
const ARTIST_RAW = data.artist;
const TITLE = data.title;
const FROM = data.from;
const TO = data.to;
const CHANGE = data.change;
const START = data.start;
const ARRIVAL = data.arrival;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const HUE = data.hue;

const ACCENT = `hsl(${HUE}, 88%, 52%)`;
const ACCENT_L = `hsl(${HUE}, 88%, 64%)`;
const ACCENT_D = `hsl(${HUE}, 80%, 34%)`;
const RED = "#e11d2e";
const YELLOW = "#ffd60a";
const NAVY = "#050b22";
const CREAM = "#f6efe0";
const INK = "#16203a";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (u: number) => clamp(u) * clamp(u) * (3 - 2 * clamp(u));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const hash = (a: number, b = 0): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));
const fmt = (n: number) => (n >= 1e7 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`);

const S2 = 2.9; // sozlesme sahnesi baslangici
const S3 = 7.2; // forma sahnesi baslangici

const JERSEY = "M 130 14 L 160 0 Q 200 34 240 0 L 270 14 L 392 84 L 344 176 L 304 150 L 304 420 Q 200 440 96 420 L 96 150 L 56 176 L 8 84 Z";

const Jersey: React.FC<{ width: number }> = ({ width }) => {
  const nameSize = Math.min(54, 200 / (Math.max(ARTIST.length, 4) * 0.5));
  return (
    <svg width={width} height={(width * 440) / 400} viewBox="0 0 400 440" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="jg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ACCENT_L} />
          <stop offset="1" stopColor={ACCENT} />
        </linearGradient>
        <clipPath id="jc">
          <path d={JERSEY} />
        </clipPath>
      </defs>
      <path d={JERSEY} fill="rgba(0,0,0,0.35)" transform="translate(10 14)" />
      <path d={JERSEY} fill="url(#jg)" />
      <g clipPath="url(#jc)">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x={20 + i * 56} y="0" width="28" height="440" fill="rgba(255,255,255,0.14)" />
        ))}
        <rect x="0" y="396" width="400" height="14" fill="rgba(255,255,255,0.85)" />
      </g>
      {/* yaka + kol bantlari */}
      <path d="M 150 0 Q 200 52 250 0" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
      <path d="M 392 84 L 344 176" stroke="#fff" strokeWidth="14" />
      <path d="M 8 84 L 56 176" stroke="#fff" strokeWidth="14" />
      {/* sirt: isim + numara */}
      <text x="200" y="126" textAnchor="middle" fontFamily={fontFamily} fontWeight={700} fontSize={nameSize} letterSpacing="4" fill="#fff" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5">
        {ARTIST}
      </text>
      <text x="200" y="316" textAnchor="middle" fontFamily={fontFamily} fontWeight={700} fontSize={String(TO).length > 2 ? 150 : 200} fill="#fff" stroke="rgba(0,0,0,0.28)" strokeWidth="3">
        {TO}
      </text>
    </svg>
  );
};

export const RiseTransfer: React.FC = () => {
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
  const toTop = TO - 1;

  // sayac: sozlesmedeki "YENI SIRA"
  const u = clamp((t - START) / (ARRIVAL - START));
  const rankNow = FROM - CHANGE * smooth(u);
  const rankShown = Math.round(rankNow);

  // S1: haber
  const slamIn = easeOutBack((t - 0.25) / 0.35);
  const shake = Math.max(0, 1 - (t - 0.25) / 0.45) * Math.sin(t * 90) * 14;
  const s1Out = clamp((t - S2) / 0.4);
  const newsText = `${ARTIST_RAW}, listede ${FROM}. sıradan ${TO}. sıraya transfer oluyor. Görüşmeler olumlu sonuçlandı!`;
  const typed = newsText.slice(0, Math.floor(clamp((t - 1.5) / 1.3) * newsText.length));

  // S2: sozlesme
  const sheetIn = easeOutCubic((t - S2) / 0.6);
  const sheetOut = smooth((t - (S3 - 0.2)) / 0.7);
  const rowP = (i: number) => clamp((t - (S2 + 0.5 + i * 0.28)) / 0.3);
  const sigP = clamp((t - (ARRIVAL - 1.15)) / 0.95);
  const stampP = arrived ? clamp(da / 0.16) : 0;
  const stampScale = arrived ? 1 + 1.3 * (1 - easeOutCubic(da / 0.18)) : 2.6;
  const stampShake = arrived ? Math.max(0, 1 - da / 0.5) * Math.sin(da * 120) * 14 : 0;

  // S3: forma
  const lt = t - S3;
  const jerseyP = easeOutBack(lt / 0.7);
  const cardP = easeOutCubic((lt - 0.7) / 0.7);

  const rows = [
    { k: "OYUNCU", v: ARTIST, size: fit(ARTIST, 52, 520, 0.54), color: INK },
    { k: "ŞARKI", v: TITLE.toLocaleUpperCase("tr"), size: fit(TITLE, 52, 520, 0.54), color: INK },
    { k: "ESKİ SIRA", v: `#${FROM}`, size: 56, color: "rgba(22,32,58,0.55)" },
    { k: "YENİ SIRA", v: `#${rankShown}`, size: 64, color: arrived ? "#0a9a55" : INK },
    { k: "BONSERVİS", v: `+${Math.round(FROM - rankNow)} SIRA`, size: 56, color: ACCENT_D },
  ];

  return (
    <AbsoluteFill style={{ background: NAVY, fontFamily }}>
      <Audio src={staticFile("risev-soundtrack.wav")} />

      {/* saha cimi seritleri */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #061a14 0%, #08261c 55%, #061a14 100%)", opacity: fadeIn }} />
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: i * 135 - 20, top: 0, width: 135, height: 1920, background: i % 2 === 0 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.12)", opacity: fadeIn }} />
      ))}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 45% at 50% 40%, hsla(${HUE},80%,45%,${0.22 + bass * 0.12}) 0%, rgba(0,0,0,0) 70%)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 70% at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.65) 100%)" }} />

      {/* ust cubuk */}
      <div style={{ position: "absolute", left: 0, top: 64, width: 1080, display: "flex", alignItems: "center", opacity: fadeIn }}>
        <div style={{ background: RED, color: "#fff", fontWeight: 700, fontSize: 40, letterSpacing: 5, padding: "8px 28px 8px 40px" }}>SON DAKİKA</div>
        <div style={{ background: "#fff", color: NAVY, fontWeight: 700, fontSize: 40, letterSpacing: 5, padding: "8px 28px" }}>TRANSFER</div>
        <div style={{ marginLeft: "auto", paddingRight: 40, fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: "rgba(255,255,255,0.8)" }}>{data.date}</div>
      </div>

      {/* ---- S1: haber ---- */}
      {t < S2 + 0.5 ? (
        <>
          <div style={{ position: "absolute", left: 0, top: 330, width: 1080, textAlign: "center", opacity: clamp((t - 0.25) / 0.1) * (1 - s1Out), scale: 1.5 - 0.5 * slamIn, translate: `${shake - s1Out * 1100}px 0px` }}>
            <div style={{ display: "inline-block", background: YELLOW, color: NAVY, fontWeight: 700, fontSize: 215, lineHeight: 1.0, letterSpacing: 4, padding: "6px 44px 0", transform: "skewX(-8deg)", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>TRANSFER</div>
            <br />
            <div style={{ display: "inline-block", background: "#fff", color: NAVY, fontWeight: 700, fontSize: 215, lineHeight: 1.0, letterSpacing: 4, padding: "6px 44px 0", transform: "skewX(-8deg)", marginTop: -4, boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>ÇOK YAKIN!</div>
          </div>
          <div style={{ position: "absolute", left: 60, top: 980, width: 960, opacity: clamp((t - 1.2) / 0.3) * (1 - s1Out), translate: `${s1Out * 1100}px ${(1 - easeOutCubic((t - 1.2) / 0.5)) * 60}px` }}>
            <div style={{ background: "#fff", borderRadius: 30, padding: "34px 40px 30px", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 22 }}>
                <div style={{ width: 84, height: 84, borderRadius: "50%", background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, color: "#fff", fontFamily: inter, fontWeight: 800, fontSize: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
                <div>
                  <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 38, color: INK }}>Spotify Kaynakları</div>
                  <div style={{ fontFamily: inter, fontWeight: 500, fontSize: 28, color: "rgba(22,32,58,0.55)" }}>transfer muhabiri · şimdi</div>
                </div>
              </div>
              <div style={{ fontFamily: inter, fontWeight: 600, fontSize: 50, lineHeight: 1.22, color: INK, minHeight: 260 }}>
                {typed}
                <span style={{ display: "inline-block", width: 8, height: 46, background: INK, marginLeft: 4, verticalAlign: "-6px", opacity: Math.floor(t * 3) % 2 === 0 ? 1 : 0 }} />
              </div>
              <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 4, color: "rgba(22,32,58,0.5)", marginTop: 14 }}>KAYNAK · SPOTIFY TÜRKİYE GÜNLÜK LİSTE</div>
            </div>
          </div>
        </>
      ) : null}

      {/* ---- S2: sozlesme ---- */}
      {t >= S2 && t < S3 + 0.8 ? (
        <div style={{ position: "absolute", left: 90, top: 300 + (1 - sheetIn) * 1700 + sheetOut * 1800, width: 900, height: 1080, rotate: `${-2 + sheetOut * 14}deg`, background: CREAM, borderRadius: 14, boxShadow: "0 40px 100px rgba(0,0,0,0.6)", padding: "44px 56px", boxSizing: "border-box" }}>
          <div style={{ borderBottom: `6px double ${INK}`, paddingBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 76, letterSpacing: 5, color: INK }}>OYUNCU SÖZLEŞMESİ</div>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 5, color: "rgba(22,32,58,0.55)", marginTop: 4 }}>SPOTIFY TR LİGİ · GÜNLÜK LİSTE · {data.date}</div>
          </div>
          <div style={{ marginTop: 26 }}>
            {rows.map((r, i) => (
              <div key={r.k} style={{ display: "flex", alignItems: "baseline", height: 100, opacity: rowP(i), translate: `${(1 - rowP(i)) * 60}px 0px` }}>
                <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: "rgba(22,32,58,0.6)", whiteSpace: "nowrap" }}>{r.k}</div>
                <div style={{ flex: 1, borderBottom: "4px dotted rgba(22,32,58,0.35)", margin: "0 18px" }} />
                <div style={{ fontFamily: inter, fontWeight: 800, fontSize: r.size, color: r.color, whiteSpace: "nowrap" }}>{r.v}</div>
              </div>
            ))}
          </div>
          {/* imza */}
          <div style={{ position: "absolute", left: 56, bottom: 74, width: 788 }}>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 5, color: "rgba(22,32,58,0.55)" }}>İMZA</div>
            <div style={{ position: "relative", height: 140, borderBottom: `4px solid ${INK}` }}>
              <div style={{ position: "absolute", left: 20, bottom: 6, clipPath: `inset(0 ${(1 - sigP) * 100}% 0 0)`, fontFamily: hand, fontWeight: 700, fontSize: fit(ARTIST_RAW, 130, 600, 0.38), color: "#1b3fa8", rotate: "-4deg", whiteSpace: "nowrap", lineHeight: 1 }}>{ARTIST_RAW}</div>
              <svg width="788" height="140" viewBox="0 0 788 140" style={{ position: "absolute", left: 0, top: 0 }}>
                <path d="M 10 118 C 200 98, 400 132, 560 104 S 720 112, 780 92" fill="none" stroke="#1b3fa8" strokeWidth="5" strokeLinecap="round" strokeDasharray="800" strokeDashoffset={800 * (1 - clamp((sigP - 0.55) / 0.45))} />
              </svg>
            </div>
          </div>
          {/* RESMEN damgasi */}
          {arrived ? (
            <div style={{ position: "absolute", left: 60, top: 600, width: 780, textAlign: "center", opacity: stampP, rotate: "-9deg", scale: stampScale, translate: `${stampShake}px 0px` }}>
              <div style={{ display: "inline-block", border: `16px solid ${RED}`, borderRadius: 26, padding: "0 48px", boxShadow: `inset 0 0 0 5px ${RED}`, color: RED, fontWeight: 700, fontSize: 190, lineHeight: 1.0, letterSpacing: 6, background: "rgba(246,239,224,0.55)", mixBlendMode: "multiply" }}>RESMEN</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* konfeti */}
      {arrived && da < 3.2
        ? Array.from({ length: 80 }).map((_, i) => {
            const vx = (rnd(i, 1) - 0.5) * 1700;
            const vy = -(500 + rnd(i, 2) * 1100);
            const x = 540 + vx * da * 0.62;
            const y = 900 + vy * da + 0.5 * 1700 * da * da;
            const spin = (rnd(i, 3) - 0.5) * 1400 * da;
            const colors = [ACCENT_L, YELLOW, "#ffffff", RED, "#5ee7ff"];
            return <div key={i} style={{ position: "absolute", left: x, top: y, width: 14 + rnd(i, 4) * 16, height: 24 + rnd(i, 5) * 16, background: colors[i % colors.length], rotate: `${spin}deg`, opacity: clamp((3.0 - da) / 0.8) }} />;
          })
        : null}

      {/* ---- S3: forma + oyuncu karti ---- */}
      {lt > 0 ? (
        <>
          <div style={{ position: "absolute", left: 540 - 400, top: 190 + (1 - jerseyP) * 260, width: 800, rotate: `${(1 - jerseyP) * -9}deg`, scale: (0.55 + 0.45 * jerseyP) * (1 + bass * 0.015), opacity: clamp(lt / 0.15) * (1 - outroT), filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.5))" }}>
            <Jersey width={800} />
          </div>
          <div style={{ position: "absolute", left: 60, top: 1190 + (1 - cardP) * 500, width: 960, opacity: (1 - outroT) * clamp(lt / 0.8) }}>
            <div style={{ display: "flex", gap: 30, background: "#fff", borderRadius: 26, padding: 24, boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}>
              <div style={{ width: 280, height: 280, borderRadius: 18, overflow: "hidden", flexShrink: 0, border: `6px solid ${ACCENT}` }}>
                <Img src={staticFile("risev-cover.jpg")} style={{ width: 268, height: 268, objectFit: "cover" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "inline-block", background: RED, color: "#fff", fontWeight: 700, fontSize: 34, letterSpacing: 6, padding: "2px 18px" }}>RESMEN · #{TO}</div>
                  <div style={{ fontWeight: 700, fontSize: fit(ARTIST, 80, 560, 0.5), lineHeight: 1.05, color: INK, marginTop: 10, whiteSpace: "nowrap" }}>{ARTIST}</div>
                  <div style={{ fontFamily: inter, fontWeight: 600, fontSize: fit(TITLE, 40, 560, 0.55), color: "rgba(22,32,58,0.7)", whiteSpace: "nowrap" }}>{TITLE}</div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  {[
                    { k: "GÜNLÜK", v: fmt(data.daily * easeOutCubic((lt - 1.0) / 1.2)), bg: INK },
                    { k: "TOPLAM", v: fmt(data.total * easeOutCubic((lt - 1.1) / 1.2)), bg: INK },
                    { k: "KAZANÇ", v: `+${CHANGE}`, bg: ACCENT_D },
                  ].map((s) => (
                    <div key={s.k} style={{ background: s.bg, borderRadius: 14, padding: "6px 16px 8px", color: "#fff" }}>
                      <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 18, letterSpacing: 4, opacity: 0.75 }}>{s.k}</div>
                      <div style={{ fontWeight: 700, fontSize: 48, lineHeight: 1.05 }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", fontFamily: mono, fontWeight: 700, fontSize: 30, letterSpacing: 5, color: "#fff" }}>
              <span style={{ color: YELLOW }}>#{FROM} → #{TO}</span>
              <span>{toTop > 0 ? `ZİRVEYE ${toTop} SIRA` : "ZİRVEDE"}</span>
            </div>
          </div>
        </>
      ) : null}

      <div style={{ position: "absolute", left: 0, bottom: 0, width: 1080, height: 84, background: RED, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", boxSizing: "border-box", opacity: fadeIn }}>
        <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 6, color: "#fff" }}>@YENISARKILARIM</div>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 4, color: "rgba(255,255,255,0.85)" }}>TRANSFER MASASI</div>
      </div>

      {/* kapanis */}
      {outroT > 0 ? (
        <>
          <AbsoluteFill style={{ background: `rgba(5,11,34,${0.94 * outroT})` }} />
          <div style={{ position: "absolute", left: 0, top: 640, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
            <div style={{ display: "inline-block", background: YELLOW, color: NAVY, fontWeight: 700, fontSize: 52, letterSpacing: 8, padding: "6px 34px" }}>RESMEN #{TO}</div>
            <div style={{ fontWeight: 700, fontSize: 130, lineHeight: 1.0, color: "#fff", marginTop: 50 }}>SENCE KAÇINCI</div>
            <div style={{ fontWeight: 700, fontSize: 130, lineHeight: 1.0, color: ACCENT_L }}>SIRADA BİTİRİR?</div>
          </div>
        </>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: arrived ? 0.8 * Math.exp(-11 * da) : 0, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
