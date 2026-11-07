import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-wkc.json";

// Haftalik liste sablonu: TAM EKRAN ORIJINAL KLIPLER + sol tarafta 1-10 liste.
// Ustte baslik ve haftanin tarih araligi; liste asagidan yukari (10 -> 1) dolar, o an calan satir vurgulanir.
// Arkada o siranin klibi (iTunes resmi klip onizlemesi) kendi sesiyle calar; klibi olmayan sarkida bulanik kapak gosterilir.
// Tum rakamlar gercek haftalik liste verisidir.
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: inter } = loadInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

type Item = { rank: number; title: string; artist: string; streams: string; change: number | string | null; weeks: number | null; peak: number | null; peakTimes: number; cover: string; hue: number; clip: string | null; at: number; len: number; main: number; hero: boolean };
const ITEMS = data.items as unknown as Item[]; // gosterim sirasi: 10 -> 1
const ROWS = [...ITEMS].sort((a, b) => a.rank - b.rank); // listede ustten alta: 1 -> 10
const BANDS = data.bands as number[][];
const INTRO = data.intro;
const DUR = data.durationSeconds;
const FADE = 0.3; // klipler arasi capraz erime

const ACCENT = "#ff4d8d";
const GOLD = "#ffcf3a";
const GREEN = "#2ee59a";
const DOWN = "#ff6b7a";

const LIST_X = 56;
const LIST_Y = 620;
const ROW_H = 84;
const CARD_X = 150;
const CARD_W = 700;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
const bassAt = (frame: number) => {
  const b = BANDS[Math.min(BANDS.length - 1, Math.max(0, frame))] ?? [];
  return ((b[0] ?? 0) + (b[1] ?? 0) + (b[2] ?? 0) + (b[3] ?? 0)) / 4;
};

const Tri: React.FC<{ color: string; down?: boolean; size?: number }> = ({ color, down, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{ rotate: down ? "180deg" : "0deg", flexShrink: 0 }}>
    <path d="M10 3 L18 16 H2 Z" fill={color} />
  </svg>
);

const Move: React.FC<{ change: number | string | null; size: number }> = ({ change, size }) => {
  if (change === null || change === undefined) return null;
  if (change === "NEW") return <span style={{ background: GOLD, color: "#1a1300", fontFamily: inter, fontWeight: 800, fontSize: size * 0.72, letterSpacing: 1, padding: `${size * 0.05}px ${size * 0.3}px`, borderRadius: size * 0.3 }}>YENİ</span>;
  if (change === 0) return <span style={{ color: "rgba(255,255,255,0.65)", fontFamily: mono, fontWeight: 700, fontSize: size }}>=</span>;
  const n = Number(change);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.2, color: n > 0 ? GREEN : DOWN, fontFamily: mono, fontWeight: 700, fontSize: size }}>
      <Tri color={n > 0 ? GREEN : DOWN} down={n < 0} size={size * 0.8} />
      {Math.abs(n)}
    </span>
  );
};

// ---------- arka plan: o siranin klibi neredeyse tam ekran (arkada bulanik ambiyans), klibi yoksa buyuk kapak ----------
const WIN_TOP = 150;
const WIN_H = 1500;
const MASK = "linear-gradient(to bottom, transparent 0%, #000 7%, #000 93%, transparent 100%)";
const BgSlot: React.FC<{ item: Item }> = ({ item }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const fadeIn = clamp(t / FADE);
  const fadeOut = item.hero ? 1 : 1 - clamp((t - item.len) / FADE); // sonraki klibin girisiyle capraz erir
  const pan = 30 + 40 * clamp(t / item.len); // kadraj klip boyunca soldan saga kayar
  const push = 1.0 + 0.05 * clamp(t / item.len);
  const bass = bassAt(Math.round((item.at + t) * fps));
  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut, background: hsl(item.hue, 50, 8) }}>
      {item.clip ? (
        <>
          <OffthreadVideo src={staticFile(item.clip)} muted style={{ position: "absolute", inset: 0, width: 1080, height: 1920, objectFit: "cover", filter: "blur(40px) brightness(0.55) saturate(1.3)", transform: "scale(1.25)" }} />
          <div style={{ position: "absolute", left: 0, top: WIN_TOP, width: 1080, height: WIN_H, overflow: "hidden", WebkitMaskImage: MASK, maskImage: MASK }}>
            <OffthreadVideo src={staticFile(item.clip)} muted style={{ width: 1080, height: WIN_H, objectFit: "cover", objectPosition: `${pan}% 50%`, transform: `scale(${push})`, transformOrigin: `${pan}% 50%`, filter: "brightness(1.08) saturate(1.12)" }} />
          </div>
        </>
      ) : (
        <>
          <Img src={staticFile(item.cover)} style={{ position: "absolute", inset: 0, width: 1080, height: 1920, objectFit: "cover", filter: "blur(44px) brightness(0.7) saturate(1.4)", transform: `scale(${1.5 + 0.08 * bass})` }} />
          <div style={{ position: "absolute", left: 0, top: WIN_TOP, width: 1080, height: WIN_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Img src={staticFile(item.cover)} style={{ width: 960, height: 960, borderRadius: 30, boxShadow: `0 40px 120px ${hsl(item.hue, 90, 45, 0.55)}`, transform: `scale(${1 + 0.04 * bass + 0.03 * clamp(t / item.len)})` }} />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

// ---------- ust: baslik + tarih araligi ----------
const Header: React.FC<{ t: number }> = ({ t }) => {
  const pop = easeOutBack((t - 0.1) / 0.5);
  const pill = easeOutBack((t - 0.4) / 0.5);
  return (
    <div style={{ position: "absolute", top: 208, left: 0, right: 0, textAlign: "center" }}>
      <div style={{ opacity: clamp(pop), fontFamily: inter, fontWeight: 800, fontSize: 28, letterSpacing: 8, color: "rgba(255,255,255,0.85)", textShadow: "0 3px 14px rgba(0,0,0,0.8)" }}>@YENISARKILARIM</div>
      <div style={{ marginTop: 18, transform: `scale(${0.85 + 0.15 * pop})`, opacity: clamp(pop) }}>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 108, lineHeight: 1.0, color: "#fff", textShadow: "0 6px 34px rgba(0,0,0,0.75)" }}>HAFTANIN EN ÇOK</div>
        <div style={{ fontFamily, fontWeight: 700, fontSize: 108, lineHeight: 1.0, color: ACCENT, textShadow: "0 6px 34px rgba(0,0,0,0.75)" }}>DİNLENEN ŞARKILARI</div>
      </div>
      <div style={{ marginTop: 22, display: "inline-block", transform: `scale(${0.8 + 0.2 * pill})`, opacity: clamp(pill), background: "rgba(10,10,16,0.5)", border: `2px solid ${ACCENT}`, borderRadius: 40, padding: "8px 30px", fontFamily: inter, fontWeight: 800, fontSize: 36, letterSpacing: 1, color: "#fff", backdropFilter: "blur(10px)" }}>{data.range}</div>
    </div>
  );
};

// ---------- liste: 1-10, asagidan yukari dolar ----------
const ListRow: React.FC<{ item: Item; t: number; nums: number }> = ({ item, t, nums }) => {
  const y = LIST_Y + (item.rank - 1) * ROW_H;
  const nextAt = item.hero ? 1e9 : item.at + item.len;
  const revealed = t >= item.at;
  const current = revealed && t < nextAt;
  const k = easeOutCubic((t - item.at) / 0.35);
  const numIn = easeOutBack((t - 0.25 - (10 - item.rank) * 0.07) / 0.4);
  const gold = item.hero;
  const accent = gold ? GOLD : ACCENT;
  const pulse = current ? 1 + 0.025 * Math.exp(-(t - item.at) * 6) : 1;
  const textW = CARD_W - 20 - 64 - 16 - 96 - 14;
  const tSize = fit(item.title, 41, textW, 0.52);
  const aSize = fit(item.artist, 28, textW, 0.54);
  return (
    <div style={{ position: "absolute", left: LIST_X, top: y, width: CARD_X + CARD_W - LIST_X, height: ROW_H - 12, opacity: clamp(numIn) * (nums ? 1 : 0), transform: `scale(${pulse})`, transformOrigin: "left center" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 84, height: ROW_H - 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily, fontWeight: 700, fontSize: 70, color: revealed ? (current ? accent : "#fff") : "rgba(255,255,255,0.5)", textShadow: "0 3px 16px rgba(0,0,0,0.85)" }}>{item.rank}</div>
      {revealed ? (
        <div style={{ position: "absolute", left: CARD_X - LIST_X, top: 0, width: CARD_W, height: ROW_H - 12, display: "flex", alignItems: "center", gap: 16, padding: "0 14px 0 10px", borderRadius: 20, background: current ? "rgba(8,8,14,0.7)" : "rgba(8,8,14,0.4)", border: `3px solid ${current ? accent : "rgba(255,255,255,0.0)"}`, boxShadow: current ? `0 0 34px ${accent}77` : "none", opacity: k, transform: `translateX(${(1 - k) * -90}px)`, backdropFilter: "blur(6px)" }}>
          <Img src={staticFile(item.cover)} style={{ width: 64, height: 64, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", fontFamily: inter }}>
            <div style={{ fontWeight: 800, color: "#fff", fontSize: tSize, lineHeight: 1.08, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>{item.title}</div>
            <div style={{ fontWeight: 700, color: accent, fontSize: aSize, lineHeight: 1.1, marginTop: 1, textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{item.artist}</div>
          </div>
          <div style={{ width: 96, display: "flex", justifyContent: "flex-end" }}>
            <Move change={item.change} size={32} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const WeeklyClips: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const bass = bassAt(frame);
  const h = ITEMS[ITEMS.length - 1].hue;
  const introBg = 1 - clamp((t - INTRO) / FADE);
  // her yeni satir icin kisa parlama (en sonuncuda guclu)
  const flash = ITEMS.reduce((acc, it) => (t >= it.at ? Math.max(acc, (it.hero ? 0.5 : 0.16) * Math.exp(-(t - it.at) * 10)) : acc), 0);
  return (
    <AbsoluteFill style={{ background: "#05050a" }}>
      <Audio src={staticFile("wkc-soundtrack.wav")} />
      {/* giris arka plani: klip baslayana kadar renkli bir isik */}
      <AbsoluteFill style={{ opacity: introBg, background: `radial-gradient(ellipse 90% 55% at 50% 38%, ${hsl(h, 70, 24 + 6 * bass)} 0%, ${hsl(h, 60, 6)} 80%)` }} />
      {ITEMS.map((it) => (
        <Sequence key={it.rank} from={Math.round(it.at * fps)} durationInFrames={Math.round((it.len + (it.hero ? 0 : FADE)) * fps)}>
          <BgSlot item={it} />
        </Sequence>
      ))}
      {/* okunurluk: ust ve sol karartma + vinyet */}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.14) 30%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.22) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(to right, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 65%)" }} />
      <Header t={t} />
      {ROWS.map((it) => (
        <ListRow key={it.rank} item={it} t={t} nums={1} />
      ))}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 75% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.22) 100%)" }} />
      {flash > 0.01 ? <AbsoluteFill style={{ background: `rgba(255,255,255,${flash})` }} /> : null}
      {fadeOut > 0 ? <AbsoluteFill style={{ background: `rgba(0,0,0,${fadeOut})` }} /> : null}
    </AbsoluteFill>
  );
};
