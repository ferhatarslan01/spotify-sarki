import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-new.json";

const { fontFamily } = loadOswald("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});
const { fontFamily: mono } = loadMono("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});

const FPS = 30;
const BANDS = data.bands as number[][];
const HUE = data.hue;
const ARTIST = data.artist.toLocaleUpperCase("tr");
const TITLE = data.title;
const TITLE_UP = data.title.toLocaleUpperCase("tr");
const OPT = data as typeof data & {
  loadingLabel?: string;
  radarLabel?: string;
  pill?: string;
  cta?: string;
};
const LOADING_LABEL =
  OPT.loadingLabel ?? (/kahve/i.test(data.title) ? "YENİ ŞARKI DEMLENİYOR" : "YENİ ŞARKI YÜKLENİYOR");
const RADAR_LABEL = OPT.radarLabel ?? "TÜRKİYE · YENİ ÇIKANLAR RADARI";
const PILL_TEXT = OPT.pill ?? `YENİ ŞARKI · ${data.dateText}`;
const CTA_TEXT = OPT.cta ?? "ŞİMDİ SPOTIFY'DA";

const LOAD_END = data.loadEnd;
const DROP = data.drop;
const OUTRO = data.outro;

const ACCENT = `hsl(${HUE}, 95%, 62%)`;
const ACCENT_SOFT = `hsl(${HUE}, 90%, 72%)`;

const clampOpt = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

const hash = (a: number, b = 0, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;

const easeOutBack = (x: number) => {
  x = clamp(x);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;

// kalp atisi zamanlari (ses efektiyle ayni formul)
const KICKS: number[] = (() => {
  const out: number[] = [];
  let t = 0.35;
  let gap = 0.62;
  while (t < LOAD_END - 0.05) {
    out.push(t);
    t += gap;
    gap = Math.max(0.11, gap * 0.82);
  }
  return out;
})();

// ---------------------------------------------------------------- Faz A: yukleniyor
const GRID = 6;
const COVER = 800;
const TILE = COVER / GRID;
const COVER_LEFT = (1080 - COVER) / 2;
const COVER_TOP = 250;

const Tiles: React.FC<{ progress: number; shatter: number }> = ({ progress, shatter }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const blur = (1 - progress) ** 2 * 38;
  const bright = 0.3 + 0.7 * progress;
  return (
    <div
      style={{
        position: "absolute",
        left: COVER_LEFT,
        top: COVER_TOP,
        width: COVER,
        height: COVER,
        filter: `blur(${blur}px) brightness(${bright})`,
      }}
    >
      {Array.from({ length: GRID * GRID }).map((_, i) => {
        const col = i % GRID;
        const row = Math.floor(i / GRID);
        const arrive = 0.3 + 3.0 * rnd(i, 1);
        const p = easeOutCubic((t - (arrive - 0.95)) / 0.95);
        const ang = rnd(i, 2) * Math.PI * 2;
        const dist = 700 + rnd(i, 3) * 800;
        const sx = Math.cos(ang) * dist;
        const sy = Math.sin(ang) * dist;
        const rot0 = (rnd(i, 4) - 0.5) * 420;
        // cikis: parcalanip dagilma
        const s = shatter;
        const ox = Math.cos(ang) * 1500 * s * (0.5 + rnd(i, 5));
        const oy = Math.sin(ang) * 1500 * s * (0.5 + rnd(i, 5)) + 500 * s * s;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: col * TILE,
              top: row * TILE,
              width: TILE + 1,
              height: TILE + 1,
              backgroundImage: `url(${staticFile("new-cover.jpg")})`,
              backgroundSize: `${COVER}px ${COVER}px`,
              backgroundPosition: `-${col * TILE}px -${row * TILE}px`,
              opacity: clamp(p * 3) * (1 - clamp(s * 1.4)),
              translate: `${sx * (1 - p) + ox}px ${sy * (1 - p) + oy}px`,
              rotate: `${rot0 * (1 - p) + (rnd(i, 6) - 0.5) * 720 * s}deg`,
              scale: 0.3 + 0.7 * p,
              boxShadow: p > 0.98 ? "none" : "0 0 18px rgba(0,0,0,0.6)",
            }}
          />
        );
      })}
    </div>
  );
};

const GlitchText: React.FC<{ children: React.ReactNode; amp: number; seed: number; style: React.CSSProperties }> = ({
  children,
  amp,
  seed,
  style,
}) => {
  const frame = useCurrentFrame();
  const spike = hash(frame, seed) % 17 === 0 ? 1 : 0;
  const g = amp * (rnd(frame, seed) * 6 + spike * 26);
  const common: React.CSSProperties = { position: "absolute", inset: 0, ...style };
  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{ ...common, color: "#ff2f5b", translate: `${-g}px 0px`, mixBlendMode: "screen", opacity: 0.85 }}>
        {children}
      </div>
      <div style={{ ...common, color: "#22d3ee", translate: `${g}px 0px`, mixBlendMode: "screen", opacity: 0.85 }}>
        {children}
      </div>
      <div style={{ position: "relative", color: "#fff" }}>{children}</div>
    </div>
  );
};

const SCRAMBLE = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789#%&@*+=?";

const Loading: React.FC<{ percent: number }> = ({ percent }) => {
  const frame = useCurrentFrame();
  const u = percent / 100;
  const scr = Array.from({ length: ARTIST.length })
    .map((_, i) => (ARTIST[i] === " " ? " " : SCRAMBLE[hash(Math.floor(frame / 2), i) % SCRAMBLE.length]))
    .join("");
  const cursor = Math.floor(frame / 8) % 2 === 0 ? "█" : " ";
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          width: 1080,
          textAlign: "center",
          fontFamily: mono,
          fontWeight: 500,
          fontSize: 34,
          letterSpacing: 4,
          color: ACCENT_SOFT,
          opacity: 0.85,
        }}
      >
        {`// ${RADAR_LABEL}`}
      </div>

      <div style={{ position: "absolute", top: 1085, left: 0, width: 1080, display: "flex", justifyContent: "center" }}>
        <GlitchText
          amp={0.4 + u * 1.4}
          seed={3}
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 300,
            lineHeight: 1,
            letterSpacing: 4,
            width: 780,
            textAlign: "center",
          }}
        >
          {`${Math.floor(percent)}%`}
        </GlitchText>
      </div>

      <div
        style={{
          position: "absolute",
          left: 90,
          top: 1478,
          width: 900,
          height: 30,
          border: "3px solid rgba(255,255,255,0.55)",
          borderRadius: 6,
          padding: 4,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: 2,
            background: `repeating-linear-gradient(90deg, ${ACCENT} 0px, ${ACCENT} 22px, rgba(0,0,0,0) 22px, rgba(0,0,0,0) 28px)`,
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: 1546,
          left: 0,
          width: 1080,
          textAlign: "center",
          fontFamily: mono,
          fontWeight: 700,
          fontSize: 40,
          letterSpacing: 3,
          color: "#fff",
        }}
      >
        {`> ${LOADING_LABEL}${cursor}`}
      </div>
      <div
        style={{
          position: "absolute",
          top: 1620,
          left: 0,
          width: 1080,
          textAlign: "center",
          fontFamily: mono,
          fontWeight: 500,
          fontSize: 34,
          letterSpacing: 3,
          color: "rgba(255,255,255,0.6)",
          whiteSpace: "pre",
        }}
      >
        {`SANATÇI ▸ ${scr}`}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Faz C: drop sonrasi
const Marquee: React.FC<{ bass: number }> = ({ bass }) => {
  const frame = useCurrentFrame();
  const unit = `${TITLE_UP}  ·  `;
  const text = unit.repeat(40);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: 8 }).map((_, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        const speed = 5 + (i % 3) * 3;
        const x = dir * frame * speed - (dir > 0 ? 6500 : 0);
        const filled = i % 3 === 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 40 + i * 245,
              left: 0,
              whiteSpace: "nowrap",
              translate: `${x}px 0px`,
              fontFamily,
              fontWeight: 700,
              fontSize: 210,
              lineHeight: 1,
              color: filled ? `hsla(${HUE}, 90%, 60%, ${0.07 + bass * 0.05})` : "transparent",
              WebkitTextStroke: `2px hsla(${HUE}, 90%, 72%, ${0.16 + bass * 0.1})`,
            }}
          >
            {text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Ring: React.FC<{ bands: number[]; cx: number; cy: number; r: number; scale: number }> = ({
  bands,
  cx,
  cy,
  r,
  scale,
}) => {
  const frame = useCurrentFrame();
  const n = 56;
  const spin = frame * 0.18;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      {Array.from({ length: n }).map((_, i) => {
        const k = i < n / 2 ? i : n - 1 - i;
        const v = bands[Math.floor((k / (n / 2)) * 24)] ?? 0;
        const a = ((i / n) * 360 + spin) * (Math.PI / 180);
        const r0 = r * scale;
        const r1 = r0 + 16 + v * 150;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * r0}
            y1={cy + Math.sin(a) * r0}
            x2={cx + Math.cos(a) * r1}
            y2={cy + Math.sin(a) * r1}
            stroke={ACCENT}
            strokeWidth={12}
            strokeLinecap="round"
            opacity={0.45 + v * 0.55}
          />
        );
      })}
    </svg>
  );
};

const Shockwaves: React.FC<{ start: number; cx: number; cy: number }> = ({ start, cx, cy }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS - start;
  return (
    <AbsoluteFill>
      {[0, 0.14, 0.28].map((d, i) => {
        const p = clamp((t - d) / 1.1);
        if (t < d || p >= 1) return null;
        const size = 160 + easeOutCubic(p) * 2400;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx - size / 2,
              top: cy - size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              border: `${10 - i * 2}px solid ${ACCENT}`,
              opacity: (1 - p) * 0.9,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Sparkles: React.FC<{ start: number; x: number; y: number }> = ({ start, x, y }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS - start;
  if (t < 0 || t > 2.6) return null;
  return (
    <AbsoluteFill>
      {Array.from({ length: 80 }).map((_, i) => {
        const ang = rnd(i, 5) * Math.PI * 2;
        const sp = 260 + rnd(i, 6) * 1000;
        const drag = (1 - Math.exp(-1.7 * t)) / 1.7;
        const px = x + Math.cos(ang) * sp * drag;
        const py = y + Math.sin(ang) * sp * drag - 260 * drag + 0.5 * 1300 * t * t;
        const size = 8 + rnd(i, 7) * 14;
        const col = [ACCENT, "#fff4d6", ACCENT_SOFT, "#ffffff"][i % 4];
        const op = 1 - clamp((t - 1.4) / 1.2);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: size,
              height: size * 0.55,
              background: col,
              opacity: op,
              rotate: `${rnd(i, 8) * 360 + t * 540}deg`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Kinetic: React.FC<{
  text: string;
  start: number;
  size: number;
  weight?: 500 | 700;
  color: string;
  stagger?: number;
}> = ({ text, start, size, weight = 700, color, stagger = 1.6 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        fontFamily,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1,
        color,
        whiteSpace: "pre",
      }}
    >
      {text.split("").map((ch, i) => {
        const f = frame - (start * FPS + i * stagger);
        const p = easeOutBack(f / 9);
        const o = clamp(f / 4);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: o,
              translate: `0px ${(1 - clamp(f / 9)) * 70}px`,
              scale: Math.max(p, 0.001),
              textShadow: "0 6px 30px rgba(0,0,0,0.55)",
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---------------------------------------------------------------- ana sahne
export const NewRelease: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = (bands[0] + bands[1] + bands[2] + bands[3]) / 4 || 0;

  const percent = interpolate(
    t,
    [0.3, 1.0, 1.45, 2.3, 2.6, 3.35, 3.5],
    [0, 23, 24, 71, 72, 99, 100],
    { ...clampOpt, easing: Easing.bezier(0.4, 0, 0.6, 1) }
  );
  const u = percent / 100;

  const inLoad = t < LOAD_END;
  const inGap = t >= LOAD_END && t < DROP;
  const afterDrop = t >= DROP;
  const dt = t - DROP;

  // kamera sarsintisi: yuklenirken artar, dropta patlar
  let shakeX = 0;
  let shakeY = 0;
  if (inLoad) {
    const a = 1 + 12 * u ** 3;
    shakeX = (rnd(frame, 11) - 0.5) * a;
    shakeY = (rnd(frame, 12) - 0.5) * a;
  } else if (afterDrop && dt < 0.55) {
    const a = 26 * (1 - dt / 0.55);
    shakeX = Math.sin(dt * 120) * a;
    shakeY = Math.cos(dt * 97) * a * 0.7;
  }

  // kalp atisi kenar isigi
  const kickGlow = KICKS.reduce((m, k) => (t >= k ? Math.max(m, Math.exp(-(t - k) / 0.12)) : m), 0);

  const shatter = clamp((t - OUTRO) / 1.3);
  const fadeOut = clamp((t - (OUTRO + 0.9)) / 0.7);

  const coverCx = 540;
  const coverCy = 700;
  const coverSize = 720;
  const dropScale = afterDrop ? 1 + 0.38 * Math.exp(-7 * dt) * Math.cos(dt * 16) : 1;
  const pulse = 1 + bass * 0.035;
  const float = afterDrop ? Math.sin(dt * 1.7) * 10 : 0;
  const tilt = afterDrop ? Math.sin(dt * 1.1) * 4 : 0;

  const songT = Math.max(0, dt) + data.hookStart;

  return (
    <AbsoluteFill style={{ background: "#040404" }}>
      <Audio src={staticFile("new-soundtrack.wav")} />

      <AbsoluteFill style={{ translate: `${shakeX}px ${shakeY}px` }}>
        {/* ---------------- arka plan: yuklenirken siyah + izgara, dropta renkli ---------------- */}
        {afterDrop ? (
          <AbsoluteFill>
            <AbsoluteFill style={{ background: `hsl(${HUE}, 55%, 6%)` }} />
            <AbsoluteFill
              style={{
                background: `radial-gradient(ellipse 900px 800px at 50% 38%, hsla(${HUE}, 85%, ${24 + bass * 14}%, 0.95), hsla(${HUE}, 70%, 8%, 0) 72%)`,
              }}
            />
            <Marquee bass={bass} />
            <AbsoluteFill
              style={{
                background:
                  "radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.8) 100%)",
              }}
            />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill>
            <AbsoluteFill
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
                backgroundSize: "90px 90px",
              }}
            />
            <AbsoluteFill
              style={{
                background: `radial-gradient(ellipse 90% 80% at 50% 50%, rgba(0,0,0,0) 40%, hsla(${HUE}, 90%, 50%, ${kickGlow * 0.35}) 100%)`,
              }}
            />
          </AbsoluteFill>
        )}

        {/* ---------------- Faz A ---------------- */}
        {inLoad ? (
          <>
            <Tiles progress={u} shatter={0} />
            <Loading percent={percent} />
          </>
        ) : null}

        {/* ---------------- Faz C ---------------- */}
        {afterDrop ? (
          <>
            <Ring bands={bands} cx={coverCx} cy={coverCy + float} r={coverSize / 2 + 40} scale={shatter > 0 ? 1 + shatter * 1.5 : dropScale} />
            <Shockwaves start={DROP} cx={coverCx} cy={coverCy} />

            {shatter === 0 ? (
              <>
                {dt < 0.5 ? (
                  <>
                    <Img
                      src={staticFile("new-cover.jpg")}
                      style={{
                        position: "absolute",
                        left: coverCx - coverSize / 2 - 26 * Math.exp(-9 * dt),
                        top: coverCy - coverSize / 2 + float,
                        width: coverSize,
                        height: coverSize,
                        borderRadius: 48,
                        objectFit: "cover",
                        mixBlendMode: "screen",
                        opacity: 0.7,
                        filter: "sepia(1) saturate(8) hue-rotate(-50deg)",
                        scale: dropScale,
                      }}
                    />
                    <Img
                      src={staticFile("new-cover.jpg")}
                      style={{
                        position: "absolute",
                        left: coverCx - coverSize / 2 + 26 * Math.exp(-9 * dt),
                        top: coverCy - coverSize / 2 + float,
                        width: coverSize,
                        height: coverSize,
                        borderRadius: 48,
                        objectFit: "cover",
                        mixBlendMode: "screen",
                        opacity: 0.7,
                        filter: "sepia(1) saturate(8) hue-rotate(150deg)",
                        scale: dropScale,
                      }}
                    />
                  </>
                ) : null}
                <Img
                  src={staticFile("new-cover.jpg")}
                  style={{
                    position: "absolute",
                    left: coverCx - coverSize / 2,
                    top: coverCy - coverSize / 2 + float,
                    width: coverSize,
                    height: coverSize,
                    borderRadius: 48,
                    objectFit: "cover",
                    scale: dropScale * pulse,
                    rotate: `${tilt}deg`,
                    boxShadow: `0 40px 90px rgba(0,0,0,0.65), 0 0 ${60 + bass * 90}px hsla(${HUE}, 95%, 55%, ${0.35 + bass * 0.35})`,
                  }}
                />
              </>
            ) : (
              <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920 }}>
                <div style={{ position: "absolute", left: 0, top: 50, scale: 0.9, transformOrigin: "540px 650px" }}>
                  <Tiles progress={1} shatter={shatter} />
                </div>
              </div>
            )}

            {/* ust etiket */}
            <div
              style={{
                position: "absolute",
                top: 130,
                left: 0,
                width: 1080,
                display: "flex",
                justifyContent: "center",
                translate: `0px ${(1 - easeOutCubic((dt - 0.1) / 0.5)) * -120}px`,
                opacity: (1 - fadeOut) * (1 - shatter * 0.6),
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 34px",
                  borderRadius: 60,
                  background: "rgba(0,0,0,0.55)",
                  border: `2px solid ${ACCENT}`,
                  fontFamily,
                  fontWeight: 500,
                  fontSize: 40,
                  letterSpacing: 5,
                  color: "#fff",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#ff3b5c",
                    opacity: 0.5 + 0.5 * Math.abs(Math.sin(frame / 7)),
                  }}
                />
                {PILL_TEXT}
              </div>
            </div>

            {/* sanatci + sarki */}
            <div
              style={{
                position: "absolute",
                top: 1138,
                left: 0,
                width: 1080,
                opacity: (1 - fadeOut) * (1 - shatter * 0.5),
              }}
            >
              <Kinetic
                text={ARTIST}
                start={DROP + 0.25}
                size={Math.min(200, 940 / (Math.max(ARTIST.length, 5) * 0.5))}
                color="#fff"
              />
            </div>
            <div
              style={{
                position: "absolute",
                top: 1316,
                left: 0,
                width: 1080,
                opacity: (1 - fadeOut) * (1 - shatter * 0.5),
              }}
            >
              <Kinetic
                text={TITLE}
                start={DROP + 0.6}
                size={Math.min(84, 940 / (Math.max(TITLE.length, 8) * 0.48))}
                weight={500}
                color={ACCENT_SOFT}
                stagger={1.1}
              />
            </div>

            {/* oynatici cubugu */}
            <div
              style={{
                position: "absolute",
                top: 1470,
                left: 90,
                width: 900,
                opacity: clamp((dt - 1.0) / 0.5) * (1 - fadeOut) * (1 - shatter),
              }}
            >
              <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.22)" }}>
                <div
                  style={{
                    width: `${clamp(songT / 30) * 100}%`,
                    height: "100%",
                    borderRadius: 4,
                    background: "#fff",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 14,
                  fontFamily: mono,
                  fontWeight: 500,
                  fontSize: 30,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                <span>{mmss(songT)}</span>
                <span>{mmss(30)}</span>
              </div>
            </div>

            {/* spotify cagrisi */}
            <div
              style={{
                position: "absolute",
                top: 1590,
                left: 0,
                width: 1080,
                display: "flex",
                justifyContent: "center",
                opacity: clamp((t - 9.2) / 0.5) * (1 - fadeOut) * (1 - shatter),
                scale: 1 + 0.025 * Math.sin(frame / 5),
              }}
            >
              <div
                style={{
                  padding: "18px 44px",
                  borderRadius: 60,
                  background: "#1DB954",
                  color: "#031208",
                  fontFamily,
                  fontWeight: 700,
                  fontSize: 46,
                  letterSpacing: 4,
                }}
              >
                {CTA_TEXT}
              </div>
            </div>

            <Sparkles start={DROP + 0.05} x={540} y={coverCy} />
          </>
        ) : null}
      </AbsoluteFill>

      {/* drop flasi ve siyah bosluk */}
      <AbsoluteFill
        style={{
          background: "#fff",
          opacity: afterDrop ? 0.95 * Math.exp(-11 * dt) : 0,
          pointerEvents: "none",
        }}
      />
      {inGap ? <AbsoluteFill style={{ background: "#000" }} /> : null}
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
      {/* tarama cizgileri */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 4px)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
