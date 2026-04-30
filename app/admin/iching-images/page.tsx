"use client";

/**
 * /admin/iching-images — 易經 64 卦圖像管理
 *
 * 64 個 slot,key=hexagram.number(1..64)。前端有 url 就顯示圖、沒就空著。
 * 上傳後立即整包 PUT(跟 /admin/ui-images 同一個 pattern)。
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { hexagrams, trigramNames } from "@/data/hexagrams";
import { trigramImageKey } from "@/lib/ichingImages";

type ImagesMap = Record<string, string>;

export default function AdminIchingImagesPage() {
  const [images, setImages] = useState<ImagesMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/iching-images", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/iching-images";
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
    const res = await fetch("/api/admin/iching-images", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: next }),
    });
    if (!res.ok) {
      const j = (await res.json()) as { detail?: string; error?: string };
      throw new Error(j.detail ?? j.error ?? `HTTP ${res.status}`);
    }
  };

  const handleUpload = async (num: number, file: File) => {
    const slotId = String(num);
    setBusySlot(slotId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "iching-images");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      fd.append("filename", `hex_${num}_${Date.now()}.${ext}`);

      const upRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!upRes.ok) {
        const j = (await upRes.json()) as { detail?: string };
        throw new Error(j.detail ?? `upload HTTP ${upRes.status}`);
      }
      const { url } = (await upRes.json()) as { url: string };

      const next = { ...images, [slotId]: url };
      await persist(next);
      setImages(next);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  };

  const handleRemove = async (num: number) => {
    const slotId = String(num);
    if (!confirm(`移除第 ${num} 卦的圖片？`)) return;
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

  // 八卦 (8 個 trigram) 跟 64 卦共用同一個 app_content row,
  // 只是 key 加 `trigram:` prefix(見 lib/ichingImages.ts)避免跟 1..64 數字 key 撞名。
  const handleTrigramUpload = async (code: string, file: File) => {
    const slotId = trigramImageKey(code);
    setBusySlot(slotId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "iching-images");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      fd.append("filename", `trigram_${code}_${Date.now()}.${ext}`);

      const upRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!upRes.ok) {
        const j = (await upRes.json()) as { detail?: string };
        throw new Error(j.detail ?? `upload HTTP ${upRes.status}`);
      }
      const { url } = (await upRes.json()) as { url: string };

      const next = { ...images, [slotId]: url };
      await persist(next);
      setImages(next);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  };

  const handleTrigramRemove = async (code: string) => {
    const slotId = trigramImageKey(code);
    const tg = trigramNames[code];
    if (!confirm(`移除「${tg.zh}」的圖片？`)) return;
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

  // 按上經 (1-30) / 下經 (31-64) 分兩組,跟 public 介紹頁排版一致,admin 看圖時更好對應
  const upper = hexagrams.filter((h) => h.number <= 30);
  const lower = hexagrams.filter((h) => h.number > 30);
  const sections = [
    { title: "上經（1–30）", items: upper },
    { title: "下經（31–64）", items: lower },
  ];

  const trigramEntries = Object.entries(trigramNames);
  const trigramFilledCount = trigramEntries.filter(
    ([code]) => images[trigramImageKey(code)]
  ).length;
  const hexFilledCount = Object.entries(images).filter(
    ([k, v]) => v && !k.startsWith("trigram:")
  ).length;

  return (
    <div className="min-h-screen">
      <Header />
      <main
        style={{
          paddingTop: 88,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 1200,
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
          易經 64 卦圖像管理
        </h1>
        <p style={{ fontSize: 12, color: "rgba(192,192,208,0.55)", marginBottom: 6 }}>
          每張圖建議用 1:1 或 4:5 比例的 JPG / PNG / WebP。沒上傳的卦在介紹頁會顯示卦象 Unicode 字元 + 靜態卦線占位,不會空白。
        </p>
        <p style={{ fontSize: 11, color: "rgba(212,168,85,0.7)", marginBottom: 24 }}>
          八卦速覽 {trigramFilledCount} / 8 · 64 卦 {hexFilledCount} / 64
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

        {/* 八卦速覽 — 8 個 trigram。圖像顯示邏輯跟 64 卦一致(9:14 直幅);
            空 slot 顯示 trigram unicode 符號(☰☷ etc.)幫助 admin 辨識。 */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, color: "#d4a855", marginBottom: 12 }}>八卦速覽（8 個）</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            {trigramEntries.map(([code, tg]) => {
              const slotId = trigramImageKey(code);
              const url = images[slotId];
              const isBusy = busySlot === slotId;
              return (
                <div key={code} className="mystic-card" style={{ padding: 10 }}>
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "9 / 14",
                      borderRadius: 8,
                      overflow: "hidden",
                      marginBottom: 8,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px dashed rgba(212,168,85,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={tg.zh}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <span style={{ fontSize: 72, color: "rgba(212,168,85,0.6)", lineHeight: 1 }}>
                        {tg.symbol}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#e8e8f0", textAlign: "center", marginBottom: 6 }}>
                    <div style={{ fontWeight: 600 }}>{tg.zh}</div>
                    <div style={{ fontSize: 10, color: "rgba(192,192,208,0.5)", marginTop: 2 }}>
                      {tg.en.split(" ")[0]}
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
                      {isBusy ? "…" : url ? "更換" : "上傳"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleTrigramUpload(code, f);
                          e.currentTarget.value = "";
                        }}
                        disabled={isBusy}
                        style={{ display: "none" }}
                      />
                    </label>
                    {url && (
                      <button
                        onClick={() => handleTrigramRemove(code)}
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

        {sections.map((sec) => (
          <section key={sec.title} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, color: "#d4a855", marginBottom: 12 }}>{sec.title}</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              {sec.items.map((h) => {
                const slotId = String(h.number);
                const url = images[slotId];
                const isBusy = busySlot === slotId;
                return (
                  <div key={h.number} className="mystic-card" style={{ padding: 10 }}>
                    {/* 9:14 直幅,跟前台 /iching/hexagrams 一致;contain 確保上傳圖不被裁。
                        未上傳時 placeholder 留白(顯示 hexagram unicode 字方便 admin 辨識), */}
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "9 / 14",
                        borderRadius: 8,
                        overflow: "hidden",
                        marginBottom: 8,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px dashed rgba(212,168,85,0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={h.nameZh}
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        // admin 端保留 unicode 字 — 方便辨識空 slot 對應哪個卦,
                        // 跟前台「不顯示 emoji 占位」是不同訴求。
                        <span style={{ fontSize: 56, color: "rgba(212,168,85,0.6)" }}>
                          {h.character}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#e8e8f0", textAlign: "center", marginBottom: 6 }}>
                      <div style={{ fontWeight: 600 }}>
                        {h.number}.{h.nameZh}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(192,192,208,0.5)", marginTop: 2 }}>
                        {h.nameEn.split(" ")[0]}
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
                        {isBusy ? "…" : url ? "更換" : "上傳"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(h.number, f);
                            e.currentTarget.value = "";
                          }}
                          disabled={isBusy}
                          style={{ display: "none" }}
                        />
                      </label>
                      {url && (
                        <button
                          onClick={() => handleRemove(h.number)}
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
  padding: "6px 10px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid rgba(212,168,85,0.3)",
  background: "rgba(212,168,85,0.06)",
  color: "#d4a855",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "inline-block",
};
