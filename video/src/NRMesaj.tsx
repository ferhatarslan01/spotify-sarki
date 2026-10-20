import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import data from "./data-nrvar.json";

// "Yeni cikti" sablonu: MESAJLASMA. Bir arkadasin sohbeti: "yaziyor..." noktalari, mesajlar tek tek gelir, link karti acilir,
// "Hemen aciyorum" gonderilir ve sarki baslar. Okuma + merak izleyiciyi sona kadar tutar.
const { fontFamily } = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] });

const BANDS = data.bands as number[][];
const HUE = data.hue;
const ARTIST = data.artist;
const TITLE = data.title;
const REVEAL = data.reveal;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const IN_BG = "#272b36";
const OUT_BG = "#2f6bff";
const GREEN = "#1ed760";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const fit = (text: string, max: number, width: number, k = 0.55) => Math.min(max, width / (Math.max(text.length, 3) * k));

type Msg = { side: "in" | "out"; typeFrom: number; at: number; h: number; kind: "text" | "card"; text?: string };

// sohbet akisi (zamanlar saniye). Yuksekliklere gore dikey konum sabit hesaplanir.
const MSGS: Msg[] = [
  { side: "in", typeFrom: 0.2, at: 0.9, h: 120, kind: "text", text: "Abi dinledin mi?" },
  { side: "in", typeFrom: 1.4, at: 2.1, h: 120, kind: "text", text: "Yeni şarkı çıkmış" },
  { side: "out", typeFrom: 3.0, at: 3.8, h: 120, kind: "text", text: "Hangisi?" },
  { side: "in", typeFrom: 4.5, at: 5.3, h: 120, kind: "text", text: ARTIST },
  { side: "in", typeFrom: 5.9, at: 6.7, h: 470, kind: "card" },
  { side: "out", typeFrom: 7.7, at: 8.5, h: 120, kind: "text", text: "Hemen açıyorum" },
];
const GAP = 34;
const TOP0 = 290;
const POS = MSGS.map((_, i) => TOP0 + MSGS.slice(0, i).reduce((a, m) => a + m.h + GAP, 0));

const Dots: React.FC<{ t: number; side: "in" | "out" }> = ({ t, side }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "0 34px", height: 96, borderRadius: 48, background: side === "in" ? IN_BG : OUT_BG }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", opacity: 0.45 + 0.55 * Math.max(0, Math.sin(t * 9 - i * 0.9)), translate: `0px ${-Math.max(0, Math.sin(t * 9 - i * 0.9)) * 9}px` }} />
    ))}
  </div>
);

export const NRMesaj: React.FC = () => {
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
  const playerIn = easeOutCubic(dr / 0.6);
  const flash = revealed ? 0.55 * Math.exp(-10 * dr) : 0;
  const progress = clamp((dr / (OUTRO - REVEAL)) * 0.9);

  const titleSize = fit(TITLE, 58, 700, 0.55);
  const artistSize = fit(ARTIST, 44, 700, 0.55);

  return (
    <AbsoluteFill style={{ background: "#0e1118", fontFamily }}>
      <Audio src={staticFile("nrvar-soundtrack.wav")} />

      <AbsoluteFill style={{ background: `radial-gradient(ellipse 120% 60% at 50% 0%, hsla(${HUE},50%,18%,0.9) 0%, #0e1118 65%)`, opacity: fadeIn }} />

      {/* durum cubugu */}
      <div style={{ position: "absolute", left: 70, top: 46, right: 70, display: "flex", justifyContent: "space-between", color: "#fff", fontWeight: 600, fontSize: 32, opacity: fadeIn }}>
        <div>00:00</div>
        <svg width="58" height="28" viewBox="0 0 58 28" fill="none">
          <rect x="1.5" y="1.5" width="48" height="25" rx="7" stroke="#fff" strokeWidth="3" />
          <rect x="6" y="6" width="34" height="16" rx="4" fill="#fff" />
          <rect x="52" y="9" width="5" height="10" rx="2.5" fill="#fff" />
        </svg>
      </div>

      {/* sohbet basligi */}
      <div style={{ position: "absolute", left: 0, top: 110, width: 1080, height: 130, background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 26, padding: "0 50px", boxSizing: "border-box", opacity: fadeIn }}>
        <div style={{ width: 84, height: 84, borderRadius: "50%", background: `linear-gradient(135deg, hsl(${HUE},80%,55%), hsl(${(HUE + 60) % 360},80%,45%))`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 40 }}>M</div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 44 }}>Müzik Kankam</div>
          <div style={{ color: GREEN, fontWeight: 500, fontSize: 28, marginTop: 2 }}>çevrimiçi</div>
        </div>
      </div>

      {/* mesajlar */}
      <div style={{ opacity: (revealed ? 1 - playerIn : 1) * (1 - outroT) }}>
        {MSGS.map((m, i) => {
          const isOut = m.side === "out";
          const typing = t >= m.typeFrom && t < m.at;
          const shown = t >= m.at;
          const k = easeOutBack((t - m.at) / 0.3);
          const style: React.CSSProperties = {
            position: "absolute",
            top: POS[i],
            [isOut ? "right" : "left"]: 50,
            transformOrigin: isOut ? "100% 100%" : "0% 100%",
          } as React.CSSProperties;
          if (typing) {
            return (
              <div key={i} style={style}>
                <Dots t={t} side={m.side} />
              </div>
            );
          }
          if (!shown) return null;
          if (m.kind === "card") {
            return (
              <div key={i} style={{ ...style, scale: 0.85 + 0.15 * k, opacity: clamp((t - m.at) / 0.12) }}>
                <div style={{ width: 760, borderRadius: 40, background: IN_BG, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}>
                  <Img src={staticFile("nrvar-cover.jpg")} style={{ width: 760, height: 330, objectFit: "cover", display: "block" }} />
                  <div style={{ padding: "22px 30px 26px", display: "flex", alignItems: "center", gap: 22 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: GREEN, fontWeight: 700, fontSize: 26, letterSpacing: 4 }}>SPOTIFY · YENİ ŞARKI</div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: titleSize, lineHeight: 1.1, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{TITLE}</div>
                      <div style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500, fontSize: artistSize * 0.8, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ARTIST}</div>
                    </div>
                    <div style={{ width: 92, height: 92, borderRadius: "50%", background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="#0a0c12">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div key={i} style={{ ...style, scale: 0.8 + 0.2 * k, opacity: clamp((t - m.at) / 0.1) }}>
              <div
                style={{
                  display: "inline-block",
                  maxWidth: 760,
                  padding: "26px 40px",
                  borderRadius: 52,
                  background: isOut ? OUT_BG : IN_BG,
                  color: "#fff",
                  fontWeight: 500,
                  fontSize: m.text === ARTIST ? fit(m.text ?? "", 52, 680, 0.55) : 52,
                  lineHeight: 1.15,
                  whiteSpace: "nowrap",
                  boxShadow: "0 8px 26px rgba(0,0,0,0.3)",
                }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* mesaj girisi */}
      <div style={{ position: "absolute", left: 40, bottom: 70, width: 1000, height: 100, borderRadius: 50, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", padding: "0 40px", boxSizing: "border-box", color: "rgba(255,255,255,0.4)", fontSize: 38, opacity: fadeIn * (1 - playerIn * (revealed ? 1 : 0)) }}>
        Mesaj yaz
      </div>

      {/* calar */}
      {revealed ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: playerIn * (1 - outroT) }}>
          <div style={{ position: "absolute", left: 120, top: 360, width: 840, height: 840, borderRadius: 40, overflow: "hidden", scale: (0.9 + 0.1 * playerIn) * (1 + bass * 0.03), boxShadow: `0 40px 120px hsla(${HUE},85%,50%,0.55), 0 30px 90px rgba(0,0,0,0.6)` }}>
            <Img src={staticFile("nrvar-cover.jpg")} style={{ width: 840, height: 840, objectFit: "cover" }} />
          </div>
          <div style={{ position: "absolute", left: 120, top: 1250, width: 840, color: "#fff" }}>
            <div style={{ fontWeight: 700, fontSize: fit(TITLE, 66, 840, 0.55), lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{TITLE}</div>
            <div style={{ fontWeight: 500, fontSize: fit(ARTIST, 46, 840, 0.55), opacity: 0.75, marginTop: 6, whiteSpace: "nowrap" }}>{ARTIST}</div>
            <div style={{ marginTop: 40, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.25)" }}>
              <div style={{ width: `${progress * 100}%`, height: 8, borderRadius: 4, background: GREEN }} />
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, top: 1700, width: 1080, textAlign: "center", color: GREEN, fontWeight: 700, fontSize: 40, letterSpacing: 6, opacity: clamp((dr - 0.6) / 0.5) }}>
            ŞİMDİ SPOTIFY&apos;DA
          </div>
          <div style={{ position: "absolute", left: 0, top: 220, width: 1080, textAlign: "center", color: "rgba(255,255,255,0.8)", fontWeight: 600, fontSize: 34, letterSpacing: 8 }}>ŞİMDİ ÇALIYOR</div>
        </div>
      ) : null}

      {/* kapanis */}
      {outroT > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 860, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 78 }}>Sen dinledin mi?</div>
          <div style={{ color: GREEN, fontWeight: 700, fontSize: 46, letterSpacing: 6, marginTop: 24 }}>@YENISARKILARIM</div>
        </div>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
