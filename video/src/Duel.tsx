import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-duel.json";

const { fontFamily } = loadOswald("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});
const { fontFamily: mono } = loadMono("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});

type SideT = { artist: string; title: string; rank: number; streams: number };

const BANDS = data.bands as number[][];
const A = data.a as SideT;
const B = data.b as SideT;
const T_A = data.tA;
const T_B = data.tB;
const T_COUNT = data.tCount;
const T_REVEAL = data.tReveal;
const T_WIN = data.tWin;
const DUR = data.durationSeconds;
const WINNER: "a" | "b" = data.winner === "b" ? "b" : "a";
const GOLD = "#ffd24d";
const W = 1080;

const PANEL_X = 60;
const PANEL_W = 960;
const PANEL_H = 520;
const PANEL_A_Y = 350;
const PANEL_B_Y = 1000;
const VS_Y = (PANEL_A_Y + PANEL_H + PANEL_B_Y) / 2;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
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

const dots = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(/\.?0+$/, "")}M` : `${Math.round(n / 1e3)}K`);

// [start, end) araliginda 1, kenarlarda yumusak gecis
const act = (t: number, start: number, end: number, soft = 0.25) =>
  clamp((t - start) / soft) * clamp((end - t) / soft);

// ---------------------------------------------------------------- sanatci paneli
const Panel: React.FC<{
  side: "a" | "b";
  info: SideT;
  hue: number;
  y: number;
  t: number;
  bands: number[];
}> = ({ side, info, hue, y, t, bands }) => {
  const isA = side === "a";
  const enter = easeOutCubic((t - (isA ? 0.1 : 0.4)) / 0.65);
  const mine = isA ? act(t, T_A, T_B) : act(t, T_B, T_COUNT);
  const counting = t >= T_COUNT && t < T_WIN ? 0.3 : 0;
  const h = clamp(0.4 + 0.6 * mine + counting);
  const accent = `hsl(${hue}, 90%, 62%)`;
  const revealed = t >= T_REVEAL;
  const isWinner = WINNER === side;
  const settled = t >= T_WIN;
  const pulse = 0.5 + 0.5 * Math.sin(t * 9);

  const count = easeOutCubic((t - T_REVEAL) / 1.6);
  const value = revealed ? info.streams * count : 0;

  const lose = settled && !isWinner;
  const win = settled && isWinner;
  const winPop = win ? 1 + 0.035 * easeOutBack((t - T_WIN) / 0.4) : 1;

  const titleSize = info.title.length <= 12 ? 66 : info.title.length <= 20 ? 56 : 46;
  const artistSize = info.artist.length <= 16 ? 40 : 32;

  return (
    <div
      style={{
        position: "absolute",
        left: PANEL_X,
        top: y,
        width: PANEL_W,
        height: PANEL_H,
        boxSizing: "border-box",
        borderRadius: 40,
        padding: 40,
        display: "flex",
        gap: 36,
        alignItems: "center",
        translate: `${(1 - enter) * (isA ? -1300 : 1300)}px 0px`,
        scale: (1 + 0.018 * h) * winPop,
        opacity: lose ? 0.42 : 0.55 + 0.45 * h,
        filter: lose ? "grayscale(0.7)" : "none",
        background: `linear-gradient(135deg, hsla(${hue},70%,26%,0.96), hsla(${hue},55%,10%,0.96))`,
        border: win ? `4px solid ${GOLD}` : `3px solid hsla(${hue},90%,62%,${0.2 + 0.6 * h})`,
        boxShadow: win
          ? `0 0 ${50 + pulse * 40}px rgba(255,210,77,${0.5 + pulse * 0.3}), 0 20px 50px rgba(0,0,0,0.55)`
          : `0 0 ${46 * h}px hsla(${hue},90%,58%,${0.55 * h}), 0 16px 40px rgba(0,0,0,0.5)`,
        zIndex: win ? 5 : 1,
      }}
    >
      {/* kapak + harf rozeti */}
      <div style={{ position: "relative", width: 440, height: 440, flexShrink: 0 }}>
        <Img
          src={staticFile(`duel-cover-${side}.jpg`)}
          style={{ width: 440, height: 440, borderRadius: 26, objectFit: "cover", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}
        />
        <div
          style={{
            position: "absolute",
            left: -22,
            top: -22,
            width: 104,
            height: 104,
            borderRadius: "50%",
            background: accent,
            color: "#10101a",
            fontFamily,
            fontWeight: 700,
            fontSize: 74,
            lineHeight: "104px",
            textAlign: "center",
            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
          }}
        >
          {isA ? "A" : "B"}
        </div>
      </div>

      {/* metin */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: titleSize,
            lineHeight: 1.04,
            color: "#fff",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {info.title}
        </div>
        <div
          style={{
            fontFamily,
            fontWeight: 500,
            fontSize: artistSize,
            color: "rgba(255,255,255,0.8)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {info.artist}
        </div>

        {/* dinleniyor cubuklari */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 44, marginTop: 6, opacity: mine }}>
          {[1, 3, 5, 8, 11, 14, 17].map((b, i) => (
            <div
              key={i}
              style={{ width: 9, height: 8 + (bands[b] ?? 0) * 36, borderRadius: 4, background: accent }}
            />
          ))}
        </div>

        <div style={{ marginTop: 6 }}>
          <div style={{ fontFamily, fontWeight: 500, fontSize: 26, letterSpacing: 3, color: "rgba(255,255,255,0.6)" }}>
            GÜNLÜK STREAM
          </div>
          <div
            style={{
              fontFamily: mono,
              fontWeight: 700,
              fontSize: revealed ? 50 : 62,
              color: win ? GOLD : "#fff",
              letterSpacing: revealed ? 0 : 6,
            }}
          >
            {revealed ? dots(value) : "???"}
          </div>
        </div>
      </div>

      {/* kazanan rozeti + sira */}
      {settled ? (
        <div
          style={{
            position: "absolute",
            right: 28,
            top: -26,
            display: "flex",
            gap: 10,
            scale: easeOutBack((t - T_WIN - 0.1) / 0.35),
          }}
        >
          {win ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 24px 8px 16px",
                borderRadius: 40,
                background: GOLD,
                color: "#1a1400",
                fontFamily,
                fontWeight: 700,
                fontSize: 36,
                letterSpacing: 2,
              }}
            >
              <svg width="40" height="32" viewBox="0 0 40 32">
                <polygon points="2,28 6,8 14,18 20,4 26,18 34,8 38,28" fill="#1a1400" />
              </svg>
              KAZANAN
            </div>
          ) : null}
          <div
            style={{
              padding: "8px 22px",
              borderRadius: 40,
              background: "rgba(0,0,0,0.75)",
              border: "2px solid rgba(255,255,255,0.35)",
              color: "#fff",
              fontFamily,
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: 1,
            }}
          >
            TÜRKİYE #{info.rank}
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- konfeti (kazanan aninda)
const Confetti: React.FC<{ t: number }> = ({ t }) => {
  const u = t - T_WIN;
  if (u < 0 || u > 2.2) return null;
  const cy = (WINNER === "a" ? PANEL_A_Y : PANEL_B_Y) + PANEL_H / 2;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 10 }}>
      {Array.from({ length: 46 }).map((_, i) => {
        const ang = rnd(i, 1) * Math.PI * 2;
        const sp = 380 + rnd(i, 2) * 620;
        const x = W / 2 + Math.cos(ang) * sp * u * 0.9;
        const y = cy + Math.sin(ang) * sp * u * 0.7 + 700 * u * u;
        const size = 12 + rnd(i, 3) * 16;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size * 0.55,
              background: i % 3 === 0 ? "#fff" : i % 3 === 1 ? GOLD : "#ff8a3d",
              opacity: clamp(1.9 - u),
              rotate: `${rnd(i, 4) * 360 + u * (200 + rnd(i, 5) * 400)}deg`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- ana sahne
export const Duel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeOut = clamp((t - (DUR - 0.45)) / 0.45);
  const winnerInfo = WINNER === "a" ? A : B;

  // ust baslik: faza gore degisir, faz basinda "pop"
  const phase = t >= T_WIN ? 2 : t >= T_COUNT ? 1 : 0;
  const phaseStart = [0, T_COUNT, T_WIN][phase];
  const pop = easeOutBack((t - phaseStart) / 0.4);
  const head =
    phase === 0
      ? { l1: "HANGİSİ", l2: "DAHA ÇOK DİNLENDİ?" }
      : phase === 1
        ? { l1: "SENCE", l2: "HANGİSİ?" }
        : { l1: "BUGÜNÜN KAZANANI", l2: winnerInfo.title.toUpperCase() };

  const l2Size = phase === 2 ? (head.l2.length > 16 ? 58 : 76) : 78;

  // gerisayim
  const inCount = t >= T_COUNT && t < T_REVEAL;
  const countN = Math.max(1, 3 - Math.floor(t - T_COUNT));
  const countFrac = (t - T_COUNT) % 1;
  const countScale = 1.35 - 0.35 * easeOutCubic(countFrac / 0.3);

  const vsVisible = clamp((t - 0.7) / 0.3) * (1 - clamp((t - T_REVEAL) / 0.25));
  const diff = Math.abs(A.streams - B.streams);
  const deltaIn = easeOutBack((t - T_WIN - 0.15) / 0.4);
  const endIn = easeOutCubic((t - (T_WIN + 0.9)) / 0.5);

  return (
    <AbsoluteFill style={{ background: "#08080d", fontFamily }}>
      <Audio src={staticFile("duel-soundtrack.wav")} />

      {/* arka plan isiklari */}
      <AbsoluteFill
        style={{
          background:
            `radial-gradient(circle at 12% 22%, hsla(${data.hueA},85%,40%,${0.34 + bass * 0.2}) 0%, rgba(0,0,0,0) 46%),` +
            `radial-gradient(circle at 90% 80%, hsla(${data.hueB},85%,40%,${0.34 + bass * 0.2}) 0%, rgba(0,0,0,0) 46%)`,
        }}
      />

      {/* baslik */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 64,
          textAlign: "center",
          scale: 0.9 + 0.1 * pop,
          opacity: clamp(t / 0.25) * clamp(pop * 2),
        }}
      >
        <div style={{ fontWeight: 500, fontSize: 52, letterSpacing: 8, color: "rgba(255,255,255,0.82)" }}>{head.l1}</div>
        <div
          style={{
            fontWeight: 700,
            fontSize: l2Size,
            lineHeight: 1.05,
            color: phase === 2 ? GOLD : "#fff",
            padding: "0 40px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {head.l2}
        </div>
        <div
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "6px 24px",
            borderRadius: 30,
            background: "rgba(255,255,255,0.12)",
            fontFamily: mono,
            fontWeight: 500,
            fontSize: 26,
            letterSpacing: 2,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          {`TÜRKİYE GÜNLÜK LİSTE · ${data.dateShort}`}
        </div>
      </div>

      <Panel side="a" info={A} hue={data.hueA} y={PANEL_A_Y} t={t} bands={bands} />
      <Panel side="b" info={B} hue={data.hueB} y={PANEL_B_Y} t={t} bands={bands} />

      {/* VS */}
      <div
        style={{
          position: "absolute",
          left: W / 2 - 80,
          top: VS_Y - 80,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: "#fff",
          color: "#0b0b10",
          fontWeight: 700,
          fontSize: 78,
          lineHeight: "160px",
          textAlign: "center",
          opacity: vsVisible,
          scale: (0.6 + 0.4 * vsVisible) * (1 + bass * 0.12),
          boxShadow: "0 0 40px rgba(255,255,255,0.45)",
          zIndex: 6,
        }}
      >
        VS
      </div>

      {/* fark */}
      {t >= T_WIN + 0.15 ? (
        <div
          style={{
            position: "absolute",
            left: W / 2 - 230,
            top: VS_Y - 52,
            width: 460,
            height: 104,
            borderRadius: 52,
            background: "#0b0b10",
            border: `3px solid ${GOLD}`,
            color: GOLD,
            fontWeight: 700,
            fontSize: 56,
            lineHeight: "98px",
            textAlign: "center",
            letterSpacing: 2,
            scale: deltaIn,
            zIndex: 7,
          }}
        >
          {`+${short(diff)} FARK`}
        </div>
      ) : null}

      <Confetti t={t} />

      {/* alt bolge */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1580, height: 300, textAlign: "center" }}>
        {t < T_COUNT ? (
          <div style={{ marginTop: 70, fontWeight: 500, fontSize: 44, letterSpacing: 6, color: "rgba(255,255,255,0.7)" }}>
            DİNLE · TAHMİN ET
          </div>
        ) : null}
        {inCount ? (
          <>
            <div
              style={{
                display: "inline-block",
                width: 190,
                height: 190,
                borderRadius: "50%",
                border: `8px solid ${GOLD}`,
                color: "#fff",
                fontWeight: 700,
                fontSize: 130,
                lineHeight: "176px",
                scale: countScale,
              }}
            >
              {countN}
            </div>
            <div style={{ marginTop: 24, fontWeight: 500, fontSize: 40, letterSpacing: 3, color: "rgba(255,255,255,0.85)" }}>
              A MI, B Mİ?
            </div>
          </>
        ) : null}
        {t >= T_REVEAL && t < T_WIN + 0.9 ? (
          <div
            style={{
              marginTop: 80,
              fontWeight: 700,
              fontSize: 60,
              letterSpacing: 6,
              color: GOLD,
              opacity: 0.55 + 0.45 * Math.abs(Math.sin(t * 8)),
            }}
          >
            SONUÇ GELİYOR
          </div>
        ) : null}
        {t >= T_WIN + 0.9 ? (
          <div style={{ opacity: endIn, translate: `0px ${(1 - endIn) * 40}px` }}>
            <div style={{ fontWeight: 500, fontSize: 48, letterSpacing: 4, color: "rgba(255,255,255,0.88)" }}>
              SEN HANGİSİNİ SEÇTİN?
            </div>
            <div style={{ fontWeight: 700, fontSize: 124, lineHeight: 1.02, color: GOLD, letterSpacing: 10 }}>A / B</div>
            <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 28, letterSpacing: 3, color: "rgba(255,255,255,0.6)" }}>
              @YENISARKILARIM
            </div>
          </div>
        ) : null}
      </div>

      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
