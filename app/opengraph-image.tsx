import { ImageResponse } from "next/og";

// Branded social-share card. Self-contained: rendered server-side by Satori (next/og), no
// external fetch. Colours are the brand tokens from app/globals.css inlined as hex, since
// ImageResponse cannot read CSS variables. Latin-only copy so the default font suffices.
// Ref: node_modules/next/dist/docs/.../03-file-conventions/01-metadata/opengraph-image.md

export const alt = "TBS Digital — custom software, mobile apps & AI automation";
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
          WEB · SOFTWARE · AI // 2026
        </div>

        {/* wordmark + tagline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", fontSize: 178, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>
            <span style={{ color: "#f5f1fa" }}>TBS</span>
            <span style={{ color: "#93aeff", marginLeft: 28 }}>DIGITAL</span>
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: "#e7e2f2", maxWidth: 920 }}>
            Custom software, mobile apps, CRM &amp; SaaS, and AI automation — strategy to launch.
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
