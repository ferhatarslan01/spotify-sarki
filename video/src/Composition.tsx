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
import { loadFont } from "@remotion/google-fonts/Oswald";
import data from "./data-board.json";

const { fontFamily } = loadFont("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});

type Row = {
  rank: number;
  title: string;
  artist: string;
  streams: string;
  change: number | null;
  cover: string;
  revealAt: number;
};

const FPS = 30;
const ROWS = data.rows as Row[]; // sirayla 5 -> 1
const REVEAL = data.reveal as number[];
const OUTRO = data.outro as number;
const BANDS = data.bands as number[][];
const DISPLAY = [...ROWS].reverse(); // ekranda ustte 1 numara
const N = ROWS.length;
const HERO_AT = REVEAL[REVEAL.length - 1];
const PULL_BACK = data.pullBack as number;
const CLOSE_AT = data.closeAt as number;
const HEAD = data.header as {
  hookTop: string;
  hookBottom: string;
  midTop: string;
  midBottom: string;
  heroTop: string;
  closeTop: string;
  closeBottom: string;
};
const HERO_LABEL = data.heroLabel as string;

// ---------------------------------------------------------------- renkler
const AMBER = "#ffb42a";
const CREAM = "#f3ead2";
const GOLD = "#f6c453";

// ---------------------------------------------------------------- yardimcilar
const ALPHA = " ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ0123456789.,'!?&-:·#@";
const len = ALPHA.length;

const norm = (s: string): string =>
  s
    .toLocaleUpperCase("tr")
    .split("")
    .map((c) => (ALPHA.includes(c) ? c : " "))
    .join("");

const hash = (a: number, b = 0, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};

const fit = (s: string, n: number): string => norm(s).slice(0, n);
const center = (s: string, n: number): string => {
  const t = fit(s, n);
  const left = Math.floor((n - t.length) / 2);
  return " ".repeat(left) + t + " ".repeat(n - t.length - left);
};

type KF = { f: number; char: string; steps: number };
const STEP_FRAMES = 2;

type CellState = { oldChar: string; newChar: string; p: number; flipping: boolean };

function cellState(frame: number, kfs: KF[]): CellState {
  let cur = " ";
  for (let k = 0; k < kfs.length; k++) {
    const kf = kfs[k];
    if (frame < kf.f) break;
    const target = ALPHA.indexOf(kf.char);
    const t = target < 0 ? 0 : target;
    const steps = kf.steps;
    const elapsed = frame - kf.f;
    const stepIndex = Math.floor(elapsed / STEP_FRAMES);
    const isLast = k === kfs.length - 1 || frame < kfs[k + 1].f;
    if (steps <= 0 || stepIndex >= steps) {
      cur = ALPHA[t];
      continue;
    }
    if (!isLast) {
      cur = ALPHA[t];
      continue;
    }
    const seq = (i: number) => (i === 0 ? cur : ALPHA[(t - steps + i + len * 100) % len]);
    return {
      oldChar: seq(stepIndex),
      newChar: seq(stepIndex + 1),
      p: ((elapsed % STEP_FRAMES) + 0.5) / STEP_FRAMES,
      flipping: true,
    };
  }
  return { oldChar: cur, newChar: cur, p: 1, flipping: false };
}

// ---------------------------------------------------------------- flap hucresi
const Half: React.FC<{
  char: string;
  w: number;
  h: number;
  font: number;
  bottom: boolean;
  color: string;
}> = ({ char, w, h, font, bottom, color }) => (
  <div
    style={{
      width: w,
      height: h / 2,
      overflow: "hidden",
      position: "relative",
      background: bottom
        ? "linear-gradient(#171717, #0b0b0b)"
        : "linear-gradient(#262626, #171717)",
      borderRadius: bottom ? "0 0 7px 7px" : "7px 7px 0 0",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 0,
        top: bottom ? -h / 2 : 0,
        width: w,
        height: h,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        fontWeight: 700,
        fontSize: font,
        lineHeight: `${h}px`,
        color,
      }}
    >
      {char === " " ? "" : char}
    </div>
  </div>
);

const Flap: React.FC<{
  kfs: KF[];
  w: number;
  h: number;
  font: number;
  color?: string;
}> = ({ kfs, w, h, font, color = CREAM }) => {
  const frame = useCurrentFrame();
  const s = cellState(frame, kfs);
  const persp = h * 5;
  return (
    <div style={{ position: "relative", width: w, height: h, perspective: persp }}>
      <div style={{ position: "absolute", top: 0, left: 0 }}>
        <Half char={s.newChar} w={w} h={h} font={font} bottom={false} color={color} />
      </div>
      <div style={{ position: "absolute", top: h / 2, left: 0 }}>
        <Half
          char={s.flipping ? s.oldChar : s.newChar}
          w={w}
          h={h}
          font={font}
          bottom
          color={color}
        />
      </div>
      {s.flipping && s.p < 0.5 ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transformOrigin: "50% 100%",
            transform: `rotateX(${-s.p * 180}deg)`,
          }}
        >
          <Half char={s.oldChar} w={w} h={h} font={font} bottom={false} color={color} />
        </div>
      ) : null}
      {s.flipping && s.p >= 0.5 ? (
        <div
          style={{
            position: "absolute",
            top: h / 2,
            left: 0,
            transformOrigin: "50% 0%",
            transform: `rotateX(${(1 - s.p) * 180}deg)`,
          }}
        >
          <Half char={s.newChar} w={w} h={h} font={font} bottom color={color} />
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          top: h / 2 - 1.5,
          left: 0,
          width: w,
          height: 3,
          background: "#000",
          boxShadow: "0 1px 0 rgba(255,255,255,0.05)",
        }}
      />
    </div>
  );
};

// text -> hucre anahtar kareleri. messages: [{atFrame, text}] (ayni uzunlukta, bosluklu)
type Msg = { at: number; text: string };

function buildKfs(seed: number, col: number, msgs: Msg[]): KF[] {
  const out: KF[] = [];
  // acilis firtinasi: ilk anda bos'a kadar dondur
  out.push({ f: hash(seed, col, 1) % 8, char: " ", steps: 14 + (hash(seed, col, 2) % 14) });
  for (const [i, m] of msgs.entries()) {
    const ch = m.text[col] ?? " ";
    const st = ch === " " ? 6 + (hash(seed, col, 10 + i) % 6) : 8 + (hash(seed, col, 10 + i) % 9);
    out.push({
      f: m.at + col + (hash(seed, col, 20 + i) % 5),
      char: ch,
      steps: st,
    });
  }
  return out;
}

const FlapLine: React.FC<{
  seed: number;
  n: number;
  msgs: Msg[];
  w: number;
  h: number;
  font: number;
  gap: number;
  color?: string;
  justify?: "flex-start" | "flex-end" | "center";
}> = ({ seed, n, msgs, w, h, font, gap, color, justify = "flex-start" }) => (
  <div style={{ display: "flex", gap, justifyContent: justify }}>
    {Array.from({ length: n }).map((_, c) => (
      <Flap key={c} kfs={buildKfs(seed, c, msgs)} w={w} h={h} font={font} color={color} />
    ))}
  </div>
);

// ---------------------------------------------------------------- arka plan
const Dust: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: 46 }).map((_, i) => {
        const x = (hash(i, 1) % 1080) + Math.sin((frame + i * 17) / 70) * 24;
        const speed = 0.25 + (hash(i, 2) % 100) / 220;
        const y = 1920 - (((frame * speed * 3 + (hash(i, 3) % 2200)) % 2200) - 140);
        const size = 2 + (hash(i, 4) % 5);
        const tw = 0.25 + 0.5 * Math.abs(Math.sin((frame + i * 11) / 22));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "#ffd88a",
              opacity: tw * 0.55,
              filter: "blur(0.6px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Background: React.FC<{ bass: number }> = ({ bass }) => {
  const frame = useCurrentFrame();
  const beam = (i: number) => {
    const x = ((frame * (0.5 + i * 0.25) + i * 420) % 1700) - 300;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          top: -200,
          left: x,
          width: 220 + i * 70,
          height: 2400,
          rotate: "18deg",
          background:
            "linear-gradient(90deg, rgba(255,190,90,0), rgba(255,190,90,0.07), rgba(255,190,90,0))",
        }}
      />
    );
  };
  return (
    <AbsoluteFill style={{ background: "#07080b" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 900px 700px at 50% -80px, rgba(255,170,60,0.34), rgba(255,170,60,0) 70%)",
          opacity: 0.8 + bass * 0.2,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 1100px 900px at 50% 105%, rgba(40,60,120,0.35), rgba(0,0,0,0) 70%)",
        }}
      />
      {[0, 1, 2].map(beam)}
      <Dust />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 85% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.78) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- tahta satiri
const ROW_H = 174;
const ROW_GAP = 12;
const BOARD_X = 80;
const BOARD_W = 920;
const BOARD_TOP = 372;
const PAD = 22;
const BOARD_H = N * ROW_H + (N - 1) * ROW_GAP + PAD * 2;
const TICKET_TOP = BOARD_TOP + BOARD_H + 62;

const Arrow: React.FC<{ up: boolean }> = ({ up }) => (
  <svg width="26" height="22" viewBox="0 0 26 22">
    <polygon
      points={up ? "13,2 25,20 1,20" : "1,2 25,2 13,20"}
      fill={up ? "#3ddc84" : "#ff5a5f"}
    />
  </svg>
);

const BoardRow: React.FC<{ row: Row; d: number }> = ({ row, d }) => {
  const frame = useCurrentFrame();
  const revealF = Math.round(row.revealAt * FPS);
  const outroF = Math.round(OUTRO * FPS);
  const isHero = row.rank === 1;
  const text = (s: string, n: number) => fit(s, n).padEnd(n, " ");
  const rankMsgs: Msg[] = [
    { at: revealF, text: String(row.rank) },
    { at: outroF, text: " " },
  ];
  const titleMsgs: Msg[] = [
    { at: revealF + 6, text: text(row.title, 16) },
    { at: outroF + 6, text: " ".repeat(16) },
  ];
  const artistMsgs: Msg[] = [
    { at: revealF + 14, text: text(row.artist, 13) },
    { at: outroF + 12, text: " ".repeat(13) },
  ];
  const streamMsgs: Msg[] = [
    { at: revealF + 20, text: fit(row.streams, 5).padStart(5, " ") },
    { at: outroF + 16, text: " ".repeat(5) },
  ];

  const t = frame / FPS;
  const active = t >= row.revealAt && t < OUTRO;
  const glow = isHero
    ? 0.5 + 0.5 * Math.sin(frame / 6)
    : interpolate(t, [row.revealAt, row.revealAt + 0.5, row.revealAt + 1.6], [0, 1, 0.25], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const glowOn = active && (isHero ? t > HERO_AT + 0.6 && t < PULL_BACK + 1.1 : t < row.revealAt + 3.4);

  return (
    <div
      style={{
        position: "relative",
        height: ROW_H,
        display: "flex",
        alignItems: "center",
        padding: `0 ${PAD}px`,
        gap: 20,
        background: "linear-gradient(180deg, #121214, #0a0a0b)",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: glowOn
          ? `0 0 ${24 + glow * 36}px rgba(255,${isHero ? 196 : 170},60,${0.15 + glow * (isHero ? 0.45 : 0.3)}), inset 0 0 0 1px rgba(255,180,42,${0.25 + glow * 0.5})`
          : "inset 0 2px 8px rgba(0,0,0,0.6)",
      }}
    >
      <FlapLine
        seed={100 + d}
        n={1}
        msgs={rankMsgs}
        w={100}
        h={130}
        font={118}
        gap={0}
        color={isHero ? GOLD : AMBER}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <FlapLine seed={200 + d} n={16} msgs={titleMsgs} w={42} h={72} font={58} gap={3} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <FlapLine
            seed={300 + d}
            n={13}
            msgs={artistMsgs}
            w={30}
            h={48}
            font={36}
            gap={3}
            color="rgba(243,234,210,0.78)"
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {row.change !== null && row.change !== 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: interpolate(t, [row.revealAt + 1.2, row.revealAt + 1.5], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }) * (t < OUTRO ? 1 : 0),
                  fontFamily,
                  fontWeight: 700,
                  fontSize: 32,
                  color: row.change > 0 ? "#3ddc84" : "#ff5a5f",
                }}
              >
                <Arrow up={row.change > 0} />
                {Math.abs(row.change)}
              </div>
            ) : null}
            <FlapLine
              seed={400 + d}
              n={5}
              msgs={streamMsgs}
              w={30}
              h={48}
              font={36}
              gap={3}
              color={GOLD}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- bilet
const Ticket: React.FC<{ row: Row; start: number; end: number }> = ({ row, start, end }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const inP = interpolate(t, [start, start + 0.55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const outP = interpolate(t, [end - 0.35, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.7, 0, 0.84, 0),
  });
  if (t < start || t > end) return null;
  const isHero = row.rank === 1;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const titleSize = Math.min(64, 560 / (Math.max(row.title.length, 8) * 0.47));
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        top: TICKET_TOP,
        width: 920,
        height: 304,
        translate: `${(1 - inP) * 1100 - outP * 1100}px ${(1 - inP) * 40}px`,
        rotate: `${(1 - inP) * 6}deg`,
        borderRadius: 26,
        background: isHero
          ? "linear-gradient(135deg, #fbe39a 0%, #f2b84a 45%, #fbe39a 100%)"
          : "linear-gradient(135deg, #f6eedb 0%, #e8dcc0 100%)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        padding: "0 34px",
        gap: 34,
        overflow: "hidden",
      }}
    >
      {/* delikli kenar */}
      <div
        style={{
          position: "absolute",
          left: 296,
          top: 0,
          bottom: 0,
          width: 0,
          borderLeft: "4px dashed rgba(0,0,0,0.25)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 284,
          top: -16,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#07080b",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 284,
          bottom: -16,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#07080b",
        }}
      />
      <Img
        src={staticFile(row.cover)}
        style={{
          width: 236,
          height: 236,
          borderRadius: 18,
          objectFit: "cover",
          boxShadow: "0 10px 26px rgba(0,0,0,0.45)",
        }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, marginLeft: 18 }}>
        <div
          style={{
            fontFamily,
            fontWeight: 500,
            fontSize: 30,
            letterSpacing: 6,
            color: "rgba(0,0,0,0.55)",
          }}
        >
          {isHero ? HERO_LABEL : `SIRA ${row.rank}`}
        </div>
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: titleSize,
            lineHeight: 1.05,
            color: "#15130f",
          }}
        >
          {row.title.toLocaleUpperCase("tr")}
        </div>
        <div style={{ fontFamily, fontWeight: 500, fontSize: 40, color: "rgba(0,0,0,0.7)" }}>
          {row.artist}
        </div>
        {/* barkod = sesle dans eden cubuklar */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 66, marginTop: 8 }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 13,
                height: 12 + (bands[i] ?? 0) * 54,
                background: "#15130f",
                borderRadius: 3,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- kutlama (1 numara)
const Sparkles: React.FC<{ start: number; x: number; y: number }> = ({ start, x, y }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS - start;
  if (t < 0 || t > 2.6) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 70 }).map((_, i) => {
        const ang = ((hash(i, 5) % 3600) / 3600) * Math.PI * 2;
        const sp = 260 + (hash(i, 6) % 900);
        const drag = (1 - Math.exp(-1.7 * t)) / 1.7;
        const px = x + Math.cos(ang) * sp * drag;
        const py = y + Math.sin(ang) * sp * drag - 300 * drag + 0.5 * 1400 * t * t;
        const size = 8 + (hash(i, 7) % 14);
        const col = ["#ffd24d", "#fff4cc", "#ffb42a", "#ffffff"][i % 4];
        const op = 1 - Math.min(1, Math.max(0, (t - 1.4) / 1.2));
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
              rotate: `${(hash(i, 8) % 360) + t * 540}deg`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- ana sahne
export const TopBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = (bands[0] + bands[1] + bands[2] + bands[3]) / 4 || 0;

  // header mesajlari
  const f = (s: number) => Math.round(s * fps);
  const lead = DISPLAY[0];
  const headerTop: Msg[] = [
    { at: 0, text: center(HEAD.hookTop, 16) },
    { at: f(REVEAL[0] + 0.15), text: center(HEAD.midTop, 16) },
    { at: f(HERO_AT + 0.1), text: center(HEAD.heroTop, 16) },
    { at: f(CLOSE_AT), text: center(HEAD.closeTop, 16) },
    { at: f(OUTRO), text: " ".repeat(16) },
  ];
  const headerBottom: Msg[] = [
    { at: 0, text: center(HEAD.hookBottom, 16) },
    { at: f(REVEAL[0] + 0.25), text: center(HEAD.midBottom, 16) },
    { at: f(HERO_AT + 0.2), text: center(lead.artist, 16) },
    { at: f(CLOSE_AT), text: center(HEAD.closeBottom, 16) },
    { at: f(OUTRO), text: " ".repeat(16) },
  ];

  // kamera: aktif satira dogru yakinlas
  const rowCenter = (d: number) => PAD + d * (ROW_H + ROW_GAP) + ROW_H / 2;
  const times: number[] = [0];
  const focus: number[] = [rowCenter(2)];
  const zoom: number[] = [1];
  ROWS.forEach((r, i) => {
    const d = r.rank - 1;
    times.push(REVEAL[i], REVEAL[i] + 0.7);
    focus.push(rowCenter(d), rowCenter(d));
    zoom.push(1, i === N - 1 ? 1.1 : 1.08);
  });
  times.push(PULL_BACK, PULL_BACK + 1.0);
  focus.push(rowCenter(0), rowCenter(2));
  zoom.push(1.1, 1);
  const clampOpt = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const camZoom = interpolate(t, times, zoom, { ...clampOpt, easing: Easing.bezier(0.25, 1, 0.5, 1) });
  const camFocus = interpolate(t, times, focus, { ...clampOpt, easing: Easing.bezier(0.25, 1, 0.5, 1) });

  // 1 numara carpma sarsintisi
  const heroT = t - (HERO_AT + 0.15);
  const shake = heroT > 0 && heroT < 0.6 ? Math.sin(heroT * 90) * 10 * (1 - heroT / 0.6) : 0;


  // bilet zamanlari
  const tickets = ROWS.map((r, i) => ({
    row: r,
    start: REVEAL[i] + 0.9,
    end: i === N - 1 ? OUTRO - 0.2 : REVEAL[i + 1] + 0.75,
  }));

  return (
    <AbsoluteFill style={{ background: "#07080b", fontFamily }}>
      <Audio src={staticFile("board-soundtrack.wav")} />
      <Background bass={bass} />

      {/* baslik tabelasi */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 0,
          width: 1080,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          translate: `${shake * 0.4}px 0px`,
        }}
      >
        <FlapLine seed={1} n={16} msgs={headerTop} w={52} h={104} font={86} gap={4} color={AMBER} justify="center" />
        <FlapLine seed={2} n={16} msgs={headerBottom} w={52} h={104} font={86} gap={4} color={CREAM} justify="center" />
      </div>

      {/* tahta */}
      <div
        style={{
          position: "absolute",
          left: BOARD_X,
          top: BOARD_TOP,
          width: BOARD_W,
          height: BOARD_H,
          transformOrigin: `50% ${camFocus}px`,
          scale: camZoom * (1 + bass * 0.006),
          translate: `${shake}px ${shake * -0.6}px`,
          padding: PAD,
          boxSizing: "border-box",
          borderRadius: 30,
          background: "linear-gradient(180deg, #1b1b1e, #0d0d0f)",
          border: "2px solid #2d2d32",
          boxShadow: "0 40px 90px rgba(0,0,0,0.7), inset 0 0 0 6px #070708",
          display: "flex",
          flexDirection: "column",
          gap: ROW_GAP,
        }}
      >
        {DISPLAY.map((r, d) => (
          <BoardRow key={r.rank} row={r} d={d} />
        ))}
      </div>

      {tickets.map((tk) => (
        <Ticket key={tk.row.rank} row={tk.row} start={tk.start} end={tk.end} />
      ))}

      <Sparkles start={HERO_AT + 0.2} x={540} y={BOARD_TOP + PAD + ROW_H / 2} />
      <Sparkles start={HERO_AT + 1.0} x={540} y={1500} />
    </AbsoluteFill>
  );
};
