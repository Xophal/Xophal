import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { validateEnv } from "./src/lib/env.server";

// Surface environment misconfigurations early and loudly. This intentionally
// only warns: it runs inside `next build`, so throwing here would block
// deployments over a fixable environment-variable gap.
validateEnv();

const require = createRequire(import.meta.url);
const tslibPath = require.resolve("tslib/tslib.js");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.203.91.253"],
  turbopack: {
    resolveAlias: {
      tslib: "./node_modules/tslib/tslib.js",
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias.tslib = tslibPath;
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    },
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, max-age=0" },
      ],
    },
  ],
};

export default nextConfig;
