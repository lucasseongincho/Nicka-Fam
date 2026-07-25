import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Setlog merge route shells out to a native ffmpeg/ffprobe binary
  // (ffmpeg-static/ffprobe-static) instead of requiring it -- Vercel's file
  // tracer can't always detect that dependency through path.join(__dirname,
  // ...) alone, so it's spelled out here to make sure both binaries actually
  // ship in the deployed function's bundle.
  outputFileTracingIncludes: {
    "/api/setlog/tick": ["./node_modules/ffmpeg-static/**", "./node_modules/ffprobe-static/**"],
  },
};

export default nextConfig;
