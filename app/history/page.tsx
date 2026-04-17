"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import HexagramDisplay from "@/components/HexagramDisplay";
import { getHexagramByNumber } from "@/data/hexagrams";
import { questionCategories } from "@/lib/divination";

interface Record {
  id: string;
  created_at: string;
  question: string;
  category: string;
  hexagram_number: number;
  changing_lines: number[];
  ai_reading: string;
  primary_lines: number[];
}

export default function HistoryPage() {
  const { locale, t } = useLanguage();
  const [records, setRecords] = useState<Record[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("divination_history");
    if (stored) setRecords(JSON.parse(stored));
    setIsLoading(false);
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <main style={{ paddingTop: 80, paddingBottom: 48, paddingLeft: 16, paddingRight: 16, maxWidth: 640, margin: "0 auto" }}>
        <h1 className="text-gold-gradient" style={{ fontSize: 24, fontFamily: "'Noto Serif TC', serif", textAlign: "center", marginBottom: 24 }}>
          {t("占卜紀錄", "Divination History")}
        </h1>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 48, color: "rgba(192,192,208,0.6)" }}>
            {t("載入中...", "Loading...")}
          </div>
        ) : records.length === 0 ? (
          <div className="mystic-card" style={{ padding: 48, textAlign: "center" }}>
            <span style={{ fontSize: 40, display: "block", marginBottom: 16 }}>🔮</span>
            <p style={{ color: "rgba(192,192,208,0.6)" }}>{t("尚無占卜紀錄", "No records yet")}</p>
            <a href="/" className="btn-gold" style={{ display: "inline-block", marginTop: 16, textDecoration: "none" }}>
              {t("開始第一次占卜", "Start your first divination")}
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {records.map((record) => {
              const hex = getHexagramByNumber(record.hexagram_number);
              const cat = questionCategories.find((c) => c.id === record.category);
              const isExpanded = expandedId === record.id;

              return (
                <motion.div key={record.id} layout className="mystic-card" style={{ overflow: "hidden" }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    style={{
                      width: "100%", padding: 16, display: "flex", alignItems: "center", gap: 16,
                      textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "white",
                    }}>
                    <div style={{ fontSize: 28 }}>{hex?.character}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{cat?.icon}</span>
                        <span style={{ color: "#d4a855", fontFamily: "'Noto Serif TC', serif", fontSize: 14 }}>
                          {locale === "zh" ? hex?.nameZh : hex?.nameEn}
                        </span>
                      </div>
                      <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>
                        {record.question}
                      </p>
                    </div>
                    <div style={{ color: "rgba(192,192,208,0.4)", fontSize: 12 }}>
                      {new Date(record.created_at).toLocaleDateString(locale === "zh" ? "zh-TW" : "en-US")}
                    </div>
                  </button>

                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      style={{ borderTop: "1px solid rgba(212,168,85,0.1)", padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                        <HexagramDisplay lines={record.primary_lines} changingLines={record.changing_lines} size="sm" animate={false} />
                      </div>
                      <div style={{ color: "rgba(192,192,208,0.8)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                        {record.ai_reading}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
