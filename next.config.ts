import type { NextConfig } from "next";

const SUPABASE_ORIGIN = "https://dmtslzwglpezympptqls.supabase.co";

// Content-Security-Policy, built from an inventory of what the browser loads:
// - scripts: Next's own bundles plus its inline hydration scripts, which need
//   'unsafe-inline' because the public pages are statically rendered (a
//   per-request nonce would force dynamic rendering and lose ISR); Vercel
//   Analytics loads from /_vercel/insights on Vercel and from
//   va.vercel-scripts.com in development; 'unsafe-eval' only in development,
//   where React uses eval to rebuild server error stacks.
// - styles: inline <style> blocks on most pages, and Google Fonts stylesheets
//   in the admin and client portal (next/font self-hosts the public site's).
// - images: Supabase transforms, blob previews in the admin, data: SVG
//   backgrounds, and admin email previews that embed any https image.
// - connections: the browser Supabase client (REST, auth, storage, realtime),
//   analytics beacons, and the sunrise API the admin conversation page calls.
// - forms/navigation: inquiry forms post to this origin; Google sign-in goes
//   through Supabase auth and accounts.google.com.
// Shipped report-only first (2026-11-05); the production console showed no
// violations on the public pages or sign-in, so it now enforces. Set back to
// "report-only" to investigate a regression without blocking anything.
type CspMode = "report-only" | "enforce";
const CSP_MODE = "enforce" as CspMode;

export function buildContentSecurityPolicy({ dev = false, enforce = CSP_MODE === "enforce" }: { dev?: boolean; enforce?: boolean } = {}): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_ORIGIN.replace("https://", "wss://")} https://va.vercel-scripts.com https://api.sunrise-sunset.org`,
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${SUPABASE_ORIGIN} https://accounts.google.com`,
    "worker-src 'self' blob:",
    "media-src 'self' https:",
    "manifest-src 'self'",
    // Browsers ignore (and log) this directive in a report-only policy.
    ...(enforce ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const CSP_HEADER_NAME = CSP_MODE === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";

// Response headers for every route. Hardening rather than ranking: browsers
// stop sniffing content types, the site cannot be framed by other origins,
// referrers shrink to the origin off-site, and unused device APIs are off.
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: CSP_HEADER_NAME, value: buildContentSecurityPolicy({ dev: process.env.NODE_ENV === "development" }) },
];

const nextConfig: NextConfig = {
  // Keep local development output away from the default `.next` folder,
  // which has been getting into a corrupted state on this machine.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  images: {
    // Vercel's hosted image optimizer (/_next/image) returns HTTP 402 once the
    // account's optimization quota is exhausted, breaking every next/image in
    // production. Instead of bypassing optimization entirely, route images
    // through Supabase's own transformation endpoint via a custom loader
    // (lib/supabaseImageLoader.ts): Supabase resizes/serves WebP close to
    // storage, next/image still builds the responsive srcset, and Vercel's
    // optimizer is never touched. Requires Supabase Pro (transformations).
    loader: "custom",
    loaderFile: "./lib/supabaseImageLoader.ts",
    qualities: [75, 85, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dmtslzwglpezympptqls.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      // Campus spots moved into the professional graduation guide.
      {
        source: "/location-guide",
        destination: "/grad-guide/campus-spots",
        permanent: true,
      },
      // The old "fun" site has been retired. 301 every former fun URL to its
      // professional equivalent so existing links and Google ranking flow to
      // the professional site instead of hitting dead pages.
      { source: "/home", destination: "/", permanent: true },
      { source: "/me", destination: "/about", permanent: true },
      { source: "/booking", destination: "/availability", permanent: true },
      { source: "/booking-process", destination: "/", permanent: true },
      { source: "/journal", destination: "/blog", permanent: true },
      { source: "/journal/:slug", destination: "/blog/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
