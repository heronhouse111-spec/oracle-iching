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
  // 讓 next/image 能對 Supabase Storage 出來的圖做 srcset / WebP 轉換。
  // 不開的話 <Image src={supabaseUrl} /> 會直發原檔,沒任何優化。
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
