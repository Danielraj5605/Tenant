import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Lets phones on the home Wi-Fi open the dev server by LAN IP.
  allowedDevOrigins: ["192.168.*.*"],
  async redirects() {
    // Skip when Supabase lands a sign-in code on / (proxy.ts forwards it to /auth/callback).
    return [{ source: "/", missing: [{ type: "query", key: "code" }], destination: "/today", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
