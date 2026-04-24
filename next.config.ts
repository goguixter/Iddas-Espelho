import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.dev"],
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
