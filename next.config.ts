import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/tools/lol/meta",
        destination: "/calculators/lol/meta",
        permanent: true, // 301 redirect
      },
    ];
  },
};

export default nextConfig;
