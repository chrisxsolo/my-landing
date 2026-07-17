import { ImageResponse } from "next/og";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogCard";

// Dynamic Open Graph / Twitter card for /portrait-guide and its nested pages.
// Next auto-wires this as og:image + twitter:image for the route segment (and
// children that don't define their own), so shares and AI previews get a branded
// soloxsnaps card. Rendered at build time.

export const alt = "San Francisco Lifestyle Portrait Guide — soloxsnaps";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    ogCard({
      kicker: "SF & Bay Area Portrait Photography",
      line1: "San Francisco",
      line2: "lifestyle portrait guide",
      subtitle:
        "Location ideas, what to wear, how to prepare, the best light, and how a guided portrait session flows.",
      url: "soloxsnaps.com/portrait-guide",
    }),
    { ...size }
  );
}
