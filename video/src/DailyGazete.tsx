import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadAbril } from "@remotion/google-fonts/AbrilFatface";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadOldStd } from "@remotion/google-fonts/OldStandardTT";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-dy.json";

// Gunluk Top 5 sablonu: GAZETE. Gunun ilk sayfasi donerek gelir; #1 manset, 2-5 sutun haberleri. Basliklar gercek gunluk veriden turetilir.
const { fontFamily: abril } = loadAbril("normal", { subsets: ["latin", "latin-ext"] });
const { fontFamily: playfair } = loadPlayfair("normal", { weights: ["700", "900"], subsets: ["latin", "latin-ext"] });
const { fontFamily: playfairIt } = loadPlayfair("italic", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: oldstd } = loadOldStd("normal", { weights: ["400", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

type Item = { rank: number; title: string; artist: string; streams: string; total: string; weekStreams: string; change: number | string | null; days: number | null; peak: number | null; peakTimes: number; moveText: string; daysText: string; peakText: string; deltaText: string; cover: string; hue: number; at: number; len: number };
const ITEMS = data.items as unknown as Item[]; // 1, 2, 3, 4, 5 sirasiyla
const BANDS = data.bands as number[][];
const OUTRO = data.outro;
const DUR = data.durationSeconds;

const PAPER = "#eee4cd";
const INK = "#1b1610";
const RED = "#b3202a";
const DESK = "#0d0a07";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));
const lower = (s: string) => s.toLocaleLowerCase("tr");
const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase("tr") + lower(s.slice(1)) : s);

const kickerFor = (it: Item) => (it.rank === 1 ? (it.change === "NEW" ? "ZİRVEYE YENİ GİRİŞ" : it.change === 0 ? "ZİRVEDE DEĞİŞİKLİK YOK" : typeof it.change === "number" && it.change > 0 ? "ZİRVEYE YÜKSELDİ" : "ZİRVEDE") : it.change === "NEW" ? "YENİ GİRİŞ" : it.change === 0 ? "İSTİKRAR" : typeof it.change === "number" && it.change > 0 ? "YÜKSELİŞTE" : "GERİLEME");
const subFor = (it: Item) => [it.moveText ? cap(it.moveText) : "", it.daysText ? `listede ${lower(it.daysText)}` : ""].filter(Boolean).join(" · ");

const Paper: React.FC = () => (
  <>
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 70% at 50% 45%, ${PAPER} 0%, #e0d3b6 70%, #cdbd9c 100%)` }} />
    <svg width="1080" height="1920" style={{ position: "absolute", left: 0, top: 0, mixBlendMode: "multiply", opacity: 0.35 }}>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="1080" height="1920" filter="url(#grain)" />
    </svg>
  </>
);

export const DailyGazete: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];

  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const outroT = clamp((t - OUTRO) / 0.6);

  // donerek gelen sayfa
  const spin = easeOutCubic(t / 1.05);
  const pageScale = 0.04 + 0.96 * spin;
  const pageRot = (1 - spin) * 900;
  const settle = t > 1.05 ? 1 : 1;

  const lead = ITEMS[0];
  const rest = ITEMS.slice(1);
  const leadP = clamp((t - lead.at) / 0.6);
  const typedTitle = lead.title.toLocaleUpperCase("tr").slice(0, Math.floor(clamp((t - lead.at - 0.15) / 0.8) * lead.title.length));

  const cells = [
    { x: 40, y: 1050 },
    { x: 560, y: 1050 },
    { x: 40, y: 1420 },
    { x: 560, y: 1420 },
  ];

  return (
    <AbsoluteFill style={{ background: DESK }}>
      <Audio src={staticFile("dy-soundtrack.wav")} />

      <div style={{ position: "absolute", inset: 0, scale: pageScale * settle, rotate: `${pageRot}deg`, boxShadow: "0 30px 90px rgba(0,0,0,0.7)", opacity: 1 - outroT * 0.9 }}>
        <Paper />

        {/* kunye */}
        <div style={{ position: "absolute", left: 40, top: 54, width: 1000, display: "flex", justifyContent: "space-between", fontFamily: oldstd, fontWeight: 700, fontSize: 28, color: INK, letterSpacing: 2 }}>
          <span>TÜRKİYE EDİSYONU</span>
          <span>{data.date}</span>
          <span>FİYATI: 1 DİNLEME</span>
        </div>
        <div style={{ position: "absolute", left: 40, top: 98, width: 1000, borderTop: `6px solid ${INK}`, borderBottom: `2px solid ${INK}`, height: 10 }} />
        {/* manset adi */}
        <div style={{ position: "absolute", left: 0, top: 150, width: 1080, textAlign: "center", fontFamily: abril, fontSize: 116, lineHeight: 1, color: INK, letterSpacing: 4, whiteSpace: "nowrap" }}>SPOTIFY GÜNLÜK</div>
        <div style={{ position: "absolute", left: 40, top: 300, width: 1000, borderTop: `2px solid ${INK}`, borderBottom: `6px solid ${INK}`, height: 10 }} />
        <div style={{ position: "absolute", left: 40, top: 322, width: 1000, display: "flex", justifyContent: "space-between", fontFamily: oldstd, fontStyle: "normal", fontWeight: 700, fontSize: 26, letterSpacing: 4, color: RED }}>
          <span>GÜNÜN EN ÇOK DİNLENEN 5 ŞARKISI</span>
          <span>EK: {data.date}</span>
        </div>

        {/* ---- manset (#1) ---- */}
        <div style={{ position: "absolute", left: 40, top: 380, width: 1000, height: 640, opacity: leadP, clipPath: `inset(0 ${(1 - leadP) * 100}% 0 0)` }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 560 }}>
            <div style={{ display: "inline-block", background: RED, color: PAPER, fontFamily: oldstd, fontWeight: 700, fontSize: 26, letterSpacing: 3, padding: "4px 16px", whiteSpace: "nowrap" }}>{kickerFor(lead)}</div>
            <div style={{ fontFamily: playfair, fontWeight: 900, fontSize: fit(lead.title, 150, 560, 0.8), lineHeight: 0.98, color: INK, marginTop: 14, minHeight: 160 }}>{typedTitle}</div>
            <div style={{ fontFamily: playfairIt, fontWeight: 700, fontSize: fit(lead.artist, 52, 520, 0.5), color: INK, marginTop: 10 }}>{lead.artist}</div>
            <div style={{ borderTop: `3px solid ${INK}`, margin: "20px 0 14px" }} />
            <div style={{ fontFamily: oldstd, fontWeight: 400, fontSize: 32, lineHeight: 1.3, color: INK }}>
              Günün zirvesindeki şarkı bugün <b>{lead.streams}</b> kez dinlendi.
              {lead.peakText ? ` ${cap(lead.peakText)}.` : ""}
              {lead.deltaText ? ` (${cap(lead.deltaText)}).` : ""}
            </div>
            <div style={{ fontFamily: oldstd, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: RED, marginTop: 14 }}>{lead.daysText ? `LİSTEDE ${lead.daysText}` : ""}</div>
            <div style={{ border: `3px solid ${INK}`, padding: "12px 18px 14px", marginTop: 18 }}>
              <div style={{ fontFamily: oldstd, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: RED }}>RAKAMLARLA ZİRVE</div>
              <div style={{ fontFamily: oldstd, fontWeight: 400, fontSize: 27, lineHeight: 1.3, color: INK, marginTop: 4 }}>
                Günlük <b>{lead.streams}</b> · 7 günlük <b>{lead.weekStreams}</b> · Toplam <b>{lead.total}</b>
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", right: 0, top: 0, width: 400 }}>
            <div style={{ width: 400, height: 400, border: `4px solid ${INK}`, filter: "grayscale(0.15) contrast(1.08)", position: "relative" }}>
              <Img src={staticFile(lead.cover)} style={{ width: 392, height: 392, objectFit: "cover" }} />
              <div style={{ position: "absolute", left: 14, top: 14, width: 78, height: 78, borderRadius: "50%", background: RED, color: PAPER, fontFamily: abril, fontSize: 56, display: "flex", alignItems: "center", justifyContent: "center", border: `4px solid ${PAPER}` }}>1</div>
            </div>
            <div style={{ fontFamily: playfairIt, fontWeight: 500, fontSize: 24, color: INK, marginTop: 10, lineHeight: 1.25 }}>Albüm kapağı: {lead.artist} · {lead.streams} dinlenme</div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 40, top: 1020, width: 1000, borderTop: `3px double ${INK}` }} />

        {/* ---- sutunlar (#2-#5) ---- */}
        {rest.map((it, i) => {
          const c = cells[i];
          const p = clamp((t - it.at) / 0.55);
          const badge = easeOutBack((t - it.at - 0.2) / 0.35);
          return (
            <div key={it.rank} style={{ position: "absolute", left: c.x, top: c.y, width: 480, height: 350, opacity: p, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: 200, height: 200, border: `3px solid ${INK}`, filter: "grayscale(0.15) contrast(1.08)" }}>
                <Img src={staticFile(it.cover)} style={{ width: 194, height: 194, objectFit: "cover" }} />
                <div style={{ position: "absolute", left: -14, top: -14, width: 64, height: 64, borderRadius: "50%", background: RED, color: PAPER, fontFamily: abril, fontSize: 42, display: "flex", alignItems: "center", justifyContent: "center", border: `3px solid ${PAPER}`, scale: badge }}>{it.rank}</div>
              </div>
              <div style={{ position: "absolute", left: 220, top: -4, width: 255 }}>
                <div style={{ fontFamily: oldstd, fontWeight: 700, fontSize: 21, letterSpacing: 3, color: RED }}>{kickerFor(it)}</div>
                <div style={{ fontFamily: playfair, fontWeight: 900, fontSize: Math.max(30, Math.min(56, 255 / (Math.min(it.title.length, 10) * 0.8))), lineHeight: 1.02, color: INK, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.title.toLocaleUpperCase("tr")}</div>
                <div style={{ fontFamily: playfairIt, fontWeight: 700, fontSize: 28, color: INK, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.artist}</div>
              </div>
              <div style={{ position: "absolute", left: 0, top: 214, width: 478 }}>
                <div style={{ borderTop: `2px solid ${INK}`, marginBottom: 10 }} />
                <div style={{ fontFamily: oldstd, fontWeight: 400, fontSize: 27, lineHeight: 1.25, color: INK }}>
                  <b>{it.streams}</b> dinlenme{subFor(it) ? ` · ${subFor(it)}` : ""}.
                  {it.peakText ? ` ${cap(it.peakText)}.` : ""}
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 539, top: 1050, height: 720, borderLeft: `2px solid ${INK}` }} />
        <div style={{ position: "absolute", left: 40, top: 1400, width: 1000, borderTop: `2px solid ${INK}` }} />

        {/* alt bilgi */}
        <div style={{ position: "absolute", left: 40, bottom: 56, width: 1000, display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `6px solid ${INK}`, paddingTop: 14 }}>
          <div style={{ fontFamily: oldstd, fontWeight: 700, fontSize: 34, letterSpacing: 5, color: INK }}>@YENISARKILARIM</div>
          <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 20, letterSpacing: 2, color: "rgba(27,22,16,0.7)" }}>KAYNAK · SPOTIFY TÜRKİYE GÜNLÜK LİSTE</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 34 }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{ width: 7, height: 6 + (bands[i + 1] ?? 0) * 26, background: INK, opacity: 0.8 }} />
            ))}
          </div>
        </div>

        {/* kirmizi damga */}
        {t >= OUTRO - 1.4 ? (
          <div style={{ position: "absolute", left: 180, top: 760, width: 720, textAlign: "center", rotate: "-10deg", opacity: clamp((t - (OUTRO - 1.4)) / 0.12), scale: 1 + 1.1 * (1 - easeOutCubic((t - (OUTRO - 1.4)) / 0.2)) }}>
            <div style={{ display: "inline-block", border: `14px solid ${RED}`, borderRadius: 18, padding: "6px 40px", color: RED, fontFamily: abril, fontSize: 130, lineHeight: 1.05, boxShadow: `inset 0 0 0 4px ${RED}`, background: "rgba(238,228,205,0.45)", mixBlendMode: "multiply" }}>GÜNÜN LİSTESİ</div>
          </div>
        ) : null}
      </div>

      {/* kapanis: son dakika bandi */}
      {outroT > 0 ? (
        <>
          <AbsoluteFill style={{ background: `rgba(13,10,7,${0.9 * outroT})` }} />
          <div style={{ position: "absolute", left: 0, top: 640, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
            <div style={{ display: "inline-block", background: RED, color: PAPER, fontFamily: oldstd, fontWeight: 700, fontSize: 44, letterSpacing: 8, padding: "6px 32px" }}>YARININ MANŞETİ</div>
            <div style={{ fontFamily: abril, fontSize: 150, lineHeight: 1.02, color: PAPER, marginTop: 50 }}>ZİRVEDE YENİ</div>
            <div style={{ fontFamily: abril, fontSize: 150, lineHeight: 1.02, color: "#f0c36a" }}>BİR İSİM Mİ?</div>
            <div style={{ fontFamily: oldstd, fontWeight: 700, fontSize: 40, letterSpacing: 7, color: PAPER, marginTop: 54 }}>@YENISARKILARIM</div>
          </div>
        </>
      ) : null}

      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
