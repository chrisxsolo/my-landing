import { Fraunces } from "next/font/google";

// Warm display serif for the /links headline only; body copy stays on the
// site font. Exposed as --font-links-display for links.module.css.
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-links-display",
  display: "swap",
});

export default function LinksLayout({ children }: { children: React.ReactNode }) {
  return <div className={display.variable}>{children}</div>;
}
