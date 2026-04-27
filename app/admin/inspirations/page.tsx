"use client";

/**
 * /admin/inspirations — 問題靈感題庫管理
 *
 * 後台用單一 form 編輯整顆題庫樹(catId → groups → questions)。
 * 每個欄位都是 4 語版本(zh / en / ja / ko)。儲存時整包 PUT 替換 DB。
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { questionCategories } from "@/lib/divination";
import {
  type InspirationGroup,
  type InspirationQuestion,
} from "@/data/questionInspirations";

type Tree = Record<string, InspirationGroup[]>;

const EMPTY_QUESTION: InspirationQuestion = { zh: "", en: "", ja: "", ko: "" };
const emptyGroup = (): InspirationGroup => ({
  titleZh: "",
  titleEn: "",
  titleJa: "",
  titleKo: "",
  questions: [{ ...EMPTY_QUESTION }],
});

export default function AdminInspirationsPage() {
  const [tree, setTree] = useState<Tree | null>(null);
  const [activeCat, setActiveCat] = useState<string>("love");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inspirations", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/inspirations";
        return;
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as {
        inspirations: Tree;
        source: string;
        updatedAt: string | null;
      };
      setTree(data.inspirations);
      setSource(data.source);
      setUpdatedAt(data.updatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── 變更操作:全部走 immutable update via setTree(prev) ──
  const updateGroupTitle = (
    catId: string,
    gi: number,
    field: "titleZh" | "titleEn" | "titleJa" | "titleKo",
    value: string,
  ) => {
    setTree((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const groups = [...(next[catId] ?? [])];
      groups[gi] = { ...groups[gi], [field]: value };
      next[catId] = groups;
      return next;
    });
  };

  const updateQuestionText = (
    catId: string,
    gi: number,
    qi: number,
    field: "zh" | "en" | "ja" | "ko",
    value: string,
  ) => {
    setTree((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const groups = [...(next[catId] ?? [])];
      const g = { ...groups[gi] };
      const questions = [...g.questions];
      questions[qi] = { ...questions[qi], [field]: value };
      g.questions = questions;
      groups[gi] = g;
      next[catId] = groups;
      return next;
    });
  };

  const addGroup = (catId: string) => {
    setTree((prev) => {
      if (!prev) return prev;
      const groups = [...(prev[catId] ?? []), emptyGroup()];
      return { ...prev, [catId]: groups };
    });
  };

  const deleteGroup = (catId: string, gi: number) => {
    if (!confirm("確定刪除此分組?(包含所有問句)")) return;
    setTree((prev) => {
      if (!prev) return prev;
      const groups = [...(prev[catId] ?? [])];
      groups.splice(gi, 1);
      return { ...prev, [catId]: groups };
    });
  };

  const addQuestion = (catId: string, gi: number) => {
    setTree((prev) => {
      if (!prev) return prev;
      const groups = [...(prev[catId] ?? [])];
      const g = { ...groups[gi] };
      g.questions = [...g.questions, { ...EMPTY_QUESTION }];
      groups[gi] = g;
      return { ...prev, [catId]: groups };
    });
  };

  const deleteQuestion = (catId: string, gi: number, qi: number) => {
    setTree((prev) => {
      if (!prev) return prev;
      const groups = [...(prev[catId] ?? [])];
      const g = { ...groups[gi] };
      const questions = [...g.questions];
      questions.splice(qi, 1);
      g.questions = questions;
      groups[gi] = g;
      return { ...prev, [catId]: groups };
    });
  };

  const handleSave = async () => {
    if (!tree) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inspirations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspirations: tree }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { detail?: string; error?: string };
        setError(j.detail ?? j.error ?? `HTTP ${res.status}`);
        return;
      }
      const j = (await res.json()) as { updatedAt: string };
      setUpdatedAt(j.updatedAt);
      setSource("db");
      alert("已儲存 ✓");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const groups = tree?.[activeCat] ?? [];

  return (
    <div className="min-h-screen">
      <Header />
      <main
        style={{
          paddingTop: 88,
          paddingBottom: 96,
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
          問題靈感管理
        </h1>
        <p style={{ fontSize: 12, color: "rgba(192,192,208,0.55)", marginBottom: 24 }}>
          資料來源:
          <span style={{ color: "#d4a855", marginLeft: 4 }}>
            {source === "db"
              ? "資料庫(已自訂)"
              : source.startsWith("static")
                ? "預設題庫(尚未自訂,儲存後 DB 為準)"
                : "—"}
          </span>
          {updatedAt && (
            <span style={{ marginLeft: 12 }}>
              最後更新:{new Date(updatedAt).toLocaleString("zh-TW")}
            </span>
          )}
        </p>

        {/* Category tabs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 8,
            marginBottom: 18,
          }}
        >
          {questionCategories.map((cat) => {
            const isActive = cat.id === activeCat;
            const count = (tree?.[cat.id] ?? []).reduce(
              (n, g) => n + g.questions.length,
              0,
            );
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                style={{
                  flexShrink: 0,
                  padding: "8px 14px",
                  borderRadius: 9999,
                  border: isActive
                    ? "1px solid rgba(212,168,85,0.7)"
                    : "1px solid rgba(255,255,255,0.1)",
                  background: isActive
                    ? "rgba(212,168,85,0.12)"
                    : "rgba(255,255,255,0.02)",
                  color: isActive ? "#d4a855" : "rgba(192,192,208,0.8)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ marginRight: 6 }}>{cat.icon}</span>
                {cat.nameZh}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: "rgba(192,192,208,0.5)",
                  }}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

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

        {/* Groups list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map((g, gi) => (
            <div
              key={gi}
              className="mystic-card"
              style={{ padding: 16, borderColor: "rgba(212,168,85,0.2)" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 12, color: "rgba(212,168,85,0.7)" }}>分組 #{gi + 1}</div>
                <button
                  onClick={() => deleteGroup(activeCat, gi)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    borderRadius: 6,
                    border: "1px solid rgba(248,113,113,0.4)",
                    background: "rgba(248,113,113,0.08)",
                    color: "#fca5a5",
                    cursor: "pointer",
                  }}
                >
                  刪除分組
                </button>
              </div>

              {/* Group titles — 4 langs */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div>
                  <label style={labelStyle}>標題(繁中)</label>
                  <input
                    value={g.titleZh}
                    onChange={(e) =>
                      updateGroupTitle(activeCat, gi, "titleZh", e.target.value)
                    }
                    placeholder="情感狀態與發展"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>標題(英)</label>
                  <input
                    value={g.titleEn}
                    onChange={(e) =>
                      updateGroupTitle(activeCat, gi, "titleEn", e.target.value)
                    }
                    placeholder="Relationship Status"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>標題(日)</label>
                  <input
                    value={g.titleJa ?? ""}
                    onChange={(e) =>
                      updateGroupTitle(activeCat, gi, "titleJa", e.target.value)
                    }
                    placeholder="関係の状態と進展"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>標題(韓)</label>
                  <input
                    value={g.titleKo ?? ""}
                    onChange={(e) =>
                      updateGroupTitle(activeCat, gi, "titleKo", e.target.value)
                    }
                    placeholder="관계 상태와 발전"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Questions list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {g.questions.map((q, qi) => (
                  <div
                    key={qi}
                    style={{
                      padding: 12,
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.015)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "rgba(192,192,208,0.5)" }}>
                        問句 #{qi + 1}
                      </div>
                      <button
                        onClick={() => deleteQuestion(activeCat, gi, qi)}
                        style={{
                          padding: "2px 8px",
                          fontSize: 10,
                          borderRadius: 4,
                          border: "1px solid rgba(248,113,113,0.3)",
                          background: "rgba(248,113,113,0.06)",
                          color: "#fca5a5",
                          cursor: "pointer",
                        }}
                      >
                        刪除
                      </button>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                      }}
                    >
                      <div>
                        <label style={labelStyle}>繁中</label>
                        <input
                          value={q.zh}
                          onChange={(e) =>
                            updateQuestionText(activeCat, gi, qi, "zh", e.target.value)
                          }
                          placeholder="他/她對我的真實想法是什麼?"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>英</label>
                        <input
                          value={q.en}
                          onChange={(e) =>
                            updateQuestionText(activeCat, gi, qi, "en", e.target.value)
                          }
                          placeholder="What does he/she really think of me?"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>日</label>
                        <input
                          value={q.ja ?? ""}
                          onChange={(e) =>
                            updateQuestionText(activeCat, gi, qi, "ja", e.target.value)
                          }
                          placeholder="彼/彼女は本当はどう思っている?"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>韓</label>
                        <input
                          value={q.ko ?? ""}
                          onChange={(e) =>
                            updateQuestionText(activeCat, gi, qi, "ko", e.target.value)
                          }
                          placeholder="그/그녀는 진심으로 어떻게 생각하나요?"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => addQuestion(activeCat, gi)}
                  style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px dashed rgba(212,168,85,0.4)",
                    background: "rgba(212,168,85,0.04)",
                    color: "#d4a855",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  + 新增問句
                </button>
              </div>
            </div>
          ))}

          {/* Add group at end of category */}
          <button
            onClick={() => addGroup(activeCat)}
            style={{
              padding: "12px",
              fontSize: 13,
              borderRadius: 10,
              border: "1px dashed rgba(212,168,85,0.5)",
              background: "rgba(212,168,85,0.04)",
              color: "#d4a855",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + 新增分組 (此分類)
          </button>
        </div>
      </main>

      {/* Sticky save bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(10,10,26,0.95)",
          borderTop: "1px solid rgba(212,168,85,0.2)",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "center",
          gap: 12,
          zIndex: 40,
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          onClick={handleSave}
          disabled={saving || !tree}
          className="btn-gold"
          style={{ padding: "10px 28px", fontSize: 14, opacity: saving ? 0.5 : 1 }}
        >
          {saving ? "儲存中…" : "💾 儲存全部變更"}
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: "rgba(192,192,208,0.55)",
  marginBottom: 3,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid rgba(212,168,85,0.25)",
  background: "rgba(13,13,43,0.6)",
  color: "#e8e8f0",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
