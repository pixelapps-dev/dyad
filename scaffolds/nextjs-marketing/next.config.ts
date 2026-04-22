import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Marketing sites are read-heavy; generate static HTML where we can.
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
