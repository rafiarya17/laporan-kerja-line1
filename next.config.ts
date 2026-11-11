import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/leader", destination: "/leader.html" }];
  },
};
export default nextConfig;
