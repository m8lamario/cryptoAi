import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  allowedDevOrigins: ["192.168.1.175", "100.107.42.13"],
};

export default nextConfig;
