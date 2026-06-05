import { ImageResponse } from "next/og";

// Dynamic Open Graph / Twitter card for /grad-guide. Next auto-wires this file
// as og:image + twitter:image for the route, so social shares and AI previews
// get a branded card with no static asset to maintain. Rendered at build time.

export const alt = "Bay Area Graduation Photo Guide — soloxsnaps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #eaf2ee 0%, #f7faf8 55%, #dfece6 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#3d6b5e",
            }}
          />
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#3d6b5e",
            }}
          >
            Bay Area Grad Photography
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              color: "#101412",
            }}
          >
            Your complete
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              color: "#3d6b5e",
            }}
          >
            graduation photo guide
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.45,
              color: "#4b5a55",
              maxWidth: 880,
            }}
          >
            Posing, outfits, prep & the best campus spots — SJSU, UC Berkeley,
            SF State, USF & CSU East Bay.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 28,
            fontWeight: 700,
            color: "#101412",
          }}
        >
          <span>soloxsnaps.com/grad-guide</span>
          <span style={{ color: "#5b8a7a" }}>📸 SoloXSnaps</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
