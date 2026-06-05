import { ImageResponse } from "next/og";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/ogCard";

export const alt = "Book a Bay Area Photography Session — soloxsnaps";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    ogCard({
      kicker: "Bay Area Photography",
      line1: "Let's book",
      line2: "your session",
      subtitle:
        "Graduation, couples, family & events. Send your date and location — replies within 24 hours.",
      url: "soloxsnaps.com/contact",
    }),
    { ...size }
  );
}
