import { ImageResponse } from "next/og";
import type { LocalizedText } from "@/lib/i18n/content";

// Branded social-share card. Self-contained: rendered server-side by Satori (next/og), no
// external fetch. Colours are the brand tokens from app/globals.css inlined as hex, since
// ImageResponse cannot read CSS variables. The root social card is English for the shared global
// URL; its new copy still lives as a complete localized field, like all new user-facing copy.
// Ref: node_modules/next/dist/docs/.../01-app/.../opengraph-image.md

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const COPY = {
  eyebrow: L("MVP · WEB · SOFTWARE · AI", "MVP · WEB · SOFTWARE · AI", "MVP · WEB · SOFTWARE · AI"),
  tagline: L(
    "MVP-uri, site-uri, CRM și automatizări AI — de la primul test la următoarea etapă.",
    "MVP, сайты, CRM и ИИ-автоматизация — от первого теста к следующему этапу.",
    "MVPs, websites, CRM & AI automation — from the first test to the next stage.",
  ),
  alt: L(
    "TBS Digital — MVP-uri, site-uri, CRM și automatizări AI",
    "TBS Digital — MVP, сайты, CRM и ИИ-автоматизация",
    "TBS Digital — MVPs, websites, CRM and AI automation",
  ),
};

export const alt = COPY.alt.en;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#1c1b30",
          backgroundImage:
            "radial-gradient(1100px 620px at 82% -8%, rgba(55,103,242,0.42), rgba(28,27,48,0) 60%), radial-gradient(760px 520px at 6% 118%, rgba(123,83,230,0.36), rgba(28,27,48,0) 62%)",
          fontFamily: "sans-serif",
          color: "#f5f1fa",
          position: "relative",
        }}
      >
        {/* hairline frame */}
        <div
          style={{
            position: "absolute",
            top: 36,
            left: 36,
            right: 36,
            bottom: 36,
            border: "1px solid rgba(185,174,222,0.24)",
            borderRadius: 28,
            display: "flex",
          }}
        />

        {/* eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 26,
            letterSpacing: 4,
            fontWeight: 700,
            color: "#93aeff",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 14,
              backgroundColor: "#4bccf0",
              boxShadow: "0 0 22px 4px rgba(75,204,240,0.8)",
            }}
          />
          {COPY.eyebrow.en}
        </div>

        {/* wordmark + tagline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", fontSize: 160, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>
            <span style={{ color: "#f5f1fa" }}>TBS</span>
            <span style={{ color: "#93aeff", marginLeft: 28 }}>DIGITAL</span>
          </div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: "#e7e2f2", maxWidth: 880, lineHeight: 1.28 }}>
            {COPY.tagline.en}
          </div>
        </div>

        {/* footer row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#f5f1fa" }}>tbs.md</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 2,
              color: "#bcb6cd",
              padding: "14px 26px",
              border: "1px solid rgba(185,174,222,0.28)",
              borderRadius: 999,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 10, backgroundColor: "#f4b25c", display: "flex" }} />
            CHIȘINĂU · MOLDOVA
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
