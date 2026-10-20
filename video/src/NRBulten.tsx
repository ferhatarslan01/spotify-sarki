import React from "react";
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMono } from "@remotion/google-fonts/RobotoMono";
import data from "./data-nrvar.json";

// "Yeni cikti" sablonu: MUZIK BULTENI. Haber kanali dili: "SON DAKIKA" vurusu, haber gorseli olarak kapak, alt bant, kayan yazi.
const { fontFamily } = loadOswald("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

const BANDS = data.bands as number[][];
const ARTIST = data.artist.toLocaleUpperCase("tr");
const TITLE = data.title.toLocaleUpperCase("tr");
const REVEAL = data.reveal;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const HAS_BG = Boolean((data as { bg?: boolean }).bg);
const BG_SECONDS = (data as { bgSeconds?: number }).bgSeconds ?? 0;
const RED = "#e11d2e";
const NAVY = "#071635";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (text: string, max: number, width: number, k = 0.5) => Math.min(max, width / (Math.max(text.length, 3) * k));

export const NRBulten: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.4);
  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const revealed = t >= REVEAL;
  const dr = t - REVEAL;

  // "SON DAKIKA" vurusu: sol'dan gelir, sarsilir, acilista kuculup alt banda yerlesir
  const slamIn = easeOutBack((t - 0.15) / 0.35);
  const bigOut = clamp((t - (REVEAL - 0.25)) / 0.3);
  const shake = Math.max(0, 1 - (t - 0.15) / 0.5) * Math.sin(t * 80) * 16;

  const cover = easeOutBack(dr / 0.5);
  const lower = easeOutCubic((dr - 0.35) / 0.5);
  const typed = Math.floor(clamp((dr - 0.6) / 1.1) * `${ARTIST} · ${TITLE}`.length);
  const headline = `${ARTIST} · ${TITLE}`.slice(0, typed);
  const blink = Math.floor(t * 2) % 2 === 0;
  const tickerText = `YENİ ÇIKTI  ▪  ${ARTIST} – ${TITLE}  ▪  ŞİMDİ SPOTIFY'DA  ▪  `;
  const tickerShift = -((t * 240) % 1900);
  const headSize = fit(`${ARTIST} · ${TITLE}`, 64, 880, 0.5);
  const outroT = clamp((t - OUTRO) / 0.6);

  return (
    <AbsoluteFill style={{ background: NAVY, fontFamily }}>
      <Audio src={staticFile("nrvar-soundtrack.wav")} />

      {/* stüdyo arka plani */}
      <AbsoluteFill style={{ opacity: fadeIn }}>
        {HAS_BG ? (
          <Loop durationInFrames={Math.max(1, Math.round(BG_SECONDS * fps))}>
            <OffthreadVideo src={staticFile("nrvar-bg.mp4")} muted style={{ width: 1080, height: 1920, objectFit: "cover", filter: "brightness(0.75) saturate(1.1)" }} />
          </Loop>
        ) : (
          <AbsoluteFill
            style={{
              background: `linear-gradient(160deg, #0d2a63 0%, ${NAVY} 45%, #1b0a26 100%)`,
            }}
          />
        )}
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(4,12,32,0.55) 0%, rgba(4,12,32,0.15) 40%, rgba(4,12,32,0.7) 100%)" }} />
      </AbsoluteFill>

      {/* ust cubuk: kanal logosu + CANLI */}
      <div style={{ position: "absolute", left: 40, top: 60, display: "flex", alignItems: "center", gap: 0, opacity: fadeIn }}>
        <div style={{ background: RED, color: "#fff", fontWeight: 700, fontSize: 42, letterSpacing: 4, padding: "6px 22px" }}>YENİ ŞARKILARIM</div>
        <div style={{ background: "#fff", color: NAVY, fontWeight: 700, fontSize: 42, letterSpacing: 4, padding: "6px 22px" }}>BÜLTEN</div>
      </div>
      <div style={{ position: "absolute", right: 40, top: 66, display: "flex", alignItems: "center", gap: 14, opacity: fadeIn }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: blink ? RED : "#7a1620" }} />
        <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 36, letterSpacing: 4, color: "#fff" }}>CANLI</div>
      </div>
      <div style={{ position: "absolute", right: 40, top: 118, fontFamily: mono, fontWeight: 500, fontSize: 26, letterSpacing: 3, color: "rgba(255,255,255,0.75)", opacity: fadeIn }}>
        {data.dateText}
      </div>

      {/* SON DAKIKA vurusu */}
      {t < REVEAL + 0.1 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 760,
            width: 1080,
            opacity: clamp((t - 0.15) / 0.08) * (1 - bigOut),
            translate: `${(1 - slamIn) * -1100 + shake}px 0px`,
          }}
        >
          <div style={{ background: RED, color: "#fff", fontWeight: 700, fontSize: 190, lineHeight: 1.1, letterSpacing: 6, textAlign: "center", padding: "10px 0", boxShadow: "0 20px 70px rgba(0,0,0,0.6)" }}>
            SON DAKİKA
          </div>
          <div style={{ background: "#fff", color: NAVY, fontWeight: 700, fontSize: 64, letterSpacing: 8, textAlign: "center", padding: "8px 0" }}>
            YENİ ŞARKI GELDİ
          </div>
        </div>
      ) : null}

      {/* haber gorseli: kapak */}
      {revealed ? (
        <div
          style={{
            position: "absolute",
            left: 170,
            top: 270,
            width: 740,
            height: 740,
            scale: (0.7 + 0.3 * cover) * (1 + bass * 0.02),
            opacity: clamp(dr / 0.12) * (1 - outroT),
            border: "6px solid #fff",
            boxShadow: "0 30px 90px rgba(0,0,0,0.7)",
            overflow: "hidden",
          }}
        >
          <Img src={staticFile("nrvar-cover.jpg")} style={{ width: 740, height: 740, objectFit: "cover" }} />
          <div style={{ position: "absolute", left: 0, top: 0, background: RED, color: "#fff", fontWeight: 700, fontSize: 40, letterSpacing: 4, padding: "6px 20px" }}>
            CANLI GÖRÜNTÜ
          </div>
          {/* ses cubuklari */}
          <div style={{ position: "absolute", right: 18, bottom: 18, display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
            {[1, 3, 5, 8, 11, 14].map((b, i) => (
              <div key={i} style={{ width: 12, height: 14 + (bands[b] ?? 0) * 70, background: "#fff", opacity: 0.92 }} />
            ))}
          </div>
        </div>
      ) : null}

      {/* alt bant */}
      {revealed ? (
        <div style={{ position: "absolute", left: 0, top: 1090, width: 1080, translate: `${(1 - lower) * -1100}px 0px`, opacity: 1 - outroT }}>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <div style={{ background: RED, color: "#fff", fontWeight: 700, fontSize: 56, letterSpacing: 3, padding: "16px 30px", lineHeight: 1.1, width: 300 }}>
              SON
              <br />
              DAKİKA
            </div>
            <div style={{ flex: 1, background: "#fff", color: NAVY, padding: "14px 28px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 38, letterSpacing: 5, color: RED }}>YENİ ŞARKI</div>
              <div style={{ fontWeight: 700, fontSize: headSize, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden" }}>
                {headline}
                {blink ? "▌" : " "}
              </div>
            </div>
          </div>
          <div style={{ background: NAVY, color: "#fff", fontWeight: 500, fontSize: 38, letterSpacing: 4, padding: "10px 30px", borderTop: `6px solid ${RED}` }}>
            Şimdi Spotify&apos;da dinlenebilir
          </div>
        </div>
      ) : null}

      {/* kayan yazi */}
      <div style={{ position: "absolute", left: 0, bottom: 0, width: 1080, height: 120, background: RED, overflow: "hidden", opacity: fadeIn }}>
        <div style={{ position: "absolute", top: 20, left: 0, whiteSpace: "nowrap", translate: `${tickerShift}px 0px`, fontWeight: 700, fontSize: 56, letterSpacing: 4, color: "#fff" }}>
          {tickerText.repeat(4)}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, bottom: 124, width: 1080, textAlign: "center", fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: 6, color: "rgba(255,255,255,0.8)", opacity: clamp(dr / 0.5) }}>
        @YENISARKILARIM
      </div>

      {outroT > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 780, width: 1080, opacity: outroT * (1 - fadeOut) }}>
          <div style={{ background: RED, color: "#fff", fontWeight: 700, fontSize: 96, letterSpacing: 6, textAlign: "center", padding: "10px 0", boxShadow: "0 20px 70px rgba(0,0,0,0.6)" }}>YENİ ŞARKILARIM</div>
          <div style={{ background: "#fff", color: NAVY, fontWeight: 700, fontSize: 44, letterSpacing: 6, textAlign: "center", padding: "8px 0" }}>YENİ ÇIKANLAR İLK BURADA · TAKİP ET</div>
        </div>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: revealed ? 0.8 * Math.exp(-14 * dr) : 0, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
