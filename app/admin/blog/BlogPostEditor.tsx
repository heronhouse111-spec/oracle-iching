"use client";

/**
 * BlogPostEditor — /admin/blog/new 與 /admin/blog/[id]/edit 共用的編輯表單
 *
 * 設計:
 *   - body 用 textarea,使用者輸入時用空行分段 — 提交時 split('\n\n') 變 string[],
 *     存進 DB 的 body_zh / body_en 欄位
 *   - 載入時把 string[] 用 join('\n\n') 還原成 textarea 內容
 *   - hero 圖片走既有的 /api/admin/upload (folder='blog'),回 url 後存進 hero_image_url
 *   - 提示使用者 paragraph 開頭 "## " = h2、inline "**xxx**" = bold(沿用現行渲染慣例)
 */

import { useState, useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface BlogPostFormValue {
  slug: string;
  category: string;
  publishedAt: string;
  published: boolean;
  heroImageUrl: string | null;
  titleZh: string;
  titleEn: string;
  excerptZh: string;
  excerptEn: string;
  /** 在表單裡 body 用一段「空行分段」的純文字儲存,提交時 split */
  bodyZhText: string;
  bodyEnText: string;
}

interface Props {
  /** 'new' 走 POST /api/admin/blog;'edit' 走 PUT /api/admin/blog/[id] */
  mode: "new" | "edit";
  /** edit 時需要 */
  postId?: string;
  /** 初始值 — edit 時從 server 載入後傳進來 */
  initial: BlogPostFormValue;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "intro", label: "intro · 入門" },
  { value: "spread", label: "spread · 牌陣" },
  { value: "card", label: "card · 牌義" },
  { value: "topic", label: "topic · 主題" },
  { value: "ai", label: "ai · AI" },
];

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  background: "rgba(13,13,43,0.5)",
  border: "1px solid rgba(212,168,85,0.25)",
  borderRadius: 8,
  color: "white",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block",
  color: "rgba(212,168,85,0.85)",
  fontSize: 12,
  marginBottom: 6,
  letterSpacing: 0.5,
};

const sectionStyle: CSSProperties = {
  border: "1px solid rgba(212,168,85,0.18)",
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
  background: "rgba(13,13,43,0.3)",
};

export default function BlogPostEditor({ mode, postId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<BlogPostFormValue>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // edit 模式:initial 從 parent 拉到後再 set 一次
  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const updateField = <K extends keyof BlogPostFormValue>(key: K, value: BlogPostFormValue[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleHeroUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "blog");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      fd.append("filename", `${form.slug || "post"}-hero-${Date.now()}.${ext}`);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json()) as { detail?: string };
        throw new Error(j.detail ?? `upload HTTP ${res.status}`);
      }
      const { url } = (await res.json()) as { url: string };
      updateField("heroImageUrl", url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // textarea 用空行分段成 paragraph 陣列;空行去掉
      const splitParagraphs = (text: string) =>
        text
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

      const payload = {
        slug: form.slug.trim(),
        category: form.category,
        publishedAt: form.publishedAt,
        published: form.published,
        heroImageUrl: form.heroImageUrl,
        titleZh: form.titleZh.trim(),
        titleEn: form.titleEn.trim(),
        excerptZh: form.excerptZh.trim(),
        excerptEn: form.excerptEn.trim(),
        bodyZh: splitParagraphs(form.bodyZhText),
        bodyEn: splitParagraphs(form.bodyEnText),
      };

      const url = mode === "edit" ? `/api/admin/blog/${postId}` : "/api/admin/blog";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        if (j.error === "duplicate_slug") {
          throw new Error(`Slug「${payload.slug}」已被其他文章使用,請換一個。`);
        }
        throw new Error(j.detail ?? j.error ?? `HTTP ${res.status}`);
      }
      router.push("/admin/blog");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const previewSlug = form.slug.trim();

  return (
    <div>
      {error && (
        <div
          style={{
            padding: 12,
            border: "1px solid rgba(248,113,113,0.4)",
            background: "rgba(248,113,113,0.1)",
            borderRadius: 8,
            color: "#fca5a5",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Section: meta */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 14, color: "#d4a855", margin: "0 0 14px" }}>基本資訊</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>
              Slug (URL 識別,小寫字母 + 數字 + 連字號;例:my-new-post)
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => updateField("slug", e.target.value)}
              placeholder="my-new-post"
              style={{ ...inputStyle, fontFamily: "monospace" }}
            />
            {previewSlug && (
              <p style={{ fontSize: 11, color: "rgba(192,192,208,0.5)", marginTop: 6 }}>
                前台網址:/blog/{previewSlug}
              </p>
            )}
          </div>
          <div>
            <label style={labelStyle}>分類</label>
            <select
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
              style={inputStyle}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>發布日期</label>
            <input
              type="date"
              value={form.publishedAt}
              onChange={(e) => updateField("publishedAt", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#e8e8f0",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => updateField("published", e.target.checked)}
                style={{ accentColor: "#d4a855" }}
              />
              已上架(取消勾選 = 草稿,前台 /blog 不會顯示)
            </label>
          </div>
        </div>
      </section>

      {/* Section: hero image */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 14, color: "#d4a855", margin: "0 0 14px" }}>封面圖(選填)</h2>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div
            style={{
              width: 220,
              aspectRatio: "16 / 9",
              borderRadius: 8,
              overflow: "hidden",
              border: "1px dashed rgba(212,168,85,0.3)",
              background: "rgba(13,13,43,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {form.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.heroImageUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ color: "rgba(192,192,208,0.45)", fontSize: 12 }}>未上傳</span>
            )}
          </div>
          <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 8 }}>
            <label
              style={{
                padding: "8px 14px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid rgba(212,168,85,0.3)",
                color: "#d4a855",
                background: "rgba(212,168,85,0.06)",
                cursor: uploading ? "wait" : "pointer",
                opacity: uploading ? 0.5 : 1,
                width: "fit-content",
              }}
            >
              {uploading ? "上傳中…" : form.heroImageUrl ? "更換圖片" : "上傳圖片"}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleHeroUpload(f);
                  e.currentTarget.value = "";
                }}
                disabled={uploading}
                style={{ display: "none" }}
              />
            </label>
            {form.heroImageUrl && (
              <button
                type="button"
                onClick={() => updateField("heroImageUrl", null)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid rgba(248,113,113,0.4)",
                  color: "#fca5a5",
                  background: "rgba(248,113,113,0.08)",
                  cursor: "pointer",
                  width: "fit-content",
                  fontFamily: "inherit",
                }}
              >
                移除圖片
              </button>
            )}
            <p style={{ fontSize: 11, color: "rgba(192,192,208,0.5)", lineHeight: 1.6 }}>
              建議 16:9 比例,1200×675 以上。前台索引頁卡片左側 + 詳細頁頂部會顯示。
            </p>
          </div>
        </div>
      </section>

      {/* Section: zh */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 14, color: "#d4a855", margin: "0 0 14px" }}>中文內容</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>標題(中)</label>
            <input
              type="text"
              value={form.titleZh}
              onChange={(e) => updateField("titleZh", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>摘要(中,索引頁卡片用)</label>
            <textarea
              value={form.excerptZh}
              onChange={(e) => updateField("excerptZh", e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div>
            <label style={labelStyle}>內文(中)</label>
            <textarea
              value={form.bodyZhText}
              onChange={(e) => updateField("bodyZhText", e.target.value)}
              rows={16}
              placeholder={
                "用空行分段。範例:\n\n第一段內容...\n\n## 這是 h2 標題\n\n第二段...,可以用 **粗體** 強調關鍵字。"
              }
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.8 }}
            />
            <p style={{ fontSize: 11, color: "rgba(192,192,208,0.5)", marginTop: 6, lineHeight: 1.7 }}>
              用<strong style={{ color: "#fde68a" }}>空行</strong>分段(連按兩次 Enter)。每段開頭打{" "}
              <code style={{ color: "#fde68a" }}>## </code>會渲染成 h2 標題;段落內{" "}
              <code style={{ color: "#fde68a" }}>**文字**</code> 會變粗體。
            </p>
          </div>
        </div>
      </section>

      {/* Section: en */}
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 14, color: "#d4a855", margin: "0 0 14px" }}>English Content</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Title (EN)</label>
            <input
              type="text"
              value={form.titleEn}
              onChange={(e) => updateField("titleEn", e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Excerpt (EN, used on index card)</label>
            <textarea
              value={form.excerptEn}
              onChange={(e) => updateField("excerptEn", e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div>
            <label style={labelStyle}>Body (EN)</label>
            <textarea
              value={form.bodyEnText}
              onChange={(e) => updateField("bodyEnText", e.target.value)}
              rows={16}
              placeholder={
                "Separate paragraphs with a blank line.\n\n## Use ## prefix for h2 headings\n\nUse **double asterisks** for bold."
              }
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.8 }}
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/admin/blog"
          style={{
            padding: "10px 20px",
            fontSize: 13,
            color: "rgba(192,192,208,0.7)",
            border: "1px solid rgba(192,192,208,0.2)",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          取消
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-gold"
          style={{
            padding: "10px 24px",
            fontSize: 13,
            border: "none",
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.5 : 1,
            fontFamily: "inherit",
          }}
        >
          {saving ? "儲存中…" : mode === "edit" ? "儲存變更" : "建立文章"}
        </button>
      </div>
    </div>
  );
}
