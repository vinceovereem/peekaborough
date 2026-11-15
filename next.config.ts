import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is behind sign-in and rendered per user, so there is no static shell to prerender.
  // Cache Components / Partial Prefetching are deliberately left off; turn them on (and add
  // "use cache" to the public reads) if the map ever becomes browsable without an account.
  reactCompiler: true,
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: { serverActions: { bodySizeLimit: "5mb" } }, // cover photo uploads
};

export default nextConfig;
