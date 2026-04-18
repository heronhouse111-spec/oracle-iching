import type { DivinationRow } from "@/lib/admin/stats";
import { getHexagramByNumber } from "@/data/hexagrams";
import { questionCategories } from "@/lib/divination";

interface Props {
  rows: DivinationRow[];
  locale: "zh" | "en";
}

function formatTime(iso: string, locale: "zh" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleString(locale === "zh" ? "zh-TW" : "en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecentDivinations({ rows, locale }: Props) {
  return (
    <div className="mystic-card p-5">
      <h3 className="font-serif text-mystic-gold mb-1">
        {locale === "zh" ? "最近 20 筆占卜" : "Recent 20 Divinations"}
      </h3>
      <p className="text-xs text-mystic-silver/60 mb-4">
        {locale === "zh"
          ? "依時間排序,顯示最新動態"
          : "Ordered by time, latest first"}
      </p>

      {rows.length === 0 ? (
        <p className="text-mystic-silver/50 text-sm py-8 text-center">
          {locale === "zh" ? "尚無占卜記錄" : "No divinations yet"}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-mystic-silver/50 border-b border-mystic-gold/10">
                <th className="py-2 pr-3 font-normal">
                  {locale === "zh" ? "時間" : "Time"}
                </th>
                <th className="py-2 pr-3 font-normal">
                  {locale === "zh" ? "分類" : "Category"}
                </th>
                <th className="py-2 pr-3 font-normal">
                  {locale === "zh" ? "卦象" : "Hexagram"}
                </th>
                <th className="py-2 pr-3 font-normal">
                  {locale === "zh" ? "問題" : "Question"}
                </th>
                <th className="py-2 pr-1 font-normal text-right">
                  {locale === "zh" ? "語系" : "Locale"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hex = getHexagramByNumber(r.hexagram_number);
                const cat = questionCategories.find((c) => c.id === r.category);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-mystic-gold/5 align-top"
                  >
                    <td className="py-2 pr-3 text-mystic-silver/60 text-xs whitespace-nowrap tabular-nums">
                      {formatTime(r.created_at, locale)}
                    </td>
                    <td className="py-2 pr-3 text-mystic-silver/80 text-xs whitespace-nowrap">
                      <span className="mr-1">{cat?.icon ?? "❓"}</span>
                      {cat
                        ? locale === "zh"
                          ? cat.nameZh
                          : cat.nameEn
                        : r.category}
                    </td>
                    <td className="py-2 pr-3 text-mystic-gold whitespace-nowrap">
                      <span className="mr-1.5 text-base">
                        {hex?.character ?? "?"}
                      </span>
                      <span className="text-xs text-mystic-silver/70">
                        {hex
                          ? locale === "zh"
                            ? hex.nameZh
                            : hex.nameEn.replace(/\s*\(.*\)$/, "")
                          : `#${r.hexagram_number}`}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-mystic-silver/80 text-xs max-w-[280px] truncate">
                      {r.question}
                    </td>
                    <td className="py-2 pr-1 text-right text-xs text-mystic-silver/50">
                      {r.locale?.toUpperCase() ?? "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
