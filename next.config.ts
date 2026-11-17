import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is behind sign-in and rendered per user, so there is no static shell to prerender.
  // Cache Components / Partial Prefetching are deliberately left off; turn them on (and add
  // "use cache" to the public reads) if the map ever becomes browsable without an account.
  reactCompiler: true,
  poweredByHeader: false,
  // Sent with every response. No other site may show ours in a frame (so nobody can be tricked into
  // pressing a button here), and links out do not carry the page a visitor was on.
  // ponytail: no script rules in the policy. Those need a per-request nonce, which the prebuilt guide
  // pages cannot carry; add one through proxy.ts if the site ever renders text it did not escape.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }]
  },
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
