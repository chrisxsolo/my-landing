import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep local development output away from the default `.next` folder,
  // which has been getting into a corrupted state on this machine.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  images: {
    qualities: [75, 85, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dmtslzwglpezympptqls.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
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
      { source: "/journal/:slug", destination: "/blog", permanent: true },
    ];
  },
};

export default nextConfig;
