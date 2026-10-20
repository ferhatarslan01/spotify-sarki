import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import data from "./data-nrvar.json";

// "Yeni cikti" sablonu: KILIT EKRANI. Gece yarisi telefon kilit ekrani, bildirim gelir, titrer, dokunulur, calar acilir ve sarki baslar.
// ComfyUI gerektirmez: duvar kagidi kapaktan turetilir (buyutulmus, bulanik, tonlu).
const { fontFamily } = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] });

const BANDS = data.bands as number[][];
const HUE = data.hue;
const ARTIST = data.artist;
const TITLE = data.title;
const REVEAL = data.reveal;
const OUTRO = data.outro;
const DUR = data.durationSeconds;
const NOTIF_AT = 1.1;
const TAP_AT = REVEAL - 0.5;
const GREEN = "#1ed760";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x: number) => 1 - (1 - clamp(x)) ** 3;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const y = clamp(x);
  return 1 + c3 * (y - 1) ** 3 + c1 * (y - 1) ** 2;
};
const fit = (text: string, max: number, width: number, k = 0.55) => Math.min(max, width / (Math.max(text.length, 3) * k));

export const NRKilit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bands = BANDS[Math.min(BANDS.length - 1, frame)] ?? [];
  const bass = ((bands[0] ?? 0) + (bands[1] ?? 0) + (bands[2] ?? 0) + (bands[3] ?? 0)) / 4;

  const fadeIn = clamp(t / 0.4);
  const fadeOut = clamp((t - (DUR - 0.7)) / 0.7);
  const dr = t - REVEAL;
  const playerIn = clamp(dr / 0.55);
  const outroT = clamp((t - OUTRO) / 0.6);

  // bildirim: yukaridan kayar, kisa titresim, dokunmaya dogru buyur
  const nIn = easeOutBack((t - NOTIF_AT) / 0.45);
  const buzz = t >= NOTIF_AT && t < NOTIF_AT + 0.5 ? Math.sin((t - NOTIF_AT) * 130) * 7 * (1 - (t - NOTIF_AT) / 0.5) : 0;
  const tapP = clamp((t - TAP_AT) / 0.25);
  const notifFade = 1 - clamp(dr / 0.25);
  const notifScale = 1 + 0.06 * tapP;

  const headerTitle = fit(TITLE, 54, 820);
  const headerArtist = fit(ARTIST, 40, 820);
  const progress = clamp(dr / (OUTRO - REVEAL) * 0.9);
  const playerHue = HUE;

  return (
    <AbsoluteFill style={{ background: "#05060a", fontFamily }}>
      <Audio src={staticFile("nrvar-soundtrack.wav")} />

      {/* duvar kagidi: kapak buyutulmus + bulanik */}
      <AbsoluteFill style={{ opacity: fadeIn }}>
        <Img
          src={staticFile("nrvar-cover.jpg")}
          style={{
            position: "absolute",
            left: -420,
            top: -200,
            width: 1920,
            height: 2320,
            objectFit: "cover",
            filter: `blur(70px) saturate(1.4) brightness(${0.55 + bass * 0.12})`,
            scale: 1 + 0.03 * clamp(t / DUR),
          }}
        />
        <AbsoluteFill style={{ background: `linear-gradient(180deg, hsla(${playerHue},60%,12%,0.45) 0%, rgba(0,0,0,0.25) 50%, hsla(${playerHue},50%,8%,0.7) 100%)` }} />
      </AbsoluteFill>

      {/* durum cubugu */}
      <div style={{ position: "absolute", left: 70, top: 46, right: 70, display: "flex", justifyContent: "space-between", color: "#fff", fontWeight: 600, fontSize: 32, opacity: fadeIn }}>
        <div>00:00</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span>5G</span>
          <svg width="46" height="30" viewBox="0 0 46 30" fill="#fff">
            <rect x="0" y="20" width="8" height="10" rx="2" />
            <rect x="13" y="13" width="8" height="17" rx="2" />
            <rect x="26" y="6" width="8" height="24" rx="2" />
            <rect x="39" y="0" width="7" height="30" rx="2" />
          </svg>
          <svg width="58" height="28" viewBox="0 0 58 28" fill="none">
            <rect x="1.5" y="1.5" width="48" height="25" rx="7" stroke="#fff" strokeWidth="3" />
            <rect x="6" y="6" width="34" height="16" rx="4" fill="#fff" />
            <rect x="52" y="9" width="5" height="10" rx="2.5" fill="#fff" />
          </svg>
        </div>
      </div>

      {/* kilit ekrani: saat + tarih (oyuncu acilinca silinir) */}
      <div style={{ position: "absolute", left: 0, top: 170, width: 1080, textAlign: "center", color: "#fff", opacity: fadeIn * (1 - playerIn), translate: `0px ${-playerIn * 60}px` }}>
        <svg width="44" height="52" viewBox="0 0 24 28" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <rect x="3" y="12" width="18" height="14" rx="3" fill="#fff" />
          <path d="M7 12V8a5 5 0 0 1 10 0v4" />
        </svg>
        <div style={{ fontSize: 40, fontWeight: 500, marginTop: 6, opacity: 0.9 }}>{data.dateText}</div>
        <div style={{ fontSize: 250, fontWeight: 700, lineHeight: 1, letterSpacing: -4 }}>00:00</div>
      </div>

      {/* bildirim kartlari: onceki sahte bildirimler soluk, yenisi Spotify */}
      {t < REVEAL + 0.3 ? (
        <div style={{ position: "absolute", left: 50, top: 700, width: 980, opacity: notifFade, scale: notifScale }}>
          <div
            style={{
              borderRadius: 44,
              background: "rgba(40,42,50,0.55)",
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "26px 32px",
              marginBottom: 20,
              opacity: 0.45 * clamp((t - 0.4) / 0.4),
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 26, opacity: 0.8 }}>Mesajlar · 2 dk önce</div>
            <div style={{ fontSize: 34, fontWeight: 600, marginTop: 6 }}>Bu gece dinlenecek bir şey var mı?</div>
          </div>
          <div
            style={{
              borderRadius: 44,
              background: "rgba(245,246,250,0.94)",
              padding: "30px 34px",
              color: "#0a0c12",
              boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
              display: "flex",
              gap: 28,
              alignItems: "center",
              opacity: clamp((t - NOTIF_AT) / 0.15),
              translate: `${buzz}px ${(1 - nIn) * -520}px`,
              outline: tapP > 0 ? `${6 * tapP}px solid ${GREEN}` : "none",
            }}
          >
            <div style={{ width: 120, height: 120, borderRadius: 28, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="78" height="78" viewBox="0 0 24 24" fill="none" stroke="#0a0c12" strokeWidth="2.3" strokeLinecap="round">
                <path d="M4 9.2c5.4-1.6 11.2-1.1 16 1.6" />
                <path d="M5 13c4.6-1.3 9.4-.9 13.4 1.4" />
                <path d="M6 16.6c3.8-1 7.4-.7 10.6 1" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, fontWeight: 600, opacity: 0.6 }}>
                <span>SPOTIFY</span>
                <span>şimdi</span>
              </div>
              <div style={{ fontSize: 40, fontWeight: 700, marginTop: 6 }}>Yeni şarkı çıktı!</div>
              <div style={{ fontSize: headerArtist, fontWeight: 500, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {ARTIST} — {TITLE}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* parmak ucu dokunma noktasi */}
      {t >= TAP_AT && t < REVEAL + 0.25 ? (
        <div
          style={{
            position: "absolute",
            left: 800,
            top: 930,
            width: 130,
            height: 130,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.35)",
            border: "3px solid rgba(255,255,255,0.7)",
            scale: 0.6 + 0.5 * easeOutCubic((t - TAP_AT) / 0.3),
            opacity: 1 - clamp((t - REVEAL) / 0.25),
          }}
        />
      ) : null}

      {/* calar */}
      {t >= REVEAL - 0.02 ? (
        <div style={{ position: "absolute", inset: 0, opacity: clamp(dr / 0.2) * (1 - outroT), scale: 0.94 + 0.06 * easeOutCubic(dr / 0.5) }}>
          <div style={{ position: "absolute", left: 0, top: 120, width: 1080, textAlign: "center", color: "rgba(255,255,255,0.75)", fontSize: 30, fontWeight: 600, letterSpacing: 6 }}>
            ŞİMDİ ÇALIYOR
          </div>
          <div
            style={{
              position: "absolute",
              left: 120,
              top: 220,
              width: 840,
              height: 840,
              borderRadius: 36,
              overflow: "hidden",
              scale: 1 + bass * 0.03,
              boxShadow: `0 40px 120px hsla(${playerHue},80%,45%,0.55), 0 30px 90px rgba(0,0,0,0.6)`,
            }}
          >
            <Img src={staticFile("nrvar-cover.jpg")} style={{ width: 840, height: 840, objectFit: "cover" }} />
          </div>
          <div style={{ position: "absolute", left: 120, top: 1110, width: 840, color: "#fff" }}>
            <div style={{ fontSize: headerTitle, fontWeight: 700, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{TITLE}</div>
            <div style={{ fontSize: headerArtist, fontWeight: 500, opacity: 0.75, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ARTIST}</div>
          </div>
          {/* ilerleme cubugu */}
          <div style={{ position: "absolute", left: 120, top: 1310, width: 840 }}>
            <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.28)" }}>
              <div style={{ width: `${progress * 100}%`, height: 8, borderRadius: 4, background: "#fff" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.7)", fontSize: 26, marginTop: 12 }}>
              <span>0:{String(Math.floor(Math.max(0, dr))).padStart(2, "0")}</span>
              <span>YENİ</span>
            </div>
          </div>
          {/* kontroller */}
          <div style={{ position: "absolute", left: 120, top: 1420, width: 840, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
            <svg width="70" height="70" viewBox="0 0 24 24" fill="#fff">
              <path d="M6 5h2v14H6zM20 5v14L9 12z" />
            </svg>
            <div style={{ width: 140, height: 140, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="#0a0c12">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            </div>
            <svg width="70" height="70" viewBox="0 0 24 24" fill="#fff">
              <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
            </svg>
          </div>
          <div style={{ position: "absolute", left: 0, top: 1660, width: 1080, textAlign: "center", color: "#fff", fontWeight: 600, fontSize: 40, letterSpacing: 5, opacity: clamp((dr - 0.8) / 0.5) }}>
            ŞİMDİ SPOTIFY&apos;DA
          </div>
        </div>
      ) : null}

      {/* kapanis */}
      {outroT > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 880, width: 1080, textAlign: "center", opacity: outroT * (1 - fadeOut) }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 48, letterSpacing: 6 }}>@YENISARKILARIM</div>
          <div style={{ color: GREEN, fontWeight: 600, fontSize: 34, letterSpacing: 4, marginTop: 14 }}>Yeni çıkanlar ilk burada</div>
        </div>
      ) : null}

      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
