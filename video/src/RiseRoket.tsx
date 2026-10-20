import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-risev.json";

// "Yukselen sarki" sablonu: ROKET (GOREV KONTROL). Sira = irtifa: geri sayim, kalkis, akan irtifa cetveli, yuk olarak sarki kapagi,
// "yorungeye X sira kaldi". Rakamlar gercek: dun/bugun sirasi, gunluk + toplam stream.
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

const ACCENT = `hsl(${HUE}, 92%, 58%)`;
const ACCENT_D = `hsl(${HUE}, 80%, 38%)`;
const CYAN = "#5ee7ff";
const ORANGE = "#ff8a3d";
const WHITE = "#f4f7ff";

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
const fit = (text: string, max: number, width: number, k = 0.55) => Math.min(max, width / (Math.max(text.length, 3) * k));
const fmt = (n: number) => (n >= 1e7 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`);
const mix = (a: number[], b: number[], k: number) => a.map((x, i) => Math.round(x + (b[i] - x) * clamp(k)));
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

// dunya: piksel / sira (az sira atlayan sarkida da belirgin yukselis hissi)
const PXR = Math.min(60, Math.max(14, 1400 / CHANGE));
const REF_Y = 900; // irtifa isaretcisinin (roketin penceresi) ekran yuksekligi
const LABEL_STEP = Math.ceil(100 / PXR / 5) * 5;

const Rocket: React.FC<{ thrust: number; flick: number; cover: boolean }> = ({ thrust, flick, cover }) => {
  const L = thrust > 0.02 ? (140 + 420 * thrust) * (0.86 + 0.28 * flick) : 0;
  const W = 95 + 40 * thrust;
  return (
    <svg width="560" height="1300" viewBox="0 0 560 1300" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b9c3d6" />
          <stop offset="0.35" stopColor="#ffffff" />
          <stop offset="1" stopColor="#aab5ca" />
        </linearGradient>
        <linearGradient id="flameOut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.45" stopColor={ORANGE} />
          <stop offset="1" stopColor="#ff3d00" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="flameIn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#ffe26a" />
          <stop offset="1" stopColor="#ffb300" stopOpacity="0" />
        </linearGradient>
        <clipPath id="port">
          <circle cx="280" cy="300" r="66" />
        </clipPath>
        <filter id="fblur" x="-30%" y="-10%" width="160%" height="130%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      {/* alev */}
      {L > 0 ? (
        <g transform="translate(0,650)">
          <ellipse cx="280" cy={L * 0.3} rx={W * 1.8} ry={L * 0.55} fill={ORANGE} opacity={0.28 * thrust} filter="url(#fblur)" />
          <path d={`M ${280 - W} 0 Q ${280 - W * 0.7} ${L * 0.55} 280 ${L} Q ${280 + W * 0.7} ${L * 0.55} ${280 + W} 0 Z`} fill="url(#flameOut)" filter="url(#fblur)" opacity="0.9" />
          <path d={`M ${280 - W * 0.62} 0 Q ${280 - W * 0.4} ${L * 0.42} 280 ${L * 0.72} Q ${280 + W * 0.4} ${L * 0.42} ${280 + W * 0.62} 0 Z`} fill="url(#flameIn)" />
        </g>
      ) : null}
      {/* kanatcik */}
      <path d="M 150 470 L 40 660 L 150 620 Z" fill={ACCENT_D} />
      <path d="M 410 470 L 520 660 L 410 620 Z" fill={ACCENT_D} />
      {/* meme */}
      <path d="M 190 610 L 370 610 L 340 660 L 220 660 Z" fill="#2b3342" />
      {/* govde */}
      <path d="M 280 20 C 372 110 400 250 400 400 L 400 615 L 160 615 L 160 400 C 160 250 188 110 280 20 Z" fill="url(#body)" />
      {/* burun rengi */}
      <path d="M 280 20 C 322 62 346 108 358 150 L 202 150 C 214 108 238 62 280 20 Z" fill={ACCENT} />
      <rect x="160" y="520" width="240" height="26" fill={ACCENT} opacity="0.9" />
      <rect x="160" y="556" width="240" height="8" fill="#2b3342" opacity="0.5" />
      {/* pencere: kapak = yuk */}
      <circle cx="280" cy="300" r="84" fill="#1c2434" />
      <circle cx="280" cy="300" r="78" fill="none" stroke="#7d8aa6" strokeWidth="8" />
      {cover ? <image href={staticFile("risev-cover.jpg")} x="214" y="234" width="132" height="132" preserveAspectRatio="xMidYMid slice" clipPath="url(#port)" /> : null}
      <circle cx="280" cy="300" r="66" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <text x="280" y="460" textAnchor="middle" fontFamily={mono} fontWeight={700} fontSize="26" letterSpacing="6" fill="#3a4660">
        SPOTIFY TR
      </text>
    </svg>
  );
};

export const RiseRoket: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.4);
  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const outroT = clamp((t - OUTRO) / 0.6);
  const arrived = t >= ARRIVAL;
  const da = t - ARRIVAL;

  // irtifa
  const u = clamp((t - START) / (ARRIVAL - START));
  const p = smooth(u);
  const rankNow = FROM - CHANGE * p;
  const rankShown = Math.round(rankNow);
  const gained = Math.round(FROM - rankNow);
  const vel = u > 0 && u < 1 ? (6 * u * (1 - u) * CHANGE) / (ARRIVAL - START) : 0;
  const speed01 = clamp(vel / ((1.5 * CHANGE) / (ARRIVAL - START)));
  const D = (FROM - rankNow) * PXR; // kat edilen yukselis (px)

  // itki: ateslemeden itibaren, varista kesilir
  const thrust = t < 1.9 ? 0 : t < START ? 0.3 + 0.35 * clamp((t - 1.9) / 0.7) : t < ARRIVAL + 0.15 ? 1 : Math.max(0, 1 - (t - ARRIVAL - 0.15) / 0.5);
  const flick = rnd(frame, 5);

  // roket konumu: rampada baslar, kalkista yerini bulur; varista kuculup yukari cekilir
  const lift = smooth((t - (START - 0.1)) / 1.9);
  const padY = 330 * (1 - lift);
  const post = easeOutCubic((da - 0.3) / 1.0);
  const rocketScale = arrived ? 1 - 0.38 * post : 1;
  const rocketShiftY = arrived ? -300 * post : 0;
  const sway = Math.sin(t * 3.1) * (0.4 + 1.6 * speed01);
  const shakeAmp = t > 1.9 && t < START + 1.8 ? (3 + 5 * thrust) * (1 - clamp((t - START) / 2.2) * 0.7) : arrived ? 0 : 2 * speed01;
  const shakeX = Math.sin(t * 83) * shakeAmp;
  const shakeY = Math.cos(t * 71) * shakeAmp * 0.6;

  // gokyuzu: alacakaranlik -> uzay
  const alt = clamp(p * 0.95 + (arrived ? 0.05 : 0));
  const top = mix([14, 28, 70], [2, 4, 12], alt * 1.15);
  const mid = mix([40, 70, 140], [4, 8, 24], alt * 1.05);
  const bot = mix([232, 134, 70], [10, 20, 48], alt * 1.25);

  // geri sayim
  const cd = [
    { n: "3", at: 0.2 },
    { n: "2", at: 0.9 },
    { n: "1", at: 1.6 },
  ];
  const cdNow = cd.filter((c) => t >= c.at && t < c.at + 0.7)[0];

  const clock = t < START ? `T-${String(Math.max(0, Math.ceil(START - t))).padStart(2, "0")}` : `T+${(t - START).toFixed(1).padStart(4, "0")}`;
  const status = t < 0.3 ? "SİSTEM KONTROLÜ" : t < 1.9 ? "GERİ SAYIM" : t < START ? "MOTOR ATEŞLEME" : !arrived ? "İRTİFA KAZANILIYOR" : "MİSYON BAŞARILI";
  const toTop = TO - 1;

  // cetvel: sira -> ekran y
  const yOfRank = (r: number) => REF_Y + (r - rankNow) * PXR;
  const rMin = Math.max(1, Math.floor(rankNow - (REF_Y + 100) / PXR));
  const rMax = Math.min(FROM + 12, Math.ceil(rankNow + (1920 - REF_Y + 100) / PXR));
  const ticks: number[] = [];
  for (let r = rMin; r <= rMax; r++) ticks.push(r);

  const hudP = clamp((t - 0.4) / 0.5);
  const rulerAlpha = arrived ? 1 - 0.65 * post : 1;
  const cardP = easeOutCubic((da - 0.9) / 0.8);
  const bannerA = arrived && da < 2.1 ? clamp(da / 0.15) * (1 - clamp((da - 1.5) / 0.5)) : 0;

  return (
    <AbsoluteFill style={{ background: "#02040c", fontFamily }}>
      <Audio src={staticFile("risev-soundtrack.wav")} />

      {/* gokyuzu */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${rgb(top)} 0%, ${rgb(mid)} 55%, ${rgb(bot)} 100%)`, opacity: fadeIn }} />
      {/* yildizlar */}
      {Array.from({ length: 150 }).map((_, i) => {
        const depth = 0.3 + rnd(i, 3) * 0.9;
        const y = (rnd(i, 2) * 1920 + D * 0.3 * depth + 3000) % 1920;
        const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + rnd(i, 7) * 3) + i);
        const vis = clamp(alt * 1.5 + 0.1 - (y / 1920) * 0.25);
        const s = 1.6 + rnd(i, 4) * 3.2 * depth;
        return <div key={i} style={{ position: "absolute", left: rnd(i, 1) * 1080, top: y, width: s, height: s + speed01 * 16 * depth, borderRadius: s, background: "#fff", opacity: vis * tw }} />;
      })}
      {/* bulutlar */}
      {Array.from({ length: 8 }).map((_, i) => {
        const y = ((rnd(i, 11) * 2200 + D * (0.9 + rnd(i, 12) * 0.5) + 4000) % 2500) - 300;
        return <div key={i} style={{ position: "absolute", left: rnd(i, 13) * 1100 - 250, top: y, width: 620 + rnd(i, 14) * 380, height: 110 + rnd(i, 15) * 80, borderRadius: "50%", background: "rgba(255,236,220,0.9)", filter: "blur(40px)", opacity: clamp(0.5 - alt * 0.7) }} />;
      })}
      {/* hiz cizgileri */}
      {speed01 > 0.05
        ? Array.from({ length: 22 }).map((_, i) => {
            const len = 140 + speed01 * 520;
            const y = ((rnd(i, 21) * 2400 + t * (2200 + rnd(i, 22) * 1400) * speed01) % 2400) - 240;
            return <div key={i} style={{ position: "absolute", left: rnd(i, 20) * 1080, top: y, width: 3, height: len, background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.7))", opacity: 0.5 * speed01 }} />;
          })
        : null}

      {/* zemin + rampa kulesi (yukselirken asagi kayar) */}
      {t < START + 3.2 ? (
        <div style={{ position: "absolute", left: 0, top: 1560 + (330 - padY) + D * 1.1, width: 1080, height: 500 }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 500, background: "linear-gradient(180deg, #1a1420 0%, #0a0810 100%)" }} />
          <div style={{ position: "absolute", left: 0, top: -6, width: 1080, height: 10, background: ORANGE, opacity: 0.55 }} />
          <div style={{ position: "absolute", left: 70, top: -700, width: 110, height: 700, background: "#10131c", boxShadow: "inset 0 0 0 6px #1d2230" }} />
          {[0, 1, 2, 3, 4].map((k) => (
            <div key={k} style={{ position: "absolute", left: 70, top: -660 + k * 140, width: 110, height: 6, background: "#2b3346" }} />
          ))}
          <div style={{ position: "absolute", left: 180, top: -560, width: 120, height: 8, background: "#2b3346" }} />
          <div style={{ position: "absolute", left: 180, top: -300, width: 120, height: 8, background: "#2b3346" }} />
        </div>
      ) : null}
      {/* ates dumani */}
      {t > 1.7 && t < START + 3.2
        ? Array.from({ length: 16 }).map((_, i) => {
            const age = t - 1.7 - rnd(i, 31) * 0.8;
            if (age < 0) return null;
            const side = i % 2 === 0 ? -1 : 1;
            const r = 70 + age * 120;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 540 + side * (60 + age * (110 + rnd(i, 32) * 120)) - r,
                  top: 1555 + (330 - padY) + D * 1.1 - 40 - r * 0.4 - rnd(i, 33) * 30,
                  width: r * 2,
                  height: r * 1.3,
                  borderRadius: "50%",
                  background: "rgba(255,238,224,0.8)",
                  filter: "blur(28px)",
                  opacity: clamp(0.55 - age * 0.16) * clamp(thrust * 1.4),
                }}
              />
            );
          })
        : null}

      {/* roket */}
      <div style={{ position: "absolute", left: 540 - 280, top: 600 + padY + rocketShiftY, width: 560, height: 1300, translate: `${shakeX}px ${shakeY}px`, rotate: `${sway}deg`, scale: rocketScale, transformOrigin: "50% 40%", opacity: fadeIn * (1 - outroT) }}>
        <Rocket thrust={thrust * (0.9 + bass * 0.2)} flick={flick} cover />
      </div>

      {/* irtifa cetveli */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: hudP * rulerAlpha * (1 - outroT) }}>
        <div style={{ position: "absolute", left: 174, top: 0, width: 3, height: 1920, background: "rgba(94,231,255,0.5)" }} />
        {ticks.map((r) => {
          const major = r % LABEL_STEP === 0;
          const y = yOfRank(r);
          if (y < 150 || y > 1790) return null;
          return (
            <div key={r}>
              <div style={{ position: "absolute", left: major ? 130 : 152, top: y - 1.5, width: major ? 48 : 26, height: 3, background: CYAN, opacity: major ? 0.95 : 0.5 }} />
              {major ? <div style={{ position: "absolute", left: 20, top: y - 17, width: 100, textAlign: "right", fontFamily: mono, fontWeight: 700, fontSize: 28, color: CYAN }}>{r}</div> : null}
            </div>
          );
        })}
        {/* TOP 10 cizgisi */}
        {yOfRank(10) > 150 && yOfRank(10) < 1790 ? (
          <div style={{ position: "absolute", left: 180, top: yOfRank(10) - 2, width: 880, height: 0, borderTop: `4px dashed ${ORANGE}`, opacity: 0.8 }}>
            <div style={{ position: "absolute", right: 0, top: -46, fontFamily: mono, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: ORANGE }}>TOP 10</div>
          </div>
        ) : null}
        {/* irtifa isaretcisi */}
        <div style={{ position: "absolute", left: 178, top: REF_Y - 2, width: 220, height: 4, background: ORANGE, boxShadow: `0 0 18px ${ORANGE}` }} />
        <div style={{ position: "absolute", left: 20, top: REF_Y - 36, width: 128, height: 72, background: ORANGE, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontWeight: 700, fontSize: 44, color: "#1a0d04" }}>
          {rankShown}
        </div>
      </div>

      {/* geri sayim */}
      {cdNow ? (
        <div style={{ position: "absolute", left: 0, top: 640, width: 1080, textAlign: "center", fontWeight: 700, fontSize: 520, lineHeight: 1, color: WHITE, opacity: 0.95 * (1 - clamp((t - cdNow.at) / 0.7)), scale: 1.25 - 0.25 * easeOutCubic((t - cdNow.at) / 0.25), textShadow: `0 0 60px ${CYAN}` }}>
          {cdNow.n}
        </div>
      ) : null}
      {t >= START - 0.05 && t < START + 1.1 ? (
        <div style={{ position: "absolute", left: 0, top: 800, width: 1080, textAlign: "center", fontWeight: 700, fontSize: 190, letterSpacing: 8, color: ORANGE, opacity: 1 - clamp((t - START) / 1.0), scale: 0.9 + 0.3 * easeOutCubic((t - START) / 0.6), textShadow: "0 0 50px rgba(255,138,61,0.7)" }}>
          KALKIŞ!
        </div>
      ) : null}

      {/* ust HUD */}
      <div style={{ position: "absolute", left: 50, top: 66, opacity: hudP * (1 - outroT) }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 7, color: CYAN }}>GÖREV KONTROL</div>
        <div style={{ fontWeight: 700, fontSize: 46, letterSpacing: 3, color: WHITE, marginTop: 4 }}>SPOTIFY TR · GÜNLÜK</div>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 26, color: "rgba(244,247,255,0.65)", marginTop: 2 }}>{data.date}</div>
      </div>
      <div style={{ position: "absolute", right: 50, top: 70, padding: "10px 26px", border: `2px solid ${CYAN}`, background: "rgba(6,16,36,0.6)", fontFamily: mono, fontWeight: 700, fontSize: 54, color: t < START ? ORANGE : CYAN, opacity: hudP * (1 - outroT) }}>
        {clock}
      </div>
      <div style={{ position: "absolute", left: 50, top: 235, width: 980, padding: "10px 22px", border: "2px solid rgba(94,231,255,0.5)", background: "rgba(6,16,36,0.55)", display: "flex", alignItems: "center", gap: 20, opacity: clamp((t - 0.7) / 0.5) * (1 - outroT) }}>
        <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 5, color: CYAN }}>YÜK</span>
        <span style={{ fontWeight: 700, fontSize: fit(`${ARTIST} — ${TITLE}`, 44, 780, 0.5), color: WHITE, whiteSpace: "nowrap" }}>
          {ARTIST} — {TITLE}
        </span>
      </div>

      {/* telemetri */}
      <div style={{ position: "absolute", left: 760, top: 400, width: 280, padding: "18px 22px", border: `2px solid ${CYAN}`, background: "rgba(6,16,36,0.62)", opacity: clamp((t - (START - 0.6)) / 0.5) * (1 - outroT) * (1 - 0.85 * bannerA) }}>
        {[
          { k: "İRTİFA", v: `#${rankShown}`, c: WHITE },
          { k: "KAZANÇ", v: `+${gained}`, c: ORANGE },
          { k: "KALKIŞ", v: `#${FROM}`, c: "rgba(244,247,255,0.6)" },
          { k: "ZİRVEYE", v: toTop > 0 ? `${Math.max(0, rankShown - 1)}` : "0", c: CYAN },
        ].map((r) => (
          <div key={r.k} style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 22, letterSpacing: 5, color: CYAN, opacity: 0.8 }}>{r.k}</div>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 60, lineHeight: 1.05, color: r.c }}>{r.v}</div>
          </div>
        ))}
      </div>

      {/* durum cubugu */}
      <div style={{ position: "absolute", left: 50, bottom: 56, width: 980, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: fadeIn * (1 - outroT) }}>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: arrived ? "#7dffb0" : CYAN }}>● {status}</div>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 5, color: "rgba(244,247,255,0.7)" }}>@YENISARKILARIM</div>
      </div>

      {/* MISYON BASARILI */}
      {bannerA > 0 ? <AbsoluteFill style={{ background: `rgba(2,4,12,${0.62 * bannerA})` }} /> : null}
      {arrived && da < 2.1 ? (
        <div style={{ position: "absolute", left: 0, top: 520, width: 1080, textAlign: "center", opacity: clamp(da / 0.15) * (1 - clamp((da - 1.5) / 0.5)), scale: 0.8 + 0.2 * easeOutBack(da / 0.4) }}>
          <svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="#7dffb0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M7 12.5 L10.5 16 L17 8.5" />
          </svg>
          <div style={{ fontWeight: 700, fontSize: 150, lineHeight: 1, color: WHITE, letterSpacing: 4, textShadow: `0 0 50px ${CYAN}` }}>MİSYON</div>
          <div style={{ fontWeight: 700, fontSize: 150, lineHeight: 1, color: "#7dffb0", letterSpacing: 4 }}>BAŞARILI</div>
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 52, letterSpacing: 6, color: ORANGE, marginTop: 18 }}>+{CHANGE} SIRA</div>
        </div>
      ) : null}

      {/* yuk karti */}
      {cardP > 0 ? (
        <div style={{ position: "absolute", left: 60, top: 1120 + (1 - cardP) * 700, width: 960, opacity: 1 - outroT }}>
          <div style={{ display: "flex", gap: 30, border: `2px solid ${CYAN}`, background: "rgba(6,16,36,0.78)", padding: 28 }}>
            <div style={{ position: "relative", width: 330, height: 330, flexShrink: 0 }}>
              <Img src={staticFile("risev-cover.jpg")} style={{ width: 330, height: 330, objectFit: "cover" }} />
              {[0, 1, 2, 3].map((c) => (
                <div key={c} style={{ position: "absolute", [c < 2 ? "top" : "bottom"]: -6, [c % 2 === 0 ? "left" : "right"]: -6, width: 44, height: 44, [c < 2 ? "borderTop" : "borderBottom"]: `6px solid ${ORANGE}`, [c % 2 === 0 ? "borderLeft" : "borderRight"]: `6px solid ${ORANGE}` } as React.CSSProperties} />
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 6, color: "#7dffb0" }}>YÜK TESLİM EDİLDİ</div>
                <div style={{ fontWeight: 700, fontSize: fit(TITLE, 70, 540, 0.5), lineHeight: 1.05, color: WHITE, marginTop: 8, whiteSpace: "nowrap" }}>{TITLE}</div>
                <div style={{ fontWeight: 500, fontSize: fit(ARTIST, 46, 540, 0.5), color: "rgba(244,247,255,0.72)", whiteSpace: "nowrap" }}>{ARTIST}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { k: "GÜNLÜK", v: fmt(data.daily * easeOutCubic((da - 1.2) / 1.2)) },
                  { k: "TOPLAM", v: fmt(data.total * easeOutCubic((da - 1.4) / 1.2)) },
                ].map((s) => (
                  <div key={s.k} style={{ border: "1px solid rgba(94,231,255,0.5)", padding: "6px 14px" }}>
                    <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 20, letterSpacing: 5, color: CYAN }}>{s.k}</div>
                    <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 46, color: WHITE }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontFamily: mono, fontWeight: 700, fontSize: 30, letterSpacing: 5 }}>
            <span style={{ color: ORANGE }}>#{FROM} → #{TO}</span>
            <span style={{ color: CYAN }}>{toTop > 0 ? `YÖRÜNGEYE ${toTop} SIRA` : "YÖRÜNGEDE"}</span>
          </div>
        </div>
      ) : null}

      {/* kapanis */}
      {outroT > 0 ? (
        <>
          <AbsoluteFill style={{ background: `rgba(2,4,12,${0.92 * outroT})` }} />
          <div style={{ position: "absolute", left: 0, top: 640, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 36, letterSpacing: 8, color: CYAN }}>{toTop > 0 ? `YÖRÜNGEYE ${toTop} SIRA KALDI` : "YÖRÜNGEDE"}</div>
            <div style={{ fontWeight: 700, fontSize: 140, lineHeight: 1.0, color: WHITE, marginTop: 40 }}>SENCE</div>
            <div style={{ fontWeight: 700, fontSize: 140, lineHeight: 1.0, color: ORANGE }}>ULAŞIR MI?</div>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 40, letterSpacing: 7, color: CYAN, marginTop: 50 }}>@YENISARKILARIM</div>
          </div>
        </>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: t >= START && t < START + 0.5 ? 0.35 * (1 - (t - START) / 0.5) : arrived ? 0.28 * Math.exp(-10 * da) : 0, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
