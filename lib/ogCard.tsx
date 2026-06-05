// Shared branded Open Graph / Twitter card renderer.
// Routes wire it up via their `opengraph-image.tsx` files — Next auto-emits the
// result as og:image + twitter:image, so social shares and AI previews get a
// consistent soloxsnaps card with no static asset to maintain.
//
// Design mirrors the original /grad-guide card: sage gradient, kicker label,
// two-line headline (second line in brand green), supporting line, and a footer
// with the canonical URL + brand mark.

type OgCardProps = {
  /** Small uppercase label at the top of the card. */
  kicker: string;
  /** First headline line (dark). */
  line1: string;
  /** Second headline line (brand green). */
  line2: string;
  /** Supporting sentence under the headline. */
  subtitle: string;
  /** Canonical URL shown in the footer, e.g. "soloxsnaps.com/contact". */
  url: string;
};

export function ogCard({ kicker, line1, line2, subtitle, url }: OgCardProps) {
  return (
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
        <div style={{ width: 14, height: 14, borderRadius: 999, background: "#3d6b5e" }} />
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#3d6b5e",
          }}
        >
          {kicker}
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
          {line1}
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
          {line2}
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
          {subtitle}
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
        <span>{url}</span>
        <span style={{ color: "#5b8a7a" }}>📸 SoloXSnaps</span>
      </div>
    </div>
  );
}

/** Shared metadata constants for opengraph-image route files. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
