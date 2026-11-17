import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-gta.json";

// "GTA 5 -> GTA 6": bu haftanin en cok dinlenen 5 rapcisinin eski ve yeni fotografi yan yana (5 -> 1 geri sayim).
// Fotograflar duz katmandir: filtre/karisim/yapay zeka yok, yalnizca konum, olcek ve saydamlik animasyonu.
// Eksik fotograf yerine kapak ve "ORNEK FOTO" seridi gorunur (onizleme icin); paylasim bu durumda reddedilir (src/gtaCompare.js).

const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

type Item = {
  rank: number; key: string; name: string; streams: number; streamsText: string; songs: number; topSong: string;
  oldFile: string; newFile: string; oldYear: number | null; newYear: number | null; oldPos: string; newPos: string;
  oldPlaceholder: boolean; newPlaceholder: boolean; at: number;
};

const ITEMS = data.items as unknown as Item[]; // gosterim sirasi: 5 -> 1
const BANDS = data.bands as number[][];
const INTRO = data.intro;
const SLIDE = data.slide;
const REVEAL = data.reveal;
const OUTRO_AT = data.outro;
const DUR = data.durationSeconds;
const W = 1080;

// GTA 6 (Vice City gunbatimi) ve GTA 5 (soluk yesil/gri) renk dili
const PINK = "#ff3d8b";
const ORANGE = "#ff8a3d";
const TEAL = "#16d9c9";
const OLIVE = "#8fa57c";
const GRAD = `linear-gradient(120deg, ${PINK}, ${ORANGE} 55%, ${TEAL})`;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeInOut = (x: number) => {
  const y = clamp(x);
  return y < 0.5 ? 4 * y * y * y : 1 - (-2 * y + 2) ** 3 / 2;
};
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const hash = (a: number, b = 0, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;
const fit = (s: string, max: number, width: number, k = 0.52) => Math.min(max, Math.floor(width / (Math.max(1, s.length) * k)));

// panel olculeri (yan yana, dikey fotograflar)
const PANEL_W = 480;
const PANEL_H = 780;
const PANEL_Y = 500;
const LEFT_X = 50;
const RIGHT_X = 550;

const Photo: React.FC<{ file: string; pos: string; placeholder: boolean; scale?: number }> = ({ file, pos, placeholder, scale = 1 }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0c0c12" }}>
    <Img src={staticFile(file)} style={{ width: PANEL_W, height: PANEL_H, objectFit: "cover", objectPosition: pos, display: "block", scale, transformOrigin: "50% 40%" }} />
    {placeholder ? (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 56, textAlign: "center", background: "rgba(220,30,60,0.92)", color: "#fff", fontFamily, fontWeight: 700, fontSize: 34, letterSpacing: 6, padding: "6px 0" }}>ÖRNEK FOTO</div>
    ) : null}
  </div>
);

// ---------------------------------------------------------------- simgeler (yazi degil): GTA V ve GTA VI rozetleri
// Kendi cizimimiz: V ve VI romen rakamlari. Resmi logo kullanilacaksa gta-foto/logo-gta5.png ve logo-gta6.png konur (data.logo5 / data.logo6).
const MarkV: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" style={{ display: "block" }}>
    <defs>
      <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f3f8e8" />
        <stop offset="1" stopColor="#8fa57c" />
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="114" height="114" rx="22" fill="#10150e" stroke={OLIVE} strokeWidth="5" />
    <polygon points="20,24 46,24 60,78 74,24 100,24 73,98 47,98" fill="url(#gv)" />
  </svg>
);

const MarkVI: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" style={{ display: "block" }}>
    <defs>
      <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff3d8b" />
        <stop offset="0.6" stopColor="#ff8a3d" />
        <stop offset="1" stopColor="#ffd24d" />
      </linearGradient>
      <linearGradient id="gb" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff3d8b" />
        <stop offset="0.55" stopColor="#ff8a3d" />
        <stop offset="1" stopColor="#16d9c9" />
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="114" height="114" rx="22" fill="#14081f" stroke="url(#gb)" strokeWidth="5" />
    <polygon points="12,26 36,26 48,76 60,26 84,26 60,98 36,98" fill="url(#gs)" />
    <rect x="90" y="26" width="18" height="72" rx="3" fill="url(#gs)" />
    {[60, 70, 80, 90].map((y, k) => (
      <rect key={y} x="8" y={y} width="104" height={2 + k} fill="#14081f" />
    ))}
  </svg>
);

// full: giriste yazili tam logo (grand theft auto V). Logo dosyasi yoksa cizilmis rozet kullanilir.
const Mark: React.FC<{ kind: 5 | 6; size: number; full?: boolean }> = ({ kind, size, full }) => {
  const file = kind === 6 ? (data.logo6 ? "gta-logo-6.png" : null) : full && data.logo5full ? "gta-logo-5full.png" : data.logo5 ? "gta-logo-5.png" : null;
  if (file) return <Img src={staticFile(file)} style={{ height: size, width: "auto", maxWidth: size * 2.4, objectFit: "contain", display: "block" }} />;
  return kind === 5 ? <MarkV size={size} /> : <MarkVI size={size} />;
};

const Badge: React.FC<{ year: number | null; kind: "old" | "new" }> = ({ year, kind }) => (
  <div style={{ position: "absolute", left: 14, top: 14, display: "flex", alignItems: "center", gap: 12, zIndex: 4, padding: 8, borderRadius: 18, background: "rgba(10,10,16,0.62)", filter: `drop-shadow(0 6px 16px rgba(0,0,0,0.6))` }}>
    <Mark kind={kind === "old" ? 5 : 6} size={92} />
    {year ? <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 34, color: "#fff", background: "rgba(10,10,16,0.72)", padding: "4px 14px", borderRadius: 12 }}>{year}</div> : null}
  </div>
);

// ---------------------------------------------------------------- slayt
const Slide: React.FC<{ item: Item; index: number; t: number; frame: number; bass: number }> = ({ item, index, t, frame, bass }) => {
  const u = t - item.at;
  const hero = item.rank === 1;
  const nameIn = easeOutBack((u - 0.05) / 0.4);
  const leftIn = easeOutCubic((u - 0.15) / 0.45);
  const revealU = u - REVEAL;
  const revealed = revealU >= 0;
  const rIn = easeOutBack(revealU / 0.4);
  const flash = revealed ? Math.exp(-revealU * 9) : 0;
  const push = 1 + 0.03 * clamp(u / SLIDE);
  const spin = (u - 0.6) * 380;

  return (
    <>
      {/* rutbe + isim */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 215, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 26, opacity: clamp(nameIn), scale: 0.9 + 0.1 * nameIn }}>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 210, lineHeight: 1, ...(hero ? { color: "#ffd24d", textShadow: "0 6px 30px rgba(0,0,0,0.7), 0 0 40px rgba(255,210,77,0.5)" } : { background: GRAD, WebkitBackgroundClip: "text", color: "transparent" }) }}>{`#${item.rank}`}</div>
        <div style={{ fontFamily, fontWeight: 700, fontSize: fit(item.name.toUpperCase(), 130, 640), lineHeight: 1, color: "#fff", textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>{item.name.toUpperCase()}</div>
      </div>

      {/* GTA 5: eski */}
      <div style={{ position: "absolute", left: LEFT_X, top: PANEL_Y, width: PANEL_W, height: PANEL_H, translate: `${(1 - leftIn) * -620}px 0px`, opacity: clamp(leftIn * 2), borderRadius: 22, overflow: "hidden", border: `4px solid ${OLIVE}`, boxShadow: "0 24px 60px rgba(0,0,0,0.6)", scale: push, transformOrigin: "100% 50%" }}>
        <Photo file={item.oldFile} pos={item.oldPos} placeholder={item.oldPlaceholder} />
        <Badge year={item.oldYear} kind="old" />
      </div>

      {/* GTA 6: yeni (once yukleniyor) */}
      <div style={{ position: "absolute", left: RIGHT_X, top: PANEL_Y, width: PANEL_W, height: PANEL_H, borderRadius: 22, overflow: "hidden", border: revealed ? "0" : "4px dashed rgba(255,255,255,0.25)", background: "rgba(12,12,20,0.7)", opacity: clamp(leftIn * 2), scale: revealed ? (0.94 + 0.06 * clamp(rIn)) * push : push, transformOrigin: "0% 50%", boxShadow: revealed ? `0 0 ${50 + bass * 40}px ${PINK}99, 0 24px 60px rgba(0,0,0,0.6)` : "none" }}>
        {revealed ? (
          <>
            <Photo file={item.newFile} pos={item.newPos} placeholder={item.newPlaceholder} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 22, boxShadow: `inset 0 0 0 6px ${PINK}, inset 0 0 46px ${ORANGE}55`, zIndex: 3 }} />
            <Badge year={item.newYear} kind="new" />
            <div style={{ position: "absolute", inset: 0, background: `rgba(255,255,255,${flash * 0.85})` }} />
          </>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
            <div style={{ position: "relative", width: 190, height: 190, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "10px solid rgba(255,255,255,0.12)", borderTopColor: PINK, rotate: `${spin}deg` }} />
              <div style={{ opacity: 0.85 }}><Mark kind={6} size={84} /></div>
            </div>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 32, letterSpacing: 4, color: "rgba(255,255,255,0.7)" }}>YÜKLENİYOR</div>
          </div>
        )}
      </div>

      {/* haftalik akis */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1328, display: "flex", justifyContent: "center", gap: 18, opacity: clamp((u - 0.5) / 0.3) }}>
        <div style={{ padding: "10px 30px", borderRadius: 40, background: "rgba(12,12,20,0.78)", border: `3px solid ${ORANGE}`, fontFamily: mono, fontWeight: 700, fontSize: 38, color: "#fff" }}>
          {item.streamsText}
        </div>
      </div>

      {/* ilerleme noktalari */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1440, display: "flex", justifyContent: "center", gap: 16 }}>
        {ITEMS.map((_, i) => (
          <div key={i} style={{ width: i === index ? 54 : 18, height: 18, borderRadius: 9, background: i === index ? GRAD : "rgba(255,255,255,0.25)" }} />
        ))}
      </div>
    </>
  );
};

// ---------------------------------------------------------------- giris (yukleme ekrani) ve kapanis
const Intro: React.FC<{ t: number }> = ({ t }) => {
  const pct = Math.round(easeInOut((t - 0.2) / 1.6) * 100);
  const pop = easeOutBack((t - 0.1) / 0.5);
  const out = 1 - clamp((t - (INTRO - 0.12)) / 0.12);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <div style={{ position: "absolute", left: 40, right: 40, top: 520, textAlign: "center", opacity: clamp(pop), scale: 0.9 + 0.1 * pop }}>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 130, lineHeight: 1.02, color: "#fff", textShadow: "0 8px 34px rgba(0,0,0,0.8)" }}>RAPÇİLER</div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 26, marginTop: 30 }}>
          <Mark kind={5} size={290} full />
          <svg width="90" height="60" viewBox="0 0 110 70"><path d="M5 35 H85 M60 8 L98 35 L60 62" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <Mark kind={6} size={290} />
        </div>
        <div style={{ fontFamily, fontWeight: 500, fontSize: 52, letterSpacing: 5, color: "rgba(255,255,255,0.85)", marginTop: 34 }}>5 RAPÇİ · ESKİ / YENİ</div>
        <div style={{ display: "inline-block", marginTop: 18, padding: "6px 26px", borderRadius: 30, background: "rgba(255,255,255,0.12)", fontFamily: mono, fontWeight: 500, fontSize: 26, letterSpacing: 2, color: "rgba(255,255,255,0.85)" }}>{`SIRALAMA: SPOTIFY GÜNLÜK AKIŞ · ${data.updated}`}</div>
      </div>
      <div style={{ position: "absolute", left: 90, right: 90, top: 1260 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: "rgba(255,255,255,0.8)", marginBottom: 14 }}>
          <span>YÜKLENİYOR…</span>
          <span>{`%${pct}`}</span>
        </div>
        <div style={{ height: 22, borderRadius: 11, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: GRAD }} />
        </div>
      </div>
    </div>
  );
};

const Outro: React.FC<{ t: number }> = ({ t }) => {
  const u = t - OUTRO_AT;
  const q = easeOutBack(u / 0.45);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: 40, right: 40, top: 380, textAlign: "center", opacity: clamp(q), scale: 0.9 + 0.1 * q }}>
        <div style={{ fontFamily, fontWeight: 500, fontSize: 52, letterSpacing: 8, color: "rgba(255,255,255,0.82)" }}>SENCE EN ÇOK</div>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 124, lineHeight: 1.02, background: GRAD, WebkitBackgroundClip: "text", color: "transparent" }}>KİM DEĞİŞTİ?</div>
      </div>
      <div style={{ position: "absolute", left: 50, right: 50, top: 850, display: "flex", justifyContent: "space-between" }}>
        {[...ITEMS].reverse().map((it, i) => {
          const k = easeOutBack((u - 0.25 - i * 0.08) / 0.4);
          return (
            <div key={it.key} style={{ width: 180, opacity: clamp(k), scale: 0.8 + 0.2 * clamp(k) }}>
              <div style={{ position: "relative", width: 180, height: 240, borderRadius: 16, overflow: "hidden", border: `3px solid ${PINK}` }}>
                <Img src={staticFile(it.newFile)} style={{ width: 180, height: 240, objectFit: "cover", objectPosition: it.newPos, display: "block" }} />
                <div style={{ position: "absolute", left: 0, top: 0, padding: "2px 12px", background: GRAD, fontFamily, fontWeight: 700, fontSize: 34, color: "#fff", borderBottomRightRadius: 12 }}>{`#${it.rank}`}</div>
              </div>
              <div style={{ textAlign: "center", fontFamily, fontWeight: 700, fontSize: fit(it.name.toUpperCase(), 40, 176), color: "#fff", marginTop: 10 }}>{it.name.toUpperCase()}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1230, textAlign: "center", opacity: clamp((u - 0.7) / 0.3) }}>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 70, letterSpacing: 4, color: "#fff" }}>YORUMA İSMİNİ YAZ</div>
        <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 28, letterSpacing: 4, color: "rgba(255,255,255,0.6)", marginTop: 18 }}>@YENISARKILARIM</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- ana kompozisyon
export const GtaCompare: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const idx = ITEMS.findIndex((it) => t >= it.at && t < it.at + SLIDE);
  const inSlides = idx >= 0;
  const inOutro = t >= OUTRO_AT;
  const fadeOut = clamp((t - (DUR - 0.4)) / 0.4);

  // slayt gecisi: neon bant
  let wipe: React.ReactNode = null;
  for (const [i, it] of ITEMS.entries()) {
    if (i === 0) continue;
    const u = (t - (it.at - 0.15)) / 0.3;
    if (u > 0 && u < 1) {
      const x = -1400 + (W + 1400) * easeInOut(u);
      wipe = (
        <div style={{ position: "absolute", left: x, top: 0, width: 1400, height: 1920, background: GRAD, zIndex: 40 }}>
          {Array.from({ length: 10 }).map((_, k) => (
            <div key={k} style={{ position: "absolute", right: 0, top: rnd(frame, k + 3) * 1880, width: 260 + rnd(frame, k + 9) * 200, height: 8 + rnd(frame, k + 20) * 30, background: "rgba(255,255,255,0.5)" }} />
          ))}
        </div>
      );
    }
  }

  return (
    <AbsoluteFill style={{ background: "#07050d", fontFamily }}>
      <Audio src={staticFile("gta-soundtrack.wav")} />

      {/* zemin: Vice City gunbatimi, bass ile hafif nabiz */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 120% 55% at 50% 0%, rgba(255,61,139,${0.34 + bass * 0.12}) 0%, rgba(0,0,0,0) 62%), radial-gradient(ellipse 100% 50% at 50% 100%, rgba(22,217,201,${0.22 + bass * 0.1}) 0%, rgba(0,0,0,0) 60%), linear-gradient(180deg, #170b26 0%, #0a0714 60%, #07050d 100%)` }} />
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)", pointerEvents: "none" }} />

      {t >= INTRO - 0.2 && t < OUTRO_AT ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 104, textAlign: "center", fontFamily: mono, fontWeight: 500, fontSize: 26, letterSpacing: 4, color: "rgba(255,255,255,0.6)" }}>{`5 RAPÇİ · ESKİ / YENİ`}</div>
      ) : null}

      {t < INTRO ? <Intro t={t} /> : null}
      {inSlides ? <Slide item={ITEMS[idx]} index={idx} t={t} frame={frame} bass={bass} /> : null}
      {inOutro ? <Outro t={t} /> : null}
      {wipe}

      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export const GTA_SECONDS = DUR;
