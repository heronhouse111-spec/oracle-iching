"use client";

/**
 * /admin/ui-images — 首頁 / 占卜流程上的 icon 圖像管理
 *
 * 14 個 slot,每個可上傳 1 張圖。前端有 url 就顯示圖、沒就 emoji fallback。
 * 上傳後立即存(整包 PUT 一次)— 不必再點「儲存」。移除按鈕同理。
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

type ImagesMap = Record<string, string>;

interface Slot {
  id: string;
  group: string;
  label: string;
  emoji: string;
}

const SLOTS: Slot[] = [
  { id: "cta.iching", group: "首頁 CTA(占卜方式)", label: "易經占卜", emoji: "☯" },
  { id: "cta.tarot", group: "首頁 CTA(占卜方式)", label: "塔羅占卜", emoji: "🎴" },

  { id: "category.love", group: "問事類別", label: "感情", emoji: "💕" },
  { id: "category.career", group: "問事類別", label: "事業", emoji: "💼" },
  { id: "category.wealth", group: "問事類別", label: "財運", emoji: "💰" },
  { id: "category.health", group: "問事類別", label: "健康", emoji: "🌿" },
  { id: "category.study", group: "問事類別", label: "學業", emoji: "📚" },
  { id: "category.general", group: "問事類別", label: "綜合", emoji: "🔮" },

  { id: "freeTool.yes-no", group: "免費工具(塔羅)", label: "Yes / No 速答", emoji: "✦" },
  { id: "freeTool.daily", group: "免費工具(塔羅)", label: "每日一卡", emoji: "☀" },
  { id: "freeTool.cards", group: "免費工具(塔羅)", label: "塔羅百科", emoji: "📖" },
  { id: "freeTool.spreads", group: "免費工具(塔羅)", label: "牌陣介紹", emoji: "🃏" },

  { id: "freeTool.iching.yes-no", group: "免費工具(易經)", label: "Yes / No 一卦速答", emoji: "✦" },
  { id: "freeTool.iching.daily", group: "免費工具(易經)", label: "每日一卦", emoji: "☯" },
  { id: "freeTool.iching.methods", group: "免費工具(易經)", label: "卜卦方式介紹", emoji: "📜" },

  { id: "dualSystem.iching", group: "雙系統 showcase", label: "易經", emoji: "☰" },
  { id: "dualSystem.tarot", group: "雙系統 showcase", label: "塔羅", emoji: "🎴" },

  // ── 塔羅牌陣介紹圖（/tarot-spread/[slug] 詳細頁 + 主流程選牌陣畫面共用）──
  { id: "spread.three-card", group: "塔羅牌陣介紹圖", label: "三牌時間軸", emoji: "🃏" },
  { id: "spread.two-options", group: "塔羅牌陣介紹圖", label: "二選一牌陣", emoji: "⚖" },
  { id: "spread.love-cross", group: "塔羅牌陣介紹圖", label: "愛情十字牌陣", emoji: "💞" },
  { id: "spread.celtic-cross", group: "塔羅牌陣介紹圖", label: "凱爾特十字", emoji: "✦" },
  { id: "spread.year-twelve", group: "塔羅牌陣介紹圖", label: "年度十二宮", emoji: "🌙" },
];

// 把 slots group 起來
function bySection(slots: Slot[]): Record<string, Slot[]> {
  const out: Record<string, Slot[]> = {};
  for (const s of slots) {
    if (!out[s.group]) out[s.group] = [];
    out[s.group].push(s);
  }
  return out;
}

export default function AdminUiImagesPage() {
  const [images, setImages] = useState<ImagesMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ui-images", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/ui-images";
        return;
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { images: ImagesMap };
      setImages(data.images ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = async (next: ImagesMap) => {
    const res = await fetch("/api/admin/ui-images", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: next }),
    });
    if (!res.ok) {
      const j = (await res.json()) as { detail?: string; error?: string };
      throw new Error(j.detail ?? j.error ?? `HTTP ${res.status}`);
    }
  };

  const handleUpload = async (slotId: string, file: File) => {
    setBusySlot(slotId);
    try {
      // 1) 上傳到 Storage
      const fd = new FormData();
      fd.append("file", file);
      // folder = "ui-images",所有 slot 共用一個 folder
      fd.append("folder", "ui-images");
      // filename = slot id 把 . 換成 _,加 timestamp 防 CDN cache
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      fd.append("filename", `${slotId.replace(/\./g, "_")}_${Date.now()}.${ext}`);

      const upRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!upRes.ok) {
        const j = (await upRes.json()) as { detail?: string };
        throw new Error(j.detail ?? `upload HTTP ${upRes.status}`);
      }
      const { url } = (await upRes.json()) as { url: string };

      // 2) 更新 ui_images map(整包 PUT)
      const next = { ...images, [slotId]: url };
      await persist(next);
      setImages(next);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  };

  const handleRemove = async (slotId: string) => {
    if (!confirm(`移除「${slotId}」的圖片?(回到預設 emoji)`)) return;
    setBusySlot(slotId);
    try {
      const next = { ...images };
      delete next[slotId];
      await persist(next);
      setImages(next);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  };

  const sections = bySection(SLOTS);

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

        <h1
          className="text-gold-gradient"
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 24, marginBottom: 8 }}
        >
          首頁 icon 圖像管理
        </h1>
        <p style={{ fontSize: 12, color: "rgba(192,192,208,0.55)", marginBottom: 24 }}>
          每張圖建議用 200×200 PNG / WebP,有透明背景效果最好。沒上傳的 slot 會 fallback 到下方括號裡的 emoji。
        </p>

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

        {Object.entries(sections).map(([groupName, slots]) => (
          <section key={groupName} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, color: "#d4a855", marginBottom: 12 }}>{groupName}</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {slots.map((slot) => {
                const url = images[slot.id];
                const isBusy = busySlot === slot.id;
                return (
                  <div
                    key={slot.id}
                    className="mystic-card"
                    style={{ padding: 14 }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
                      {url ? (
                        <img
                          src={url}
                          alt=""
                          style={{
                            width: 168,
                            height: 168,
                            borderRadius: 14,
                            objectFit: "cover",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(212,168,85,0.3)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 168,
                            height: 168,
                            borderRadius: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 84,
                            background: "rgba(255,255,255,0.02)",
                            border: "1px dashed rgba(212,168,85,0.25)",
                          }}
                        >
                          {slot.emoji}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8f0" }}>
                          {slot.label}
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(192,192,208,0.45)", marginTop: 2 }}>
                          {slot.id} ({slot.emoji})
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <label
                        style={{
                          flex: 1,
                          ...smallBtnStyle,
                          textAlign: "center",
                          cursor: isBusy ? "wait" : "pointer",
                          opacity: isBusy ? 0.5 : 1,
                        }}
                      >
                        {isBusy ? "處理中…" : url ? "更換" : "上傳"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(slot.id, f);
                            e.currentTarget.value = ""; // 允許再次選同檔
                          }}
                          disabled={isBusy}
                          style={{ display: "none" }}
                        />
                      </label>
                      {url && (
                        <button
                          onClick={() => handleRemove(slot.id)}
                          disabled={isBusy}
                          style={{
                            ...smallBtnStyle,
                            borderColor: "rgba(248,113,113,0.4)",
                            color: "#fca5a5",
                            background: "rgba(248,113,113,0.08)",
                          }}
                        >
                          移除
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid rgba(212,168,85,0.3)",
  background: "rgba(212,168,85,0.06)",
  color: "#d4a855",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "inline-block",
};
