import type { MetadataRoute } from "next";
import { tarotDeck } from "@/data/tarot";
import { SPREADS } from "@/data/spreads";
import { BLOG_POSTS } from "@/data/blog";

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
 * 動態 sitemap.xml — Next.js 16 metadata route。
 *   - 靜態頁(首頁、yes-no、daily、blog index、card index、spread index、privacy、terms)
 *   - 動態頁(78 牌、5 牌陣、N 篇 blog)
 *   - 個別 user 的 /history、/account、/admin 都不應該在 sitemap 中(不公開)
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/yes-no`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/daily`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/tarot/cards`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/tarot-spread`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/install`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const cardPages: MetadataRoute.Sitemap = tarotDeck.map((c) => ({
    url: `${BASE_URL}/tarot/cards/${c.id}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const spreadPages: MetadataRoute.Sitemap = SPREADS.map((s) => ({
    url: `${BASE_URL}/tarot-spread/${s.id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.publishedAt),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...cardPages, ...spreadPages, ...blogPages];
}
