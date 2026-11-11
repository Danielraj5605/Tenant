import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Reuse a visited tab for 60 s on the phone instead of refetching it. Saving
    // anything calls revalidatePath, which clears this cache straight away;
    // components/route-refresher.tsx refreshes revisited tabs in the background.
    staleTimes: { dynamic: 60 },
  },
  // Lets phones on the home Wi-Fi open the dev server by LAN IP.
  allowedDevOrigins: ["192.168.*.*"],
  async redirects() {
    return [
      { source: "/", destination: "/today", permanent: false },
      // Old invite links: joining now uses the flat code and the admin's approval.
      { source: "/join/:code", destination: "/onboarding", permanent: false },
    ];
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
