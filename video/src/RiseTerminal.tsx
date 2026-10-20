import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-risev.json";

// "Yukselen sarki" sablonu: PIYASA RAPORU. Finans terminali dili: ticker, sira grafigi (dun -> bugun), istatistik paneli, kayan komsu listesi.
// Tum rakamlar gercek: dun/bugun sirasi, gunluk + toplam stream, listedeki komsular. Iki gozlem arasi egri yalnizca gorsel gecistir.
const { fontFamily } = loadInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

type Neighbor = { rank: number; title: string; artist: string; change: number | string | null; featured: boolean };
const NEIGHBORS = data.neighbors as unknown as Neighbor[];
const BANDS = data.bands as number[][];
const ARTIST = data.artist;
const TITLE = data.title;
const FROM = data.from;
const TO = data.to;
const CHANGE = data.change;
const START = data.start;
const ARRIVAL = data.arrival;
const OUTRO = data.outro;
const DUR = data.durationSeconds;

const BG = "#070b11";
const PANEL = "#0d1420";
const LINE = "#1b2736";
const AMBER = "#ffb020";
const GREEN = "#19d39a";
const RED = "#ff5c5c";
const TXT = "#e6edf5";
const MUTED = "#7d8b9a";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (u: number) => clamp(u) * clamp(u) * (3 - 2 * clamp(u));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (text: string, max: number, width: number, k = 0.56) => Math.min(max, width / (Math.max(text.length, 3) * k));
const fmt = (n: number) => (n >= 1e7 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`);

// ---- grafik geometrisi
const PX0 = 200;
const PX1 = 980;
const PY0 = 640;
const PY1 = 1090;
const step = FROM <= 25 ? 5 : FROM <= 60 ? 10 : 20;
const MAXR = Math.ceil((FROM + 3) / step) * step;
const yOf = (r: number) => PY0 + ((r - 1) / (MAXR - 1)) * (PY1 - PY0);
const X0 = PX0 + 80;
const X1 = PX1 - 80;
const CX = (X0 + X1) / 2;
const Y0 = yOf(FROM);
const Y1 = yOf(TO);
const bx = (u: number) => X0 * (1 - u) ** 3 + 3 * CX * (1 - u) ** 2 * u + 3 * CX * (1 - u) * u ** 2 + X1 * u ** 3;
const by = (u: number) => Y0 + (Y1 - Y0) * smooth(u);
const CURVE = `M ${X0} ${Y0} C ${CX} ${Y0}, ${CX} ${Y1}, ${X1} ${Y1}`;
const GRID = [1, ...Array.from({ length: Math.floor(MAXR / step) }, (_, i) => (i + 1) * step)].filter((r, i, a) => r <= MAXR && a.indexOf(r) === i);

const firstWord = ARTIST.toLocaleUpperCase("tr").split(/\s+/)[0].replace(/[^A-Z0-9ÇĞİÖŞÜ]/g, "");
const CODE = (firstWord.length <= 8 ? firstWord : firstWord.slice(0, 5)) || "SPTF";
const CODE_SIZE = Math.min(118, 440 / (Math.max(CODE.length, 3) * 0.62 + 0.55));

const Triangle: React.FC<{ size: number; color: string; down?: boolean }> = ({ size, color, down }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{ rotate: down ? "180deg" : "0deg" }}>
    <path d="M10 3 L18 16 H2 Z" fill={color} />
  </svg>
);

export const RiseTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];

  const fadeIn = clamp(t / 0.5);
  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const outroT = clamp((t - OUTRO) / 0.6);
  const arrived = t >= ARRIVAL;
  const da = t - ARRIVAL;

  const u = clamp((t - START) / (ARRIVAL - START));
  const rankNow = FROM - CHANGE * smooth(u);
  const rankShown = Math.round(rankNow);
  const gained = Math.round(FROM - rankNow);
  const mx = bx(u);
  const my = by(u);
  const blink = Math.floor(t * 1.6) % 2 === 0;

  // sembol: harf harf yazilir
  const codeShown = CODE.slice(0, Math.floor(clamp((t - 0.5) / 0.6) * CODE.length + 0.001));
  const titleLine = `${TITLE.toLocaleUpperCase("tr")}  —  ${ARTIST.toLocaleUpperCase("tr")}`;
  const titleSize = fit(titleLine, 46, 960, 0.6);

  // istatistikler: varistan sonra sayar
  const statP = (i: number) => easeOutCubic((t - ARRIVAL - 0.25 - i * 0.18) / 1.3);
  const toTop = TO - 1;
  const stats = [
    { label: "GÜNLÜK DİNLENME", value: statP(0) <= 0 ? "—" : fmt(data.daily * statP(0)), color: TXT, bar: AMBER },
    { label: "TOPLAM DİNLENME", value: statP(1) <= 0 ? "—" : fmt(data.total * statP(1)), color: TXT, bar: "#5aa9ff" },
    { label: "SIRA DEĞİŞİMİ", value: statP(2) <= 0 ? "—" : `+${Math.round(CHANGE * statP(2))}`, color: GREEN, bar: GREEN },
    { label: "ZİRVEYE KALAN", value: statP(3) <= 0 ? "—" : toTop > 0 ? `${Math.round(toTop * statP(3))} SIRA` : "ZİRVEDE", color: AMBER, bar: AMBER },
  ];

  // kayan bant (RobotoMono sabit genislik: 0.6em)
  const TS = 34;
  const items = NEIGHBORS.map((n) => {
    const chg = typeof n.change === "number" ? (n.change > 0 ? `+${n.change}` : n.change < 0 ? `${n.change}` : "=") : n.change === "NEW" ? "YENİ" : "";
    const text = `${n.rank}  ${n.title.toLocaleUpperCase("tr")}  ${chg}`;
    return { n, chg, text, w: text.length * 0.6 * TS + 64 };
  });
  const loopW = items.reduce((a, i) => a + i.w + 40, 0) || 1;
  const tickerX = -((t * 210) % loopW);

  return (
    <AbsoluteFill style={{ background: BG, fontFamily }}>
      <Audio src={staticFile("risev-soundtrack.wav")} />

      {/* ince izgara dokusu */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          opacity: 0.35 * fadeIn,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 60% at 50% 30%, rgba(25,211,154,0.07) 0%, rgba(7,11,17,0) 70%)" }} />

      {/* ust cubuk */}
      <div style={{ position: "absolute", left: 0, top: 58, width: 1080, height: 84, background: "#0f1722", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", opacity: fadeIn }}>
        <div style={{ background: AMBER, color: "#0a0e14", fontWeight: 800, fontSize: 36, letterSpacing: 4, padding: "0 30px", height: "100%", display: "flex", alignItems: "center" }}>SPOTIFY TR</div>
        <div style={{ color: TXT, fontWeight: 600, fontSize: 30, letterSpacing: 5, padding: "0 28px" }}>GÜNLÜK LİSTE</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16, paddingRight: 34 }}>
          <span style={{ fontFamily: mono, fontWeight: 500, fontSize: 28, color: MUTED }}>{data.date}</span>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: blink ? GREEN : "#0e5f49", boxShadow: blink ? `0 0 14px ${GREEN}` : "none" }} />
          <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 26, color: GREEN, letterSpacing: 3 }}>CANLI</span>
        </div>
      </div>

      {/* sembol bolumu */}
      <div style={{ position: "absolute", left: 60, top: 190, width: 220, height: 220, borderRadius: 18, overflow: "hidden", border: `2px solid ${LINE}`, opacity: fadeIn, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
        <Img src={staticFile("risev-cover.jpg")} style={{ width: 220, height: 220, objectFit: "cover" }} />
      </div>
      <div style={{ position: "absolute", left: 310, top: 190, width: 440, opacity: fadeIn }}>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 24, letterSpacing: 5, color: MUTED }}>SEMBOL</div>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: CODE_SIZE, lineHeight: 1.05, color: AMBER, letterSpacing: 2, minHeight: 124, whiteSpace: "nowrap" }}>
          {codeShown}
          {codeShown.length < CODE.length || blink ? <span style={{ display: "inline-block", width: 14, height: CODE_SIZE * 0.76, background: AMBER, marginLeft: 8, verticalAlign: "-4px" }} /> : null}
        </div>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 26, letterSpacing: 3, color: MUTED, marginTop: 6 }}>TÜRKİYE · SPOTIFY</div>
      </div>
      <div style={{ position: "absolute", left: 700, top: 176, width: 320, textAlign: "right", opacity: fadeIn }}>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 24, letterSpacing: 5, color: MUTED }}>SIRA</div>
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 150, lineHeight: 1.0, color: arrived ? GREEN : TXT, textShadow: arrived ? `0 0 ${34 * Math.exp(-3 * da)}px ${GREEN}` : "none" }}>
          {rankShown}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "rgba(25,211,154,0.14)", border: `1px solid ${GREEN}`, borderRadius: 10, padding: "6px 18px", marginTop: 6, scale: arrived ? 1 + 0.12 * Math.exp(-8 * da) : 1, opacity: clamp((t - START) / 0.3) }}>
          <Triangle size={30} color={GREEN} />
          <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 36, color: GREEN }}>+{gained}</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 60, top: 440, width: 960, height: 70, display: "flex", alignItems: "center", opacity: fadeIn, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div style={{ fontWeight: 700, fontSize: titleSize, color: TXT, whiteSpace: "nowrap", letterSpacing: 0.5 }}>{titleLine}</div>
      </div>

      {/* grafik paneli */}
      <div style={{ position: "absolute", left: 40, top: 535, width: 1000, height: 640, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 16, opacity: fadeIn }} />
      <div style={{ position: "absolute", left: 72, top: 556, fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 4, color: MUTED, opacity: fadeIn }}>SIRALAMA · DÜN → BUGÜN</div>
      <div style={{ position: "absolute", right: 72, top: 556, fontFamily: mono, fontWeight: 700, fontSize: 24, letterSpacing: 4, color: GREEN, opacity: fadeIn * clamp((t - START) / 0.4) }}>
        +{CHANGE} SIRA
      </div>
      <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: "absolute", left: 0, top: 0, opacity: fadeIn }}>
        <defs>
          <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={GREEN} stopOpacity="0.38" />
            <stop offset="1" stopColor={GREEN} stopOpacity="0" />
          </linearGradient>
          <clipPath id="reveal">
            <rect x={X0 - 30} y={PY0 - 60} width={Math.max(0, mx - X0 + 30)} height={PY1 - PY0 + 120} />
          </clipPath>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        {/* izgara + sira etiketleri */}
        {GRID.map((r) => (
          <g key={r}>
            <line x1={PX0 - 20} x2={PX1 + 10} y1={yOf(r)} y2={yOf(r)} stroke={LINE} strokeWidth="2" />
            <text x={PX0 - 36} y={yOf(r) + 9} textAnchor="end" fontFamily={mono} fontWeight={500} fontSize="26" fill={MUTED}>
              #{r}
            </text>
          </g>
        ))}
        {/* Top 10 bolgesi */}
        {MAXR > 12 ? (
          <g opacity={0.9}>
            <line x1={PX0 - 20} x2={PX1 + 10} y1={yOf(10)} y2={yOf(10)} stroke={AMBER} strokeWidth="2.5" strokeDasharray="12 10" />
            <text x={PX1 + 8} y={yOf(10) - 12} textAnchor="end" fontFamily={mono} fontWeight={700} fontSize="24" fill={AMBER} letterSpacing="3">
              TOP 10
            </text>
          </g>
        ) : null}
        {/* alan + cizgi (soldan saga acilir) */}
        <g clipPath="url(#reveal)">
          <path d={`${CURVE} L ${X1} ${PY1} L ${X0} ${PY1} Z`} fill="url(#areaG)" />
          <path d={CURVE} fill="none" stroke={GREEN} strokeWidth="14" strokeLinecap="round" opacity="0.55" filter="url(#glow)" />
          <path d={CURVE} fill="none" stroke={GREEN} strokeWidth="6" strokeLinecap="round" />
        </g>
        {/* baslangic noktasi (dun) */}
        <g opacity={clamp((t - 1.2) / 0.5)}>
          <circle cx={X0} cy={Y0} r="14" fill={PANEL} stroke={MUTED} strokeWidth="5" />
          <text x={X0} y={Y0 - 30} textAnchor="middle" fontFamily={mono} fontWeight={700} fontSize="34" fill={MUTED}>
            #{FROM}
          </text>
          <text x={X0} y={PY1 + 52} textAnchor="middle" fontFamily={mono} fontWeight={700} fontSize="26" fill={MUTED} letterSpacing="4">
            DÜN
          </text>
        </g>
        {/* bugun */}
        <text x={X1} y={PY1 + 52} textAnchor="middle" fontFamily={mono} fontWeight={700} fontSize="26" fill={arrived ? GREEN : MUTED} letterSpacing="4" opacity={clamp((t - 1.2) / 0.5)}>
          BUGÜN
        </text>
        {/* hareketli isaretci */}
        {t >= START ? (
          <g>
            {arrived ? <circle cx={X1} cy={Y1} r={20 + 80 * clamp(da / 0.9)} fill="none" stroke={GREEN} strokeWidth="4" opacity={0.7 * (1 - clamp(da / 0.9))} /> : null}
            <circle cx={mx} cy={my} r="19" fill={GREEN} stroke="#05110d" strokeWidth="5" />
            <g transform={`translate(${Math.min(mx, PX1 - 30)}, ${my - 62})`}>
              <rect x="-62" y="-30" width="124" height="52" rx="10" fill={GREEN} />
              <text x="0" y="8" textAnchor="middle" fontFamily={mono} fontWeight={700} fontSize="34" fill="#04130d">
                #{rankShown}
              </text>
            </g>
          </g>
        ) : null}
      </svg>

      {/* istatistik kartlari */}
      {stats.map((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const p = clamp((t - ARRIVAL + 0.1 - i * 0.12) / 0.45);
        return (
          <div
            key={s.label}
            style={{
              position: "absolute",
              left: 40 + col * 510,
              top: 1205 + row * 172,
              width: 490,
              height: 152,
              background: PANEL,
              border: `1px solid ${LINE}`,
              borderRadius: 14,
              overflow: "hidden",
              opacity: arrived ? p : 0.22 * fadeIn,
              translate: `0px ${arrived ? (1 - easeOutBack(p)) * 36 : 0}px`,
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 0, width: 8, height: 152, background: s.bar }} />
            <div style={{ position: "absolute", left: 36, top: 22, fontFamily: mono, fontWeight: 700, fontSize: 23, letterSpacing: 4, color: MUTED }}>{s.label}</div>
            <div style={{ position: "absolute", left: 36, top: 62, fontWeight: 800, fontSize: 70, color: s.color, letterSpacing: -1 }}>{s.value}</div>
          </div>
        );
      })}

      {/* kayan bant */}
      <div style={{ position: "absolute", left: 0, top: 1576, width: 1080, height: 78, background: "#0f1722", borderTop: `3px solid ${AMBER}`, borderBottom: `1px solid ${LINE}`, overflow: "hidden", opacity: fadeIn }}>
        <div style={{ position: "absolute", top: 0, left: 0, display: "flex", translate: `${tickerX}px 0px`, height: 78, alignItems: "center", whiteSpace: "nowrap" }}>
          {[0, 1].map((rep) =>
            items.map(({ n, chg, text, w }, i) => (
              <div
                key={`${rep}-${i}`}
                style={{
                  width: w,
                  marginRight: 40,
                  height: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: mono,
                  fontWeight: 700,
                  fontSize: TS,
                  borderRadius: 8,
                  background: n.featured ? AMBER : "transparent",
                  color: n.featured ? "#0a0e14" : TXT,
                }}
              >
                <span>{text.slice(0, text.length - chg.length)}</span>
                <span style={{ color: n.featured ? "#0a0e14" : typeof n.change === "number" ? (n.change > 0 ? GREEN : n.change < 0 ? RED : MUTED) : AMBER }}>{chg}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* alt bilgi + spektrum */}
      <div style={{ position: "absolute", left: 60, top: 1700, width: 960, display: "flex", alignItems: "flex-end", justifyContent: "space-between", opacity: fadeIn }}>
        <div>
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 40, letterSpacing: 6, color: TXT }}>@YENISARKILARIM</div>
          <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 22, letterSpacing: 3, color: MUTED, marginTop: 8 }}>KAYNAK · SPOTIFY TÜRKİYE GÜNLÜK LİSTE</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{ width: 12, height: 8 + (bands[i + 1] ?? 0) * 70, background: AMBER, opacity: 0.4 + 0.6 * (bands[i + 1] ?? 0), borderRadius: 2 }} />
          ))}
        </div>
      </div>

      {/* kapanis */}
      {outroT > 0 ? (
        <>
          <AbsoluteFill style={{ background: `rgba(7,11,17,${0.95 * outroT})` }} />
          <div style={{ position: "absolute", left: 0, top: 700, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 34, letterSpacing: 8, color: MUTED }}>{toTop > 0 ? `ZİRVEYE ${toTop} SIRA KALDI` : "ZİRVEDE"}</div>
            <div style={{ fontWeight: 800, fontSize: 112, lineHeight: 1.05, color: TXT, marginTop: 34, padding: "0 60px" }}>SENCE ZİRVEYE</div>
            <div style={{ fontWeight: 800, fontSize: 112, lineHeight: 1.05, color: GREEN }}>ÇIKAR MI?</div>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 40, letterSpacing: 7, color: AMBER, marginTop: 50 }}>@YENISARKILARIM</div>
          </div>
        </>
      ) : null}

      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
