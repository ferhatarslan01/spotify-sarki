import React from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadTypewriter } from "@remotion/google-fonts/SpecialElite";
import data from "./data-nrvar.json";

// "Yeni cikti" sablonu: KASET. Sicak ahsap masa ustunde kaset: kalemle etiket yazilir, PLAY tusu basilir,
// makaralar doner, VU ibreleri muzikle oynar, kapak "kaset kapagi" kartiyla yukari kayar.
const { fontFamily: hand } = loadCaveat("normal", { weights: ["600", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: typewriter } = loadTypewriter("normal", { subsets: ["latin", "latin-ext"] });

const BANDS = data.bands as number[][];
const HUE = data.hue;
const ARTIST = data.artist;
const TITLE = data.title;
const REVEAL = data.reveal;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const HAS_BG = Boolean((data as { bg?: boolean }).bg);
const BG_SECONDS = (data as { bgSeconds?: number }).bgSeconds ?? 0;
const PLAY_AT = REVEAL - 0.35;
const INK = "#1d2a5c";
const PAPER = "#f1e6c8";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (text: string, max: number, width: number, k = 0.42) => Math.min(max, width / (Math.max(text.length, 3) * k));

const Reel: React.FC<{ x: number; y: number; angle: number; r: number }> = ({ x, y, angle, r }) => (
  <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: "#f4f4f0", boxShadow: "inset 0 0 0 6px #d8d8d2", rotate: `${angle}deg` }}>
    {[0, 60, 120, 180, 240, 300].map((a) => (
      <div key={a} style={{ position: "absolute", left: r - 7, top: 6, width: 14, height: r * 0.5, background: "#2a2a2a", borderRadius: 3, transformOrigin: `7px ${r - 6}px`, rotate: `${a}deg` }} />
    ))}
    <div style={{ position: "absolute", left: r * 0.62, top: r * 0.62, width: r * 0.76, height: r * 0.76, borderRadius: "50%", background: "#161616" }} />
  </div>
);

export const NRKaset: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;
  const mid = ((bands[4] ?? 0) + (bands[6] ?? 0) + (bands[8] ?? 0) + (bands[10] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.5);
  const fadeOut = clamp((t - (DUR - 0.8)) / 0.8);
  const dr = t - REVEAL;
  const outroT = clamp((t - OUTRO) / 0.7);
  const playing = t >= REVEAL;

  // kaset masaya duser
  const drop = easeOutBack((t - 0.3) / 0.7);
  const dropY = (1 - drop) * -900;
  const settle = t > 1.0 ? 0 : Math.sin(t * 40) * 3 * (1 - clamp((t - 0.3) / 0.7));

  // makara donusu: PLAY'e kadar durur, sonra hizlanip sabitlenir
  const speed = playing ? 180 * easeOutCubic(dr / 0.8) + 60 : 0;
  const spin = playing ? dr * speed : 0;
  const leftAngle = spin;
  const rightAngle = spin * 1.12;

  // PLAY tusu
  const pressed = t >= PLAY_AT;
  // etiket: kalemle yazma
  const labelWrite = clamp((t - 1.3) / 1.0);
  const labelWrite2 = clamp((dr - 0.1) / 1.2);
  const label1 = "YENİ ÇIKTI".slice(0, Math.floor(labelWrite * 10));
  const full = `${ARTIST} – ${TITLE}`;
  const label2 = full.slice(0, Math.floor(labelWrite2 * full.length));
  const labelSize = fit(full, 80, 700, 0.4);

  // VU ibreleri
  const needleL = -50 + (bass * 0.8 + mid * 0.2) * 110 + Math.sin(t * 9) * 3;
  const needleR = -50 + (mid * 0.8 + bass * 0.2) * 110 + Math.cos(t * 11) * 3;

  // kapak karti yukari kayar
  const cardIn = easeOutCubic((dr - 0.2) / 0.7);

  return (
    <AbsoluteFill style={{ background: "#1a110b", fontFamily: typewriter }}>
      <Audio src={staticFile("nrvar-soundtrack.wav")} />

      <AbsoluteFill style={{ opacity: fadeIn }}>
        {HAS_BG ? (
          <Loop durationInFrames={Math.max(1, Math.round(BG_SECONDS * fps))}>
            <OffthreadVideo src={staticFile("nrvar-bg.mp4")} muted style={{ width: 1080, height: 1920, objectFit: "cover", filter: "brightness(0.8) saturate(1.05)" }} />
          </Loop>
        ) : (
          <AbsoluteFill style={{ background: "linear-gradient(180deg, #2a1a10 0%, #4a2e1a 55%, #2a1a10 100%)" }} />
        )}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 70% at 50% 55%, rgba(0,0,0,0) 40%, rgba(10,5,2,0.7) 100%)" }} />
      </AbsoluteFill>

      {/* ust yazi */}
      <div style={{ position: "absolute", left: 0, top: 110, width: 1080, textAlign: "center", color: PAPER, opacity: fadeIn }}>
        <div style={{ fontSize: 40, letterSpacing: 12, opacity: 0.85 }}>YENİ ÇIKTI</div>
        <div style={{ fontSize: 30, letterSpacing: 6, opacity: 0.6, marginTop: 24 }}>{data.dateText}</div>
      </div>

      {/* kapak karti (kaset kapagi) */}
      {playing ? (
        <div
          style={{
            position: "absolute",
            left: 220,
            top: 320 + (1 - cardIn) * 220,
            width: 640,
            height: 640,
            rotate: "-2.5deg",
            opacity: clamp((dr - 0.2) / 0.2) * (1 - outroT),
            background: PAPER,
            padding: 22,
            boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
            scale: 1 + bass * 0.02,
          }}
        >
          <Img src={staticFile("nrvar-cover.jpg")} style={{ width: 596, height: 596, objectFit: "cover" }} />
        </div>
      ) : null}

      {/* kaset */}
      <div
        style={{
          position: "absolute",
          left: 90,
          top: playing ? 1000 + (1 - cardIn) * -120 : 800 + dropY,
          width: 900,
          height: 580,
          translate: `${settle}px 0px`,
          rotate: playing ? "0deg" : "-3deg",
          opacity: 1 - outroT,
        }}
      >
        <div style={{ position: "absolute", inset: 0, borderRadius: 30, background: "linear-gradient(160deg, #3a3a3e 0%, #232326 100%)", boxShadow: "0 40px 90px rgba(0,0,0,0.65), inset 0 0 0 4px #4a4a50" }} />
        {/* etiket */}
        <div style={{ position: "absolute", left: 60, top: 28, width: 780, height: 200, borderRadius: 22, background: PAPER, boxShadow: "inset 0 0 0 4px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 780, height: 54, background: `hsl(${HUE}, 70%, 55%)` }} />
          <div style={{ position: "absolute", left: 30, top: 6, fontFamily: typewriter, fontSize: 32, color: "#fff", letterSpacing: 6 }}>A · 90 DK</div>
          <div style={{ position: "absolute", right: 30, top: 6, fontFamily: typewriter, fontSize: 30, color: "#fff", letterSpacing: 4 }}>STEREO</div>
          <div style={{ position: "absolute", left: 40, top: 70, width: 700, fontFamily: hand, fontWeight: 700, fontSize: playing ? Math.min(labelSize, 76) : 76, color: INK, lineHeight: 1.05, whiteSpace: "nowrap" }}>
            {playing ? label2 : label1}
            {Math.floor(t * 3) % 2 === 0 ? <span style={{ display: "inline-block", width: 6, height: "0.85em", background: INK, marginLeft: 6, verticalAlign: "-0.08em" }} /> : null}
          </div>
          <div style={{ position: "absolute", left: 40, top: 160, width: 700, height: 4, background: "rgba(29,42,92,0.35)" }} />
        </div>
        {/* bant penceresi */}
        <div style={{ position: "absolute", left: 190, top: 248, width: 520, height: 130, borderRadius: 65, background: "#0f0f10", boxShadow: "inset 0 0 0 4px #5a5a60" }} />
        <Reel x={290} y={313} angle={leftAngle} r={54} />
        <Reel x={610} y={313} angle={rightAngle} r={54} />
        {/* alt govde */}
        <div style={{ position: "absolute", left: 160, top: 400, width: 580, height: 150, background: "#2c2c30", clipPath: "polygon(8% 0, 92% 0, 100% 100%, 0 100%)", boxShadow: "inset 0 0 0 3px #4a4a50" }} />
        {[250, 330, 570, 650].map((x) => (
          <div key={x} style={{ position: "absolute", left: x, top: 470, width: 26, height: 26, borderRadius: "50%", background: "#111" }} />
        ))}
      </div>

      {/* deck: PLAY tusu + VU ibreleri */}
      <div style={{ position: "absolute", left: 90, top: 1620, width: 900, height: 200, opacity: fadeIn * (1 - outroT) }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 900, height: 200, borderRadius: 24, background: "linear-gradient(180deg, #8c8c92 0%, #5a5a60 100%)", boxShadow: "0 24px 60px rgba(0,0,0,0.6), inset 0 0 0 3px #a8a8ae" }} />
        {["VU L", "VU R"].map((lbl, i) => {
          const angle = i === 0 ? needleL : needleR;
          const cx = 190 + i * 250;
          return (
            <div key={lbl}>
              <div style={{ position: "absolute", left: cx - 100, top: 24, width: 200, height: 130, borderRadius: 14, background: "#f4e8b8", boxShadow: "inset 0 0 0 4px #333", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 99, top: 108, width: 4, height: 96, background: "#b3261e", transformOrigin: "2px 96px", rotate: `${playing ? angle : -50}deg`, borderRadius: 2, translate: "0px -96px" }} />
                <div style={{ position: "absolute", left: 0, top: 8, width: 200, textAlign: "center", fontFamily: typewriter, fontSize: 22, color: "#333" }}>{lbl}</div>
              </div>
            </div>
          );
        })}
        {/* tuslar */}
        {(["rew", "play", "stop"] as const).map((g, i) => {
          const isPlay = i === 1;
          const down = isPlay && pressed;
          return (
            <div
              key={g}
              style={{
                position: "absolute",
                left: 560 + i * 110,
                top: 50 + (down ? 10 : 0),
                width: 96,
                height: 110,
                borderRadius: 10,
                background: down ? "#b9b9bf" : "#d8d8de",
                boxShadow: down ? "inset 0 4px 10px rgba(0,0,0,0.35)" : "0 8px 0 #34343a, 0 12px 18px rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill={down ? "#b3261e" : "#222"}>
                {g === "rew" ? <path d="M11 6v12L2 12zM21 6v12l-9-6z" /> : g === "play" ? <path d="M7 4v16l13-8z" /> : <path d="M6 6h12v12H6z" />}
              </svg>
            </div>
          );
        })}
      </div>

      {/* alt not */}
      <div style={{ position: "absolute", left: 0, top: 1860, width: 1080, textAlign: "center", color: PAPER, fontSize: 28, letterSpacing: 6, opacity: clamp((dr - 0.9) / 0.5) * (1 - outroT) }}>
        ŞİMDİ SPOTIFY&apos;DA
      </div>

      {/* kapanis */}
      {outroT > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 900, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut), textShadow: "0 4px 26px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)" }}>
          <div style={{ color: PAPER, fontSize: 60, letterSpacing: 8 }}>@YENISARKILARIM</div>
          <div style={{ color: "rgba(241,230,200,0.7)", fontSize: 34, letterSpacing: 5, marginTop: 22 }}>yeni çıkanlar ilk burada</div>
        </div>
      ) : null}

      <AbsoluteFill style={{ background: "#000", opacity: 0.5 * outroT, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
