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
    ];
  },
};

export default nextConfig;
