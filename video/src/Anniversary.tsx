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
import data from "./data-anniv.json";

const { fontFamily } = loadOswald("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});
const { fontFamily: mono } = loadMono("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});

const BANDS = data.bands as number[][];
const REW_S = data.rewindStart;
const REW_E = data.rewindEnd;
const OFF = data.off;
const YEARS = data.years;
const YEAR_NOW = data.yearNow;
const ARTIST = data.artist.toLocaleUpperCase("tr");
const TITLE = data.title;
const AMBER = "#ffb42a";
const HUE = data.hue;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const clampOpt = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const hash = (a: number, b = 0, c = 0): number => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h);
};
const rnd = (a: number, b = 0) => (hash(a, b) % 10000) / 10000;
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;

// yil degeri: hizli baslar, sona dogru "kilitlenir" (sesteki tiklerle ayni formul)
const yearAt = (t: number): number => {
  const p = clamp((t - REW_S) / (REW_E - REW_S));
  return YEAR_NOW - YEARS * (1 - (1 - p) ** 4);
};

// ---------------------------------------------------------------- kilometre sayaci
const Wheel: React.FC<{ pos: number; h: number; w: number; font: number; color: string; blur: number }> = ({
  pos,
  h,
  w,
  font,
  color,
  blur,
}) => {
  const base = ((pos % 10) + 10) % 10;
  return (
    <div
      style={{
        width: w,
        height: h,
        overflow: "hidden",
        borderRadius: 18,
        background: "linear-gradient(180deg, #1c1c1f, #0b0b0c 50%, #1c1c1f)",
        border: "2px solid rgba(255,255,255,0.1)",
        position: "relative",
      }}
    >
      <div style={{ translate: `0px ${-(base + 10) * h}px`, filter: `blur(${blur}px)` }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: h,
              lineHeight: `${h}px`,
              textAlign: "center",
              fontFamily,
              fontWeight: 700,
              fontSize: font,
              color,
            }}
          >
            {i % 10}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0) 28%, rgba(0,0,0,0) 72%, rgba(0,0,0,0.55))",
        }}
      />
    </div>
  );
};

// v: kayan nokta deger, n: basamak sayisi
const Odometer: React.FC<{ v: number; n: number; h: number; w: number; font: number; color: string; blur: number }> = ({
  v,
  n,
  h,
  w,
  font,
  color,
  blur,
}) => {
  const pos: number[] = [];
  for (let k = 0; k < n; k++) {
    if (k === 0) pos.push(v);
    else {
      const carry = clamp((pos[k - 1] % 10) - 9, 0, 1);
      pos.push(Math.floor(v / 10 ** k) + carry);
    }
  }
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {pos
        .map((p, k) => ({ p, k }))
        .reverse()
        .map(({ p, k }) => (
          <Wheel key={k} pos={p} h={h} w={w} font={font} color={color} blur={blur} />
        ))}
    </div>
  );
};

// ---------------------------------------------------------------- VHS ekrani
const STRIPS = 18;
const SCREEN = 920;

const VhsPicture: React.FC<{ amp: number; grade: string; ghost: number }> = ({ amp, grade, ghost }) => {
  const frame = useCurrentFrame();
  const sh = SCREEN / STRIPS;
  return (
    <div style={{ position: "absolute", inset: 0, filter: grade }}>
      {ghost > 0 ? (
        <>
          <Img
            src={staticFile("anniv-cover.jpg")}
            style={{
              position: "absolute",
              inset: 0,
              width: SCREEN,
              height: SCREEN,
              objectFit: "cover",
              mixBlendMode: "screen",
              opacity: 0.55 * ghost,
              translate: `${-ghost * 16}px 0px`,
              filter: "sepia(1) saturate(8) hue-rotate(-50deg)",
            }}
          />
          <Img
            src={staticFile("anniv-cover.jpg")}
            style={{
              position: "absolute",
              inset: 0,
              width: SCREEN,
              height: SCREEN,
              objectFit: "cover",
              mixBlendMode: "screen",
              opacity: 0.55 * ghost,
              translate: `${ghost * 16}px 0px`,
              filter: "sepia(1) saturate(8) hue-rotate(150deg)",
            }}
          />
        </>
      ) : null}
      {Array.from({ length: STRIPS }).map((_, i) => {
        const jitter = (rnd(frame, i) - 0.5) * 2 * amp * (rnd(frame, 100 + i) > 0.55 ? 1 : 0.15);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: i * sh,
              width: SCREEN,
              height: sh + 1,
              overflow: "hidden",
              translate: `${jitter}px 0px`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: -i * sh,
                width: SCREEN,
                height: SCREEN,
                backgroundImage: `url(${staticFile("anniv-cover.jpg")})`,
                backgroundSize: `${SCREEN}px ${SCREEN}px`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

const Timeline: React.FC<{ t: number; start: number }> = ({ t, start }) => {
  const frame = useCurrentFrame();
  const p = interpolate(t, [start + 0.5, start + 3.4], [0, 1], {
    ...clampOpt,
    easing: Easing.bezier(0.45, 0, 0.2, 1),
  });
  const W = 880;
  const year = Math.round(data.releaseYear + YEARS * p);
  const done = p >= 1;
  const appear = clamp((t - start) / 0.4);
  return (
    <div style={{ position: "absolute", left: 100, top: 1290, width: W, opacity: appear }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily, fontWeight: 700, fontSize: 54 }}>
        <span style={{ color: AMBER }}>{data.releaseYear}</span>
        <span style={{ color: done ? "#fff" : "rgba(255,255,255,0.45)" }}>{YEAR_NOW}</span>
      </div>
      <div style={{ position: "relative", height: 90, marginTop: 6 }}>
        <div style={{ position: "absolute", left: 0, top: 44, width: W, height: 4, background: "rgba(255,255,255,0.25)" }} />
        <div style={{ position: "absolute", left: 0, top: 44, width: W * p, height: 4, background: AMBER }} />
        {Array.from({ length: YEARS + 1 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (i / YEARS) * W - 1.5,
              top: i % 5 === 0 ? 30 : 38,
              width: 3,
              height: i % 5 === 0 ? 34 : 18,
              background: i / YEARS <= p ? AMBER : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: p * W - 22,
            top: 22,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: AMBER,
            boxShadow: `0 0 36px ${AMBER}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: p * W - 80,
            top: -34,
            width: 160,
            textAlign: "center",
            fontFamily,
            fontWeight: 700,
            fontSize: 46,
            color: "#fff",
            opacity: p < 0.94 ? 1 : 0,
          }}
        >
          {year}
        </div>
      </div>
      <div
        style={{
          marginTop: 22,
          textAlign: "center",
          fontFamily,
          fontWeight: 700,
          fontSize: 78,
          color: done ? AMBER : "#fff",
          scale: done ? 1 + 0.08 * Math.exp(-6 * (t - (start + 3.4))) * Math.cos(20 * (t - (start + 3.4))) : 1,
          opacity: clamp((t - (start + 3.2)) / 0.3),
        }}
      >
        {`${YEARS} YIL GEÇTİ`}
      </div>
      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          fontFamily: mono,
          fontWeight: 500,
          fontSize: 38,
          color: "rgba(255,255,255,0.8)",
          opacity: clamp((t - (start + 4.2)) / 0.3),
          whiteSpace: "pre",
        }}
      >
        {"Sen hâlâ dinliyor musun?".slice(0, Math.max(0, Math.floor((t - (start + 4.2)) * 26)))}
        {Math.floor(frame / 8) % 2 === 0 ? "█" : " "}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- ana sahne
export const Anniversary: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = (bands[0] + bands[1] + bands[2] + bands[3]) / 4 || 0;

  const rewinding = t >= REW_S && t < REW_E;
  const afterPlay = t >= REW_E;
  const dtp = t - REW_E;
  const year = t < REW_S ? YEAR_NOW : afterPlay ? data.releaseYear : yearAt(t);
  const p = clamp((t - REW_S) / (REW_E - REW_S));
  const speed = rewinding ? (YEARS * 4 * (1 - p) ** 3) / (REW_E - REW_S) : 0; // yil/sn
  const blur = Math.min(7, speed * 0.22);

  // tracking bozulmasi
  let amp = 6;
  if (rewinding) amp = 18 + 60 * (1 - p) ** 2;
  else if (afterPlay) amp = 70 * Math.exp(-9 * dtp);
  const ghost = rewinding ? 1 : t < REW_S ? 0.5 : Math.max(0, 1 - dtp * 5);

  const restore = clamp((t - (REW_E + 0.5)) / 3.4);
  const grade = afterPlay
    ? `sepia(${0.8 * (1 - restore)}) saturate(${0.55 + 0.45 * restore}) contrast(${1.15 - 0.15 * restore}) brightness(${0.92 + 0.08 * restore})`
    : `grayscale(0.85) contrast(1.35) brightness(0.8)`;

  // CRT kapanma
  const offP = clamp((t - OFF) / 0.4);
  const offP2 = clamp((t - OFF - 0.4) / 0.25);
  const screenScaleY = t >= OFF ? Math.max(0.006, 1 - offP * 0.994) : 1;
  const screenScaleX = t >= OFF + 0.4 ? Math.max(0.001, 1 - offP2) : 1;
  const sceneFade = clamp((t - (OFF + 0.45)) / 0.4);

  // vurgu sarsintisi (oynat anı)
  const shake = afterPlay && dtp < 0.5 ? Math.sin(dtp * 110) * 12 * (1 - dtp / 0.5) : 0;

  const hookIn = t < REW_S + 0.15;
  const hookOut = clamp((t - REW_S) / 0.3);

  const countStart = REW_E + 0.35;
  const countV = interpolate(t, [countStart, countStart + 1.4], [0, YEARS], {
    ...clampOpt,
    easing: Easing.bezier(0.2, 0.8, 0.2, 1),
  });
  const timelineStart = REW_E + 4.1;
  const timelineOn = t >= timelineStart;

  return (
    <AbsoluteFill style={{ background: "#050505", fontFamily }}>
      <Audio src={staticFile("anniv-soundtrack.wav")} />

      <AbsoluteFill style={{ opacity: 1 - sceneFade, translate: `${shake}px ${shake * -0.5}px` }}>
        {/* arka plan: ince izgara + yumusak isik */}
        <AbsoluteFill
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "90px 90px",
          }}
        />
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 800px 700px at 50% 30%, hsla(${HUE}, 80%, ${22 + bass * 10}%, ${afterPlay ? 0.55 : 0.2}), rgba(0,0,0,0) 70%)`,
          }}
        />

        {/* sanatci - sarki */}
        <div
          style={{
            position: "absolute",
            top: 170,
            left: 0,
            width: 1080,
            textAlign: "center",
            fontFamily,
            fontWeight: 500,
            fontSize: 44,
            letterSpacing: 6,
            color: "rgba(255,255,255,0.9)",
          }}
        >
          {`${ARTIST}  ·  ${TITLE.toLocaleUpperCase("tr")}`}
        </div>

        {/* CRT ekran */}
        <div
          style={{
            position: "absolute",
            left: 80,
            top: 300,
            width: SCREEN,
            height: SCREEN,
            borderRadius: 36,
            overflow: "hidden",
            background: "#000",
            scale: `${screenScaleX} ${screenScaleY}`,
            boxShadow: `0 0 0 8px #151517, 0 0 0 10px rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.7), 0 0 ${40 + bass * 60}px hsla(${HUE}, 90%, 55%, ${afterPlay ? 0.35 : 0.1})`,
          }}
        >
          <VhsPicture amp={amp} grade={grade} ghost={ghost} />

          {/* takip cizgisi */}
          {(rewinding || hookIn) && (
            <div
              style={{
                position: "absolute",
                left: 0,
                width: SCREEN,
                top: ((frame * 37) % (SCREEN + 200)) - 100,
                height: 40 + rnd(frame, 9) * 60,
                background: "rgba(255,255,255,0.16)",
                filter: "blur(2px)",
              }}
            />
          )}
          {/* benek gurultusu */}
          {(rewinding || hookIn || dtp < 0.5) &&
            Array.from({ length: 46 }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: rnd(frame, 200 + i) * SCREEN,
                  top: rnd(frame, 300 + i) * SCREEN,
                  width: 3 + rnd(frame, 400 + i) * 90,
                  height: 2,
                  background: "#fff",
                  opacity: 0.18 + rnd(frame, 500 + i) * 0.4,
                }}
              />
            ))}
          {/* tarama cizgileri + vinyet */}
          <AbsoluteFill
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)",
            }}
          />
          <AbsoluteFill
            style={{
              background: "radial-gradient(ellipse 75% 75% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.7) 100%)",
            }}
          />

          {/* OSD */}
          <div
            style={{
              position: "absolute",
              left: 34,
              top: 28,
              fontFamily: mono,
              fontWeight: 700,
              fontSize: 46,
              color: "#fff",
              textShadow: "3px 3px 0 #000",
              opacity: rewinding ? (Math.floor(frame / 9) % 2 === 0 ? 1 : 0.25) : 1,
            }}
          >
            {t < REW_S ? "▶ OYNAT" : rewinding ? "◄◄ GERİ SAR" : "▶ OYNAT"}
          </div>
          <div
            style={{
              position: "absolute",
              right: 34,
              top: 28,
              fontFamily: mono,
              fontWeight: 700,
              fontSize: 46,
              color: "#7dff7d",
              textShadow: "3px 3px 0 #000",
            }}
          >
            {rewinding ? Math.round(year) : afterPlay ? data.releaseYear : YEAR_NOW}
          </div>

          {/* VHS tarih damgasi */}
          {afterPlay ? (
            <div
              style={{
                position: "absolute",
                right: 38,
                bottom: 34,
                fontFamily: mono,
                fontWeight: 700,
                fontSize: 54,
                letterSpacing: 2,
                color: "#ff9a1f",
                textShadow: "0 0 14px rgba(255,150,30,0.8), 3px 3px 0 #000",
                opacity: clamp(dtp / 0.15),
              }}
            >
              {`${data.day} ${data.monthAbbr} ${data.releaseYear}`}
            </div>
          ) : null}

          {/* ses cubuklari */}
          {afterPlay ? (
            <div style={{ position: "absolute", left: 38, bottom: 38, display: "flex", alignItems: "flex-end", gap: 4, height: 70 }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 8 + (bands[i] ?? 0) * 60,
                    background: "#7dff7d",
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>
          ) : null}

          {/* kanca yazisi */}
          {t < REW_S + 0.4 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                opacity: 1 - hookOut,
                scale: 1 + hookOut * 0.5,
              }}
            >
              {["KAÇ YIL", "OLDU?"].map((line, i) => {
                const f = frame - (4 + i * 9);
                const s = 1 + 1.6 * (1 - easeOutCubic(f / 8));
                const g = 3 + (hash(frame, i) % 13 === 0 ? 22 : 0) * 1;
                return (
                  <div
                    key={i}
                    style={{
                      position: "relative",
                      fontFamily,
                      fontWeight: 700,
                      fontSize: i === 0 ? 230 : 270,
                      lineHeight: 1.02,
                      color: i === 0 ? "#fff" : AMBER,
                      opacity: clamp(f / 3),
                      scale: s,
                      textShadow: `${-g}px 0 rgba(255,40,80,0.9), ${g}px 0 rgba(0,220,255,0.9), 0 8px 40px rgba(0,0,0,0.8)`,
                    }}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* alt bolge: yil sayaci -> sayac -> zaman cizgisi */}
        {!afterPlay ? (
          <div
            style={{
              position: "absolute",
              top: 1325,
              left: 0,
              width: 1080,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
              opacity: clamp((t - 0.4) / 0.4),
            }}
          >
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 36, letterSpacing: 8, color: "rgba(255,255,255,0.6)" }}>
              YIL
            </div>
            <Odometer v={year} n={4} h={230} w={136} font={220} color="#fff" blur={blur} />
          </div>
        ) : null}

        {afterPlay && !timelineOn ? (
          <div
            style={{
              position: "absolute",
              top: 1300,
              left: 0,
              width: 1080,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              opacity: clamp(dtp / 0.25) * (1 - clamp((t - (timelineStart - 0.3)) / 0.3)),
            }}
          >
            <Odometer v={countV} n={2} h={210} w={150} font={200} color={AMBER} blur={0} />
            <div
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: 84,
                color: "#fff",
                marginTop: 14,
                scale: 1 + (t > countStart + 1.4 ? 0.06 * Math.exp(-7 * (t - countStart - 1.4)) * Math.cos(26 * (t - countStart - 1.4)) : 0),
              }}
            >
              YIL ÖNCE ÇIKTI
            </div>
          </div>
        ) : null}

        {timelineOn ? <Timeline t={t} start={timelineStart} /> : null}

        {/* spotify cagrisi */}
        <div
          style={{
            position: "absolute",
            top: 1634,
            left: 0,
            width: 1080,
            display: "flex",
            justifyContent: "center",
            opacity: clamp((t - (timelineStart + 5.3)) / 0.4),
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
            ŞİMDİ SPOTIFY'DA
          </div>
        </div>
      </AbsoluteFill>

      {/* oynat flasi */}
      <AbsoluteFill
        style={{ background: "#fff", opacity: afterPlay ? 0.9 * Math.exp(-12 * dtp) : 0, pointerEvents: "none" }}
      />
      {/* CRT kapanma parlamasi */}
      {t >= OFF && t < OFF + 0.7 ? (
        <AbsoluteFill style={{ background: "#fff", opacity: 0.35 * Math.exp(-10 * (t - OFF)), pointerEvents: "none" }} />
      ) : null}
    </AbsoluteFill>
  );
};
