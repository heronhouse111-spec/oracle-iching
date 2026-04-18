import type { HexagramCount } from "@/lib/admin/stats";
import { getHexagramByNumber } from "@/data/hexagrams";

interface Props {
  data: HexagramCount[];
  locale: "zh" | "en";
}

export default function TopHexagrams({ data, locale }: Props) {
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="mystic-card p-5">
      <h3 className="font-serif text-mystic-gold mb-1">
        {locale === "zh" ? "熱門卦象 Top 10" : "Top Hexagrams"}
      </h3>
      <p className="text-xs text-mystic-silver/60 mb-4">
        {locale === "zh" ? "過去 30 天" : "Last 30 days"}
      </p>

      {data.length === 0 ? (
        <p className="text-mystic-silver/50 text-sm py-8 text-center">
          {locale === "zh" ? "尚無資料" : "No data yet"}
        </p>
      ) : (
        <ol className="space-y-2">
          {data.map((row, i) => {
            const hex = getHexagramByNumber(row.hexagram_number);
            const pct = (row.count / maxCount) * 100;
            return (
              <li
                key={row.hexagram_number}
                className="flex items-center gap-3 text-sm"
              >
                <span className="w-5 text-mystic-silver/40 tabular-nums text-xs">
                  {i + 1}
                </span>
                <span className="text-xl w-6 text-center">
                  {hex?.character ?? "?"}
                </span>
                <span className="text-mystic-silver/80 w-16 shrink-0">
                  {hex
                    ? locale === "zh"
                      ? hex.nameZh
                      : hex.nameEn.replace(/\s*\(.*\)$/, "")
                    : `#${row.hexagram_number}`}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-mystic-dark/60 overflow-hidden border border-mystic-gold/10">
                  <div
                    className="h-full bg-gradient-to-r from-mystic-gold to-mystic-gold/30"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-mystic-silver/60 tabular-nums text-xs w-8 text-right">
                  {row.count}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
