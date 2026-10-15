import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-rise.json";

const { fontFamily } = loadOswald("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});
const { fontFamily: mono } = loadMono("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});

type RowT = {
  rank: number;
  title: string;
  artist: string;
  streams: string;
  cover: string | null;
  featured: boolean;
};

const FPS = 30;
const ROWS = data.rows as RowT[];
const BANDS = data.bands as number[][];
const FROM = data.from;
const TO = data.to;
const CHANGE = data.change;
const START = data.start;
const CLIMB = data.climb;
const ARRIVAL = data.arrival;
const HUE = data.hue;
const GREEN = "#3ddc84";
const RED = "#ff5a5f";
const GOLD = "#ffd24d";
const ACCENT = `hsl(${HUE}, 90%, 62%)`;

const ROW_H = 120;
const ROW_GAP = 8;
const STRIDE = ROW_H + ROW_GAP;
const CENTER_Y = 1030; // yukselen kartin ekrandaki sabit merkezi
const CARD_X = 190;
const CARD_W = 790;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const hash = (a: number, b = 0, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeInOut = (x: number) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

// tirmanis ilerlemesi (ses efektleriyle ayni formul)
const progress = (t: number): number => easeInOut((t - START) / CLIMB);
const featuredPos = (t: number): number => FROM - CHANGE * progress(t);

// kartin sira pozisyonu (kayan nokta)
function slotOf(row: RowT, t: number): number {
  const pos = featuredPos(t);
  if (row.featured) return pos;
  if (row.rank > TO && row.rank <= FROM) {
    const yesterday = row.rank - 1;
    const q = clamp(yesterday + 1 - pos, 0, 1);
    return yesterday + easeInOut(q);
  }
  return row.rank;
}

const yOfSlot = (slot: number, pos: number) => CENTER_Y + (slot - pos) * STRIDE - ROW_H / 2;

// ---------------------------------------------------------------- liste karti
const Card: React.FC<{ row: RowT; t: number; frame: number; entrance: number }> = ({
  row,
  t,
  frame,
  entrance,
}) => {
  const pos = featuredPos(t);
  const slot = slotOf(row, t);
  const y = yOfSlot(slot, pos);
  if (y < -200 || y > 2100) return null;
  const featured = row.featured;
  const isOvertaken = !featured && row.rank > TO && row.rank <= FROM;
  const q = isOvertaken ? clamp(row.rank - pos, 0, 1) : 0;
  const moving = isOvertaken && q > 0.03 && q < 0.97;
  const fromLeft = hash(row.rank, 3) % 2 === 0;
  const ent = 1 - (1 - entrance) ** 3;
  const done = t >= ARRIVAL;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
  return (
    <div
      style={{
        position: "absolute",
        left: CARD_X,
        top: y,
        width: CARD_W,
        height: ROW_H,
        zIndex: featured ? 20 : 1,
        translate: `${(1 - ent) * (fromLeft ? -1200 : 1200)}px 0px`,
        scale: featured ? 1.04 + (done ? 0 : 0.015 * pulse) : 1,
        opacity: clamp(entrance * 3),
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "0 18px",
        boxSizing: "border-box",
        borderRadius: 22,
        background: featured
          ? `linear-gradient(90deg, hsla(${HUE},85%,30%,0.95), hsla(${HUE},70%,16%,0.95))`
          : "linear-gradient(90deg, rgba(34,34,40,0.92), rgba(20,20,24,0.92))",
        border: featured ? `3px solid ${GOLD}` : "1px solid rgba(255,255,255,0.08)",
        boxShadow: featured
          ? `0 0 ${34 + pulse * 26}px rgba(255,210,77,${0.35 + pulse * 0.25}), 0 12px 30px rgba(0,0,0,0.5)`
          : "0 8px 20px rgba(0,0,0,0.35)",
      }}
    >
      {row.cover ? (
        <Img src={staticFile(row.cover)} style={{ width: 88, height: 88, borderRadius: 14, objectFit: "cover" }} />
      ) : (
        <div style={{ width: 88, height: 88, borderRadius: 14, background: "#333" }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: 38,
            lineHeight: 1.05,
            color: "#fff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {row.title}
        </div>
        <div
          style={{
            fontFamily,
            fontWeight: 500,
            fontSize: 29,
            color: featured ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.58)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {row.artist}
        </div>
      </div>
      <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 30, color: featured ? GOLD : "rgba(255,255,255,0.6)" }}>
        {row.streams}
      </div>
      {moving ? (
        <div
          style={{
            position: "absolute",
            right: -62,
            top: ROW_H / 2 - 18,
            color: RED,
            fontFamily,
            fontWeight: 700,
            fontSize: 38,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="26" height="22" viewBox="0 0 26 22">
            <polygon points="1,2 25,2 13,20" fill={RED} />
          </svg>
          1
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- hiz cizgileri + arka plan
const Speed: React.FC<{ intensity: number }> = ({ intensity }) => {
  const frame = useCurrentFrame();
  if (intensity <= 0.01) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 34 }).map((_, i) => {
        const x = hash(i, 1) % 1080;
        const len = 160 + (hash(i, 2) % 420);
        const sp = 26 + (hash(i, 3) % 40);
        const y = ((frame * sp + (hash(i, 4) % 2400)) % (1920 + len * 2)) - len;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 3 + (i % 3),
              height: len,
              borderRadius: 3,
              background: `linear-gradient(180deg, rgba(255,255,255,0), hsla(${HUE},95%,75%,${0.5 * intensity}))`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Chevrons: React.FC<{ speed: number }> = ({ speed }) => {
  const frame = useCurrentFrame();
  const gap = 260;
  const off = (frame * speed) % gap;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <svg
          key={i}
          width="1080"
          height="120"
          viewBox="0 0 1080 120"
          style={{ position: "absolute", left: 0, top: -gap + i * gap + off }}
        >
          <polyline
            points="140,100 540,20 940,100"
            fill="none"
            stroke={`hsla(${HUE},90%,60%,0.1)`}
            strokeWidth="16"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ))}
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
        const col = [GREEN, GOLD, "#ffffff", ACCENT][i % 4];
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

// ---------------------------------------------------------------- ana sahne
export const RankRise: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = (bands[0] + bands[1] + bands[2] + bands[3]) / 4 || 0;

  const arrived = t >= ARRIVAL;
  const da = t - ARRIVAL;
  const climbing = t >= START && t < ARRIVAL;
  const pos = featuredPos(t);

  // tirmanis yogunlugu (turev)
  const dp = Math.abs(progress(t + 0.04) - progress(t - 0.04)) / 0.08;
  const moving = climbing ? clamp((dp * CLIMB) / 1.6) : 0;
  const prog = progress(t);
  const camZoom = 1 + 0.04 * prog;
  const shake = arrived && da < 0.5 ? Math.sin(da * 110) * 12 * (1 - da / 0.5) : 0;

  const heroIn = easeOutCubic((da - 0.35) / 0.6);
  const listOpacity = arrived ? 1 - 0.78 * clamp(da / 0.5) : 1;
  const listBlur = arrived ? 7 * clamp(da / 0.5) : 0;
  const fade = clamp((t - 15.7) / 0.6);

  const numerals = Array.from(new Set(ROWS.map((r) => r.rank)));

  return (
    <AbsoluteFill style={{ background: "#06070a", fontFamily }}>
      <Audio src={staticFile("rise-soundtrack.wav")} />

      <AbsoluteFill style={{ translate: `${shake}px ${shake * -0.6}px` }}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 1000px 900px at 50% 45%, hsla(${HUE}, 70%, ${14 + bass * 8 + prog * 6}%, 1), #05060a 75%)`,
          }}
        />
        <Chevrons speed={3 + moving * 22 + (arrived ? 4 : 0)} />
        <Speed intensity={climbing ? 0.45 + moving * 0.55 : arrived ? 0.25 * (1 - clamp(da / 1.2)) : 0.12} />

        {/* baslik */}
        <div
          style={{
            position: "absolute",
            top: 70,
            left: 0,
            width: 1080,
            textAlign: "center",
            lineHeight: 0.98,
            opacity: arrived ? 0 : 1,
            zIndex: 30,
          }}
        >
          {["KAÇ SIRA", "YÜKSELDİ?"].map((line, i) => {
            const f = frame - (3 + i * 8);
            const s = 1 + 1.3 * (1 - easeOutCubic(f / 8));
            return (
              <div
                key={i}
                style={{
                  fontFamily,
                  fontWeight: 700,
                  fontSize: i === 0 ? 118 : 138,
                  color: i === 0 ? "#fff" : GOLD,
                  opacity: clamp(f / 3),
                  scale: s,
                  textShadow: "0 6px 30px rgba(0,0,0,0.6)",
                }}
              >
                {line}
              </div>
            );
          })}
        </div>

        {/* liste: kamera yukselen karti sabit merkezde tutar, liste kayar */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            scale: camZoom,
            transformOrigin: `540px ${CENTER_Y}px`,
            opacity: listOpacity,
            filter: `blur(${listBlur}px)`,
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0) 300px, rgba(0,0,0,1) 420px, rgba(0,0,0,1) 1650px, rgba(0,0,0,0) 1740px)",
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0) 300px, rgba(0,0,0,1) 420px, rgba(0,0,0,1) 1650px, rgba(0,0,0,0) 1740px)",
          }}
        >
          {numerals.map((rank) => {
            const y = yOfSlot(rank, pos);
            if (y < -200 || y > 2100) return null;
            const near = Math.abs(rank - pos) < 0.6;
            return (
              <div
                key={rank}
                style={{
                  position: "absolute",
                  left: 40,
                  top: y,
                  width: 140,
                  height: ROW_H,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily,
                  fontWeight: 700,
                  fontSize: near ? 84 : 58,
                  color: near ? GOLD : "rgba(255,255,255,0.4)",
                  scale: near ? 1.08 : 1,
                  textShadow: near ? `0 0 28px ${GOLD}` : "none",
                }}
              >
                {rank}
              </div>
            );
          })}
          {ROWS.map((r, idx) => {
            const entrance = clamp((t - (0.05 + (idx % 6) * 0.06)) / 0.5);
            return <Card key={r.rank} row={r} t={t} frame={frame} entrance={entrance} />;
          })}
        </div>

        {/* varis: dev +N rozeti */}
        {arrived ? (
          <div style={{ position: "absolute", top: 70, left: 0, width: 1080, textAlign: "center", lineHeight: 0.95 }}>
            <div
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 330,
                color: GREEN,
                scale: 1 + 0.7 * Math.exp(-8 * da) * Math.cos(da * 16),
                opacity: clamp(da / 0.06),
                textShadow: `0 0 70px rgba(61,220,132,0.65), 0 10px 40px rgba(0,0,0,0.6)`,
              }}
            >
              {`+${CHANGE}`}
            </div>
            <div
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 96,
                color: "#fff",
                opacity: clamp((da - 0.2) / 0.25),
                translate: `0px ${(1 - easeOutCubic((da - 0.2) / 0.35)) * 40}px`,
              }}
            >
              SIRA YÜKSELDİ
            </div>
          </div>
        ) : null}

        {/* hero karti */}
        {arrived && heroIn > 0 ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 1080,
              height: 1920,
              opacity: heroIn,
              scale: 0.85 + 0.15 * heroIn,
              transformOrigin: "540px 1000px",
            }}
          >
            <div style={{ position: "absolute", left: 180, top: 530, width: 720, height: 720 }}>
              <Img
                src={staticFile("rise-hero.jpg")}
                style={{
                  width: 720,
                  height: 720,
                  borderRadius: 40,
                  objectFit: "cover",
                  scale: 1 + bass * 0.03,
                  boxShadow: `0 40px 90px rgba(0,0,0,0.7), 0 0 ${60 + bass * 80}px hsla(${HUE}, 95%, 55%, 0.5)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: -34,
                  top: -44,
                  minWidth: 220,
                  padding: "6px 34px",
                  borderRadius: 30,
                  background: GOLD,
                  color: "#1a1204",
                  fontFamily,
                  fontWeight: 700,
                  fontSize: 150,
                  lineHeight: 1.05,
                  textAlign: "center",
                  rotate: "-6deg",
                  boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
                }}
              >
                {`#${TO}`}
              </div>
            </div>
            <div style={{ position: "absolute", left: 0, top: 1285, width: 1080, textAlign: "center" }}>
              <div
                style={{
                  fontFamily,
                  fontWeight: 700,
                  fontSize: Math.min(110, 940 / (Math.max(data.artist.length, 6) * 0.5)),
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                {data.artist.toLocaleUpperCase("tr")}
              </div>
              <div
                style={{
                  fontFamily,
                  fontWeight: 500,
                  fontSize: Math.min(76, 940 / (Math.max(data.title.length, 8) * 0.48)),
                  color: GOLD,
                  lineHeight: 1.1,
                  marginTop: 6,
                }}
              >
                {data.title}
              </div>
              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 18,
                  fontFamily: mono,
                  fontWeight: 700,
                  fontSize: 38,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                <span style={{ color: RED }}>{`${FROM}.`}</span>
                <svg width="60" height="30" viewBox="0 0 60 30">
                  <polygon points="0,10 40,10 40,0 60,15 40,30 40,20 0,20" fill={GREEN} />
                </svg>
                <span style={{ color: GREEN }}>{`${TO}.`}</span>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{`· ${data.streams} stream`}</span>
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: 90,
                top: 1568,
                width: 900,
                height: 60,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 20,
                    height: 8 + (bands[i] ?? 0) * 52,
                    borderRadius: 6,
                    background: ACCENT,
                    opacity: 0.55 + (bands[i] ?? 0) * 0.45,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {arrived ? (
          <div
            style={{
              position: "absolute",
              top: 1650,
              left: 0,
              width: 1080,
              display: "flex",
              justifyContent: "center",
              opacity: clamp((t - (ARRIVAL + 3.4)) / 0.4) * (1 - fade),
              scale: 1 + 0.025 * Math.sin(frame / 5),
            }}
          >
            <div
              style={{
                padding: "14px 40px",
                borderRadius: 60,
                background: "#1DB954",
                color: "#031208",
                fontFamily,
                fontWeight: 700,
                fontSize: 42,
                letterSpacing: 4,
              }}
            >
              ŞİMDİ SPOTIFY'DA
            </div>
          </div>
        ) : null}

        <Sparkles start={ARRIVAL + 0.02} x={540} y={900} />
        <Sparkles start={ARRIVAL + 0.5} x={300} y={1100} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{ background: "#fff", opacity: arrived ? 0.9 * Math.exp(-11 * da) : 0, pointerEvents: "none" }}
      />
      <AbsoluteFill style={{ background: "#000", opacity: fade, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
