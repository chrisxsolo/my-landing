import type { NextConfig } from "next";

// Response headers for every route. Hardening rather than ranking: browsers
// stop sniffing content types, the site cannot be framed by other origins,
// referrers shrink to the origin off-site, and unused device APIs are off.
// No Content-Security-Policy yet: inline styles, Supabase images, Vercel
// Analytics, Google Fonts, and Google OAuth each need an audited allowlist
// before one can ship without breaking image delivery or sign-in.
export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
