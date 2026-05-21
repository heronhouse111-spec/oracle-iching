import type { MetadataRoute } from "next";

const BASE_URL = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://tarogram.heronhouse.me";
})();

/**
 * robots.txt — 開放公開頁面,擋住 /api 與帳號類路徑(避免爬蟲撞 auth)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/account/",
          "/admin/",
          "/history",
          "/r/", // 公開分享頁是給社群直連用,不主動 index(避免大量 user-generated UGC 進 Google)
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
