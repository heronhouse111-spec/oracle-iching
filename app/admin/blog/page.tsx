"use client";

/**
 * /admin/blog — 部落格文章列表
 *
 * 功能:
 *   - 列出全部文章(包含未上架),按 published_at desc
 *   - 顯示 slug / 標題 / 分類 / 上架狀態 / 最後更新
 *   - 「新增文章」→ /admin/blog/new
 *   - 點 row → /admin/blog/{id}/edit
 *   - 刪除按鈕(確認後 DELETE)
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface PostRow {
  id: string;
  slug: string;
  category: string;
  published_at: string;
  published: boolean;
  title_zh: string;
  title_en: string | null;
  /** body 對應四語系欄位 — 用來判斷哪些語系翻譯缺失 */
  body_en: string[] | null;
  body_ja: string[] | null;
  body_ko: string[] | null;
  updated_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  intro: "入門",
  spread: "牌陣",
  card: "牌義",
  topic: "主題",
  ai: "AI",
};

export default function AdminBlogListPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/blog", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/blog";
        return;
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { posts: PostRow[] };
      setPosts(data.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string, slug: string) => {
    if (!confirm(`確定要刪除文章「${slug}」?此動作無法復原。`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json()) as { detail?: string };
        throw new Error(j.detail ?? `HTTP ${res.status}`);
      }
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  // 統計缺翻譯的篇數(任一語系 body 為 null 就算)
  const missingCount = posts.filter(
    (p) => p.body_en == null || p.body_ja == null || p.body_ko == null
  ).length;

  const handleBackfill = async () => {
    if (
      !confirm(
        `確定要為 ${missingCount} 篇缺翻譯的文章補翻譯?\n\n會呼叫 DeepSeek API,可能需要 ${Math.max(
          1,
          Math.ceil(missingCount * 5 / 60)
        )} 分鐘。期間請不要關掉這個頁面。`
      )
    ) {
      return;
    }
    setBackfillBusy(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/admin/blog/backfill-translations", {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(j.detail ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        totalTranslated: number;
        totalSkipped: number;
        totalFailed: number;
      };
      setBackfillResult(
        `✓ 完成。翻譯成功 ${data.totalTranslated} 個語系欄位、跳過 ${data.totalSkipped} 篇、失敗 ${data.totalFailed} 個語系欄位。`
      );
      await load();
    } catch (e) {
      setBackfillResult(`✗ 失敗:${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBackfillBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main
        style={{
          paddingTop: 88,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link
            href="/admin"
            style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", textDecoration: "none" }}
          >
            ← 後台首頁
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 16,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              className="text-gold-gradient"
              style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 24, marginBottom: 4 }}
            >
              部落格文章
            </h1>
            <p style={{ fontSize: 12, color: "rgba(192,192,208,0.55)" }}>
              新增 / 編輯 / 刪除前台 /blog 顯示的文章。儲存後最多 60 秒前台快取會更新。
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {missingCount > 0 && (
              <button
                onClick={handleBackfill}
                disabled={backfillBusy}
                style={{
                  padding: "10px 18px",
                  fontSize: 13,
                  borderRadius: 9999,
                  border: "1px solid rgba(253,230,138,0.5)",
                  color: "#fde68a",
                  background: "rgba(253,230,138,0.08)",
                  cursor: backfillBusy ? "wait" : "pointer",
                  opacity: backfillBusy ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {backfillBusy
                  ? "翻譯中…"
                  : `✦ 補翻譯(${missingCount} 篇缺)`}
              </button>
            )}
            <Link
              href="/admin/blog/new"
              className="btn-gold"
              style={{
                padding: "10px 20px",
                fontSize: 13,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              ✦ 新增文章
            </Link>
          </div>
        </div>

        {backfillResult && (
          <div
            style={{
              padding: 12,
              border: backfillResult.startsWith("✓")
                ? "1px solid rgba(74,222,128,0.4)"
                : "1px solid rgba(248,113,113,0.4)",
              background: backfillResult.startsWith("✓")
                ? "rgba(74,222,128,0.08)"
                : "rgba(248,113,113,0.08)",
              borderRadius: 8,
              color: backfillResult.startsWith("✓") ? "#86efac" : "#fca5a5",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {backfillResult}
          </div>
        )}

        {loading && <div style={{ color: "rgba(192,192,208,0.5)" }}>載入中…</div>}
        {error && (
          <div
            style={{
              padding: 12,
              border: "1px solid rgba(248,113,113,0.4)",
              background: "rgba(248,113,113,0.08)",
              borderRadius: 8,
              color: "#fca5a5",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "rgba(192,192,208,0.55)",
              border: "1px dashed rgba(212,168,85,0.25)",
              borderRadius: 12,
            }}
          >
            尚無文章 — 點右上「新增文章」開始第一篇
          </div>
        )}

        {!loading && posts.length > 0 && (
          <div
            style={{
              border: "1px solid rgba(212,168,85,0.18)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 80px 90px 100px 80px",
                gap: 10,
                padding: "10px 14px",
                background: "rgba(212,168,85,0.08)",
                fontSize: 11,
                color: "rgba(212,168,85,0.85)",
                letterSpacing: 1,
                fontWeight: 700,
              }}
            >
              <div>發布日期</div>
              <div>標題 / Slug</div>
              <div>分類</div>
              <div>狀態</div>
              <div>更新</div>
              <div></div>
            </div>
            {posts.map((p) => {
              const isBusy = busyId === p.id;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 80px 90px 100px 80px",
                    gap: 10,
                    padding: "12px 14px",
                    borderTop: "1px solid rgba(212,168,85,0.1)",
                    alignItems: "center",
                    fontSize: 13,
                    background: isBusy ? "rgba(212,168,85,0.05)" : "transparent",
                    opacity: isBusy ? 0.5 : 1,
                  }}
                >
                  <div style={{ color: "rgba(212,168,85,0.7)", fontFamily: "monospace", fontSize: 12 }}>
                    {p.published_at}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Link
                      href={`/admin/blog/${p.id}/edit`}
                      style={{
                        color: "#e8e8f0",
                        fontFamily: "'Noto Serif TC', serif",
                        textDecoration: "none",
                        fontWeight: 600,
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.title_zh}
                    </Link>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(192,192,208,0.45)",
                        fontFamily: "monospace",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        marginTop: 2,
                      }}
                    >
                      {p.slug}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(212,168,85,0.85)",
                      background: "rgba(212,168,85,0.1)",
                      padding: "3px 8px",
                      borderRadius: 100,
                      width: "fit-content",
                    }}
                  >
                    {CATEGORY_LABELS[p.category] ?? p.category}
                  </div>
                  <div>
                    {p.published ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#86efac",
                          background: "rgba(74,222,128,0.12)",
                          padding: "3px 8px",
                          borderRadius: 100,
                        }}
                      >
                        ✓ 已上架
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          color: "rgba(192,192,208,0.6)",
                          background: "rgba(192,192,208,0.08)",
                          padding: "3px 8px",
                          borderRadius: 100,
                        }}
                      >
                        草稿
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(192,192,208,0.45)" }}>
                    {p.updated_at ? new Date(p.updated_at).toLocaleDateString("zh-TW") : ""}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Link
                      href={`/admin/blog/${p.id}/edit`}
                      style={{
                        padding: "5px 10px",
                        fontSize: 11,
                        borderRadius: 6,
                        border: "1px solid rgba(212,168,85,0.3)",
                        color: "#d4a855",
                        background: "rgba(212,168,85,0.06)",
                        textDecoration: "none",
                      }}
                    >
                      編輯
                    </Link>
                    <button
                      onClick={() => handleDelete(p.id, p.slug)}
                      disabled={isBusy}
                      style={{
                        padding: "5px 8px",
                        fontSize: 11,
                        borderRadius: 6,
                        border: "1px solid rgba(248,113,113,0.4)",
                        color: "#fca5a5",
                        background: "rgba(248,113,113,0.08)",
                        cursor: isBusy ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
