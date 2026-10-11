import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "embedded-postgres"],
  experimental: {
    // Album cover uploads go through server actions.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
