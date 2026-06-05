import { ImageResponse } from "next/og";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogCard";

export const alt = "Bay Area Photography Availability — soloxsnaps";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    ogCard({
      kicker: "Bay Area Photography",
      line1: "Open dates &",
      line2: "availability",
      subtitle:
        "Check open dates for graduation, couples, family & portrait sessions — then reserve yours.",
      url: "soloxsnaps.com/availability",
    }),
    { ...size }
  );
}
