/**
 * Tarogram 易問 · Service Worker
 *
 * 目的:
 * - 讓 Chrome / Android 把這個站判定為「可安裝 PWA」,跳自動安裝橫幅。
 * - 離線時給基本 fallback(至少能看到首頁 shell,不是白屏)。
 *
 * 保守策略 —— 不激進快取,避免踩到動態資料一致性地雷:
 * - GET 同源資源:network-first,失敗才從 cache 拿。
 * - API / auth / supabase / server actions:**完全跳過 SW**(bypass),直接走網路,
 *   不 cache 也不攔。這樣 Supabase session、點數、占卜結果永遠是最新的。
 * - 預載(precache)只有 "/" 跟 manifest,shell 壞了時至少首頁可用。
 *
 * 版本策略:CACHE 名字帶版本 → 每次改這個檔就 bump,activate 時清掉舊版。
 */

// 每次換靜態資源(塔羅圖、logo、字型...)就 bump 這個版本號,
// activate 階段會自動把舊 CACHE 整個砍掉,避免使用者卡在舊快取。
// v2 (2026-04-22): 塔羅 PNG → JPG 全換,清掉舊 cache。
const CACHE_VERSION = "oracle-v2";
const PRECACHE_URLS = ["/", "/manifest.json"];

// 明確跳過 SW 的 path prefix —— 這些都會動態變,絕不 cache。
const BYPASS_PREFIXES = [
  "/api/",
  "/auth/",
  "/_next/data/", // Next.js server payload
  "/tarot/",      // 塔羅牌圖:走 network-first,避免舊副檔名快取黏住
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        // 首次 install 連首頁都拿不到就放棄 precache —— 不影響 SW 其他行為
      })
  );
  // 立刻接管,不等舊 SW 自己結束
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 只處理 GET,POST / Server Action 全部放行
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 跨域資源(Google Fonts / Supabase / OG 圖 API 等):直接走網路,SW 不攔
  if (url.origin !== self.location.origin) return;

  // API / auth / 動態資料:絕對 bypass,不 cache
  if (BYPASS_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  // Navigate request (頁面切換):network-first,離線時 fallback 到 cached "/"
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((r) => r || caches.match("/"))
      )
    );
    return;
  }

  // 靜態資源(_next/static、圖、字型):cache-first,沒中再打網路並寫 cache
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((resp) => {
          // 只 cache 成功的同源靜態回應
          if (resp.ok && resp.type === "basic") {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          }
          return resp;
        })
        .catch(() => cached);
    })
  );
});
