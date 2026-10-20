import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-risev.json";

// "Yukselen sarki" sablonu: HIZ RADARI. Gece yolu, hiz siniri 10 sira/gun; sarki kapagi yaklasir, radar okumasi +N'e tirmanir, flas, ceza makbuzu yazdirilir.
// Rakamlar gercek: sinir = botun yukselis esigi (10 sira), olculen = gunluk sira kazanci, asim = olculen/sinir.
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
const MARKS = data.marks as { print?: number; step?: number; stamp?: number };
const PRINT = MARKS.print ?? 6.8;
const STEP = MARKS.step ?? 0.36;
const STAMP = MARKS.stamp ?? 11.5;

const LIMIT = 10;
const OVER = Math.round((CHANGE / LIMIT - 1) * 100);
const RED = "#ff2d2d";
const AMBER = "#ffb020";
const CYAN = "#5ee7ff";
const PAPER = "#f6f3ea";
const INK = "#1b1d24";
const ACCENT = `hsl(${HUE}, 90%, 58%)`;

const HY = 700; // ufuk cizgisi

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
const fmt = (n: number) => (n >= 1e7 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`);
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ufuktan alta dogru perspektif: k = 0 (ufuk) .. 1 (alt)
const yAt = (z: number) => HY + 1500 / z;
const kAt = (y: number) => (y - HY) / (1920 - HY);
const hw = (y: number) => 40 + 960 * kAt(y); // yol yarim genisligi

const Road: React.FC<{ t: number }> = ({ t }) => {
  const dashes: React.ReactNode[] = [];
  for (let i = 0; i < 30; i++) {
    const z0 = 1.15 + i * 1.3;
    const y1 = yAt(z0);
    const y2 = yAt(z0 + 0.55);
    if (y1 > 2000) continue;
    const w1 = 12 * kAt(y1) + 1;
    const w2 = 12 * kAt(y2) + 1;
    dashes.push(<polygon key={i} points={`${540 - w1},${y1} ${540 + w1},${y1} ${540 + w2},${y2} ${540 - w2},${y2}`} fill="rgba(255,236,190,0.85)" />);
  }
  const lamps: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const z = 1.6 + i * 3.1;
    const y = yAt(z);
    const k = kAt(y);
    for (const side of [-1, 1]) {
      const x = 540 + side * (hw(y) + 150 * k + 30);
      const r = 6 + 44 * k;
      lamps.push(<circle key={`${i}${side}`} cx={x} cy={y - 260 * k} r={r} fill="url(#lamp)" opacity={0.75 + 0.25 * Math.sin(t * 5 + i)} />);
      lamps.push(<rect key={`p${i}${side}`} x={x - 2 - 4 * k} y={y - 260 * k} width={4 + 8 * k} height={260 * k} fill="rgba(20,24,34,0.9)" />);
    }
  }
  return (
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#03050d" />
          <stop offset="1" stopColor="#1a2146" />
        </linearGradient>
        <linearGradient id="asph" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12141b" />
          <stop offset="1" stopColor="#2a2d38" />
        </linearGradient>
        <radialGradient id="glowH" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(255,176,90,0.7)" />
          <stop offset="1" stopColor="rgba(255,176,90,0)" />
        </radialGradient>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff4d6" />
          <stop offset="0.4" stopColor="rgba(255,200,110,0.7)" />
          <stop offset="1" stopColor="rgba(255,200,110,0)" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="1080" height={HY} fill="url(#sky)" />
      <rect x="0" y={HY} width="1080" height={1920 - HY} fill="#07080d" />
      <ellipse cx="540" cy={HY} rx="620" ry="150" fill="url(#glowH)" />
      {/* sehir siluetleri */}
      {Array.from({ length: 22 }).map((_, i) => (
        <rect key={i} x={i * 52 - 10} y={HY - 30 - rnd(i, 5) * 90} width={34 + rnd(i, 6) * 26} height={30 + rnd(i, 5) * 90} fill="#0a0c18" />
      ))}
      <polygon points={`${540 - 40},${HY} ${540 + 40},${HY} ${540 + 1000},1920 ${540 - 1000},1920`} fill="url(#asph)" />
      {/* kenar cizgileri */}
      <polygon points={`${540 - 40},${HY} ${540 - 34},${HY} ${540 - 940},1920 ${540 - 1000},1920`} fill="rgba(255,255,255,0.8)" />
      <polygon points={`${540 + 40},${HY} ${540 + 34},${HY} ${540 + 940},1920 ${540 + 1000},1920`} fill="rgba(255,255,255,0.8)" />
      {dashes}
      {lamps}
    </svg>
  );
};

const Sign: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: "#fff", border: `${size * 0.11}px solid #e11d2e`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontFamily, fontWeight: 700, fontSize: size * 0.5, color: "#111", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>{LIMIT}</div>
);

export const RiseRadar: React.FC = () => {
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
  const toTop = TO - 1;

  // arac: ufuktan yaklasir
  const s = smooth(clamp((t - 1.1) / (ARRIVAL - 1.1)));
  const k = 0.07 + 0.93 * s ** 1.6;
  const S = 620 * k;
  const cx = 540;
  const cy = HY + (1130 - HY) * s ** 1.5;

  // radar okumasi
  const u = clamp((t - START) / (ARRIVAL - START));
  const reading = Math.round(CHANGE * smooth(u));
  const rankNow = Math.round(FROM - CHANGE * smooth(u));
  const blink = arrived && da < 1.6 && Math.floor(t * 7) % 2 === 0;
  const measuring = t >= START && !arrived;

  // sahne evreleri
  const photo = arrived;
  const printK = easeOutCubic((t - (PRINT - 0.5)) / 0.7);
  const sceneDim = 1 - 0.65 * printK;

  // makbuz
  const rows: { k: string; v: string; bold?: boolean }[] = [
    { k: "İHLAL", v: "HIZ SINIRI AŞIMI", bold: true },
    { k: "ARAÇ", v: trunc(TITLE, 16) },
    { k: "SÜRÜCÜ", v: trunc(ARTIST, 16) },
    { k: "SINIR", v: `${LIMIT} SIRA/GÜN` },
    { k: "ÖLÇÜLEN", v: `+${CHANGE} SIRA/GÜN`, bold: true },
    { k: "AŞIM", v: OVER > 0 ? `%${OVER}` : "SINIRDA", bold: true },
    { k: "KALKIŞ", v: `#${FROM}` },
    { k: "VARIŞ", v: `#${TO}`, bold: true },
    { k: "GÜNLÜK", v: `${fmt(data.daily)} DİNLENME` },
    { k: "TOPLAM", v: `${fmt(data.total)} DİNLENME` },
    { k: "CEZA", v: toTop > 0 ? `ZİRVEYE ${toTop} SIRA` : "ZİRVEDE", bold: true },
  ];
  const stampP = clamp((t - STAMP) / 0.15);
  const stampScale = t >= STAMP ? 1 + 1.2 * (1 - easeOutCubic((t - STAMP) / 0.2)) : 2.4;
  const stampShake = t >= STAMP ? Math.max(0, 1 - (t - STAMP) / 0.5) * Math.sin((t - STAMP) * 120) * 12 : 0;

  // zigzag kenar
  const zig = (n: number, w: number, h: number) => Array.from({ length: n * 2 + 1 }, (_, i) => `${(i * w) / (n * 2)}px ${i % 2 === 0 ? 0 : h}px`);
  const zigBottom = zig(22, 640, 22).map((p, i) => (i % 2 === 0 ? p.replace(/ \d+px$/, " calc(100% - 22px)") : p.replace(/ \d+px$/, " 100%"))).join(",");

  return (
    <AbsoluteFill style={{ background: "#03050d", fontFamily }}>
      <Audio src={staticFile("risev-soundtrack.wav")} />

      {/* ---- yol sahnesi ---- */}
      <AbsoluteFill style={{ opacity: fadeIn * sceneDim, filter: photo ? "grayscale(0.88) contrast(1.18) brightness(1.05)" : "none" }}>
        <Road t={t} />
        {/* ufuktan acilan hiz cizgileri */}
        {s > 0.08 && !arrived
          ? Array.from({ length: 26 }).map((_, i) => {
              const ang = rnd(i, 1) * Math.PI * 2;
              const r0 = 90 + ((t * 700 * (0.4 + s) + rnd(i, 2) * 900) % 900);
              const r1 = r0 + 60 + 260 * s;
              return <div key={i} style={{ position: "absolute", left: 540, top: HY + 40, width: r1 - r0, height: 3, transformOrigin: "0 50%", rotate: `${ang * (180 / Math.PI)}deg`, translate: `${Math.cos(ang) * r0}px ${Math.sin(ang) * r0 * 0.9}px`, background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55))", opacity: 0.35 * s }} />;
            })
          : null}
        {/* isik izi */}
        <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: "absolute", left: 0, top: 0, opacity: 0.9 * s }}>
          <defs>
            <linearGradient id="trail" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,236,200,0)" />
              <stop offset="1" stopColor="rgba(255,236,200,0.38)" />
            </linearGradient>
            <filter id="tb">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>
          <polygon points={`${cx - S * 0.42},${cy - S * 0.3} ${cx + S * 0.42},${cy - S * 0.3} ${540 + 7},${HY + 4} ${540 - 7},${HY + 4}`} fill="url(#trail)" filter="url(#tb)" />
        </svg>
        {/* alt isik havuzu */}
        <div style={{ position: "absolute", left: cx - S * 0.7, top: cy + S * 0.32, width: S * 1.4, height: S * 0.5, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,214,150,0.55) 0%, rgba(255,214,150,0) 70%)" }} />
        {/* arac = kapak */}
        <div style={{ position: "absolute", left: cx - S / 2, top: cy - S / 2, width: S, height: S, scale: arrived ? 1 : 1 + bass * 0.012 }}>
          <div style={{ width: S, height: S, borderRadius: S * 0.05, overflow: "hidden", boxShadow: `0 ${S * 0.05}px ${S * 0.2}px rgba(0,0,0,0.7)`, border: `${Math.max(1, S * 0.012)}px solid rgba(255,255,255,0.35)` }}>
            <Img src={staticFile("risev-cover.jpg")} style={{ width: S, height: S, objectFit: "cover" }} />
          </div>
          {[0.16, 0.84].map((x) => (
            <div key={x} style={{ position: "absolute", left: S * x - S * 0.16, top: S * 0.9 - S * 0.16, width: S * 0.32, height: S * 0.32, borderRadius: "50%", background: "radial-gradient(circle, #fff 0%, rgba(255,246,214,0.8) 25%, rgba(255,230,160,0) 70%)" }} />
          ))}
          {/* plaka = guncel sira */}
          <div style={{ position: "absolute", left: S * 0.29, top: S * 1.02, width: S * 0.42, height: S * 0.13, background: "#ffd60a", borderRadius: S * 0.02, border: `${Math.max(1, S * 0.008)}px solid #1b1d24`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontWeight: 700, fontSize: S * 0.085, color: "#1b1d24" }}>
            #{rankNow}
          </div>
        </div>
        {/* hedef kutusu */}
        {arrived ? (
          <div style={{ position: "absolute", left: cx - S / 2 - 26, top: cy - S / 2 - 26, width: S + 52, height: S + 52, opacity: clamp(da / 0.1) }}>
            {[0, 1, 2, 3].map((c) => (
              <div key={c} style={{ position: "absolute", [c < 2 ? "top" : "bottom"]: 0, [c % 2 === 0 ? "left" : "right"]: 0, width: 80, height: 80, [c < 2 ? "borderTop" : "borderBottom"]: `10px solid ${RED}`, [c % 2 === 0 ? "borderLeft" : "borderRight"]: `10px solid ${RED}` } as React.CSSProperties} />
            ))}
            <div style={{ position: "absolute", left: 0, top: -64, background: RED, color: "#fff", fontFamily: mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, padding: "4px 16px" }}>HEDEF TESPİT EDİLDİ</div>
          </div>
        ) : null}

        {/* radar dalgalari */}
        {t > START - 0.4 && !arrived
          ? [0, 1, 2].map((i) => {
              const ph = ((t * 1.1 + i / 3) % 1);
              return <div key={i} style={{ position: "absolute", left: 540 - 760 * ph, top: 1730 - 760 * ph, width: 1520 * ph, height: 1520 * ph, borderRadius: "50%", border: `5px solid ${CYAN}`, opacity: 0.45 * (1 - ph), boxSizing: "border-box" }} />;
            })
          : null}
      </AbsoluteFill>

      {/* ---- hiz siniri levhasi + ust bilgi ---- */}
      <div style={{ position: "absolute", left: 60, top: 70, display: "flex", alignItems: "center", gap: 28, opacity: clamp((t - 0.3) / 0.4) * sceneDim, scale: 0.8 + 0.2 * easeOutBack((t - 0.3) / 0.5), transformOrigin: "0 0" }}>
        <Sign size={190} />
        <div>
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 6, color: AMBER }}>HIZ SINIRI</div>
          <div style={{ fontWeight: 700, fontSize: 76, lineHeight: 1.0, color: "#fff" }}>{LIMIT} SIRA/GÜN</div>
          <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 24, letterSpacing: 3, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>SPOTIFY TR · RADAR 01 · {data.date}</div>
        </div>
      </div>

      {/* ---- radar tabancasi ---- */}
      <div style={{ position: "absolute", left: 90, top: 1590, width: 900, height: 280, borderRadius: 40, background: "linear-gradient(180deg, #2c2f3a 0%, #14161d 100%)", boxShadow: "0 -10px 60px rgba(0,0,0,0.7), inset 0 0 0 6px #3b3f4d", opacity: fadeIn * sceneDim, outline: blink ? `6px solid ${RED}` : "none" }}>
        <div style={{ position: "absolute", left: 40, top: 26, fontFamily: mono, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: measuring ? CYAN : arrived ? RED : "rgba(255,255,255,0.45)" }}>{measuring ? "● ÖLÇÜLÜYOR" : arrived ? "● İHLAL" : "● HAZIR"}</div>
        <div style={{ position: "absolute", right: 40, top: 26, fontFamily: mono, fontWeight: 700, fontSize: 26, letterSpacing: 5, color: AMBER }}>LİMİT {LIMIT}</div>
        <div style={{ position: "absolute", left: 40, top: 74, width: 820, height: 170, borderRadius: 20, background: "#0a0305", boxShadow: "inset 0 0 0 4px #000", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 36px" }}>
          <div style={{ position: "relative", fontFamily: mono, fontWeight: 700, fontSize: 168, lineHeight: 1, letterSpacing: 6 }}>
            <span style={{ color: "rgba(255,45,45,0.1)" }}>+888</span>
            <span style={{ position: "absolute", right: 0, top: 0, color: RED, textShadow: `0 0 26px ${RED}, 0 0 60px rgba(255,45,45,0.6)`, opacity: blink ? 0.15 : 1 }}>{t >= START ? `+${reading}` : ""}</span>
          </div>
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 34, letterSpacing: 5, color: RED, textAlign: "right", lineHeight: 1.3, opacity: 0.9 }}>
            SIRA
            <br />
            /GÜN
          </div>
        </div>
      </div>

      {/* ---- flas sonrasi: kamera karesi + ihlal bandi ---- */}
      {arrived && t < PRINT + 0.4 ? (
        <>
          <div style={{ position: "absolute", inset: 0, border: "34px solid #000", opacity: clamp(da / 0.1) * (1 - printK) }} />
          <div style={{ position: "absolute", left: 60, top: 60, fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: "rgba(255,255,255,0.9)", opacity: (1 - printK) * 0.0 }}>KAMERA 01</div>
          <div style={{ position: "absolute", left: 0, top: 330, width: 1080, opacity: clamp(da / 0.15) * (1 - printK), translate: `0px ${(1 - easeOutCubic(da / 0.3)) * -200}px` }}>
            <div style={{ background: "repeating-linear-gradient(135deg, #ffd60a 0px, #ffd60a 34px, #111 34px, #111 68px)", height: 30 }} />
            <div style={{ background: RED, textAlign: "center", padding: "10px 0 6px" }}>
              <div style={{ fontWeight: 700, fontSize: 112, letterSpacing: 4, color: "#fff", lineHeight: 1.05 }}>{OVER > 0 ? "HIZ SINIRI AŞILDI!" : "SINIRDA YAKALANDI!"}</div>
              <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 40, letterSpacing: 6, color: "#ffe8a8", marginTop: 4 }}>
                {OVER > 0 ? `SINIR ${LIMIT} · ÖLÇÜLEN +${CHANGE} · AŞIM %${OVER}` : `SINIR ${LIMIT} · ÖLÇÜLEN +${CHANGE}`}
              </div>
            </div>
            <div style={{ background: "repeating-linear-gradient(135deg, #ffd60a 0px, #ffd60a 34px, #111 34px, #111 68px)", height: 30 }} />
          </div>
        </>
      ) : null}

      {/* ---- makbuz ---- */}
      {printK > 0 ? (
        <div style={{ position: "absolute", left: 220, top: 200 + (1 - printK) * 1800, width: 640, height: 1240, opacity: 1 - outroT, filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.6))" }}>
          <div style={{ position: "absolute", inset: 0, background: PAPER, clipPath: `polygon(0 0, 100% 0, ${zigBottom.split(",").reverse().join(",")})` }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,0.025) 0px, rgba(0,0,0,0.025) 2px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 6px)" }} />
            <div style={{ padding: "40px 44px", fontFamily: mono, color: INK }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: 4 }}>SPOTIFY TR</div>
                  <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: 2, lineHeight: 1.1 }}>TRAFİK KONTROL</div>
                  <div style={{ fontWeight: 500, fontSize: 24, color: "rgba(27,29,36,0.6)", marginTop: 6 }}>RADAR 01 · {data.date}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 150, height: 150, overflow: "hidden", border: `4px solid ${INK}`, filter: "grayscale(1) contrast(1.2)" }}>
                    <Img src={staticFile("risev-cover.jpg")} style={{ width: 150, height: 150, objectFit: "cover" }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 2, marginTop: 4 }}>FOTOĞRAF EKİ</div>
                </div>
              </div>
              <div style={{ borderTop: `4px dashed ${INK}`, margin: "20px 0 22px" }} />
              {rows.map((r, i) => {
                const txt = `${r.k.padEnd(8, " ")}: ${r.v}`;
                const vis = txt.slice(0, Math.floor(clamp((t - (PRINT + i * STEP)) / 0.28) * txt.length));
                return (
                  <div key={r.k} style={{ fontWeight: r.bold ? 700 : 500, fontSize: 34, lineHeight: "62px", whiteSpace: "pre", height: 62, color: r.k === "AŞIM" || r.k === "ÖLÇÜLEN" ? "#b3121c" : INK }}>
                    {vis}
                  </div>
                );
              })}
              <div style={{ borderTop: `4px dashed ${INK}`, margin: "16px 0 18px" }} />
              {/* barkod */}
              <div style={{ display: "flex", alignItems: "flex-end", height: 120, gap: 3, opacity: clamp((t - (PRINT + rows.length * STEP)) / 0.3) }}>
                {Array.from({ length: 58 }).map((_, i) => (
                  <div key={i} style={{ width: 3 + Math.floor(rnd(i, 9) * 7), height: 120, background: INK, marginRight: 3 + Math.floor(rnd(i, 10) * 4) }} />
                ))}
              </div>
              <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: 4, marginTop: 8, textAlign: "center", opacity: clamp((t - (PRINT + rows.length * STEP)) / 0.3) }}>@YENISARKILARIM</div>
            </div>
            {/* damga */}
            {t >= STAMP ? (
              <div style={{ position: "absolute", left: 40, top: 985, width: 560, textAlign: "center", opacity: stampP, rotate: "-11deg", scale: stampScale, translate: `${stampShake}px 0px` }}>
                <div style={{ display: "inline-block", border: `12px solid ${RED}`, borderRadius: 20, padding: "6px 26px", boxShadow: `inset 0 0 0 4px ${RED}`, color: RED, fontFamily, fontWeight: 700, fontSize: 92, lineHeight: 1.05, letterSpacing: 3, mixBlendMode: "multiply", background: "rgba(246,243,234,0.4)" }}>
                  İHLAL
                  <br />
                  KAYDEDİLDİ
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* alt marka */}
      <div style={{ position: "absolute", left: 0, bottom: 0, width: 1080, height: 46, background: "#0a0c12", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontWeight: 700, fontSize: 22, letterSpacing: 6, color: "rgba(255,255,255,0.55)", opacity: fadeIn * (printK > 0 ? 1 : 0) }}>
        KAYNAK · SPOTIFY TÜRKİYE GÜNLÜK LİSTE
      </div>

      {/* kapanis */}
      {outroT > 0 ? (
        <>
          <AbsoluteFill style={{ background: `rgba(3,5,13,${0.94 * outroT})` }} />
          <div style={{ position: "absolute", left: 0, top: 640, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
            <div style={{ display: "inline-block", background: RED, color: "#fff", fontWeight: 700, fontSize: 52, letterSpacing: 8, padding: "6px 34px" }}>+{CHANGE} SIRA/GÜN</div>
            <div style={{ fontWeight: 700, fontSize: 130, lineHeight: 1.0, color: "#fff", marginTop: 50 }}>SENCE YARIN DA</div>
            <div style={{ fontWeight: 700, fontSize: 130, lineHeight: 1.0, color: ACCENT }}>HIZLANIR MI?</div>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 40, letterSpacing: 7, color: AMBER, marginTop: 50 }}>@YENISARKILARIM</div>
          </div>
        </>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: arrived ? 0.97 * Math.exp(-9 * da) : 0, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
