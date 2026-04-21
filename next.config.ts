import type { NextConfig } from "next";

// Next.js 16: `eslint` key removed — lint via `npx eslint .` instead.
// `turbopack.root` pinned so Turbopack stops detecting C:\Users\Eliot\package-lock.json
// as the workspace root (it is NOT — it's just a stray lockfile in the home dir).
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
