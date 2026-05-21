import type { CategoryCount } from "@/lib/admin/stats";
import { questionCategories } from "@/lib/divination";

interface Props {
  data: CategoryCount[];
  locale: "zh" | "en";
}

export default function CategoryBreakdown({ data, locale }: Props) {
  const total = data.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="mystic-card p-5">
      <h3 className="font-serif text-mystic-gold mb-1">
        {locale === "zh" ? "分類分布" : "Category Breakdown"}
      </h3>
      <p className="text-xs text-mystic-silver/60 mb-4">
        {locale === "zh" ? "過去 30 天" : "Last 30 days"}
      </p>

      {total === 0 ? (
        <p className="text-mystic-silver/50 text-sm py-8 text-center">
          {locale === "zh" ? "尚無資料" : "No data yet"}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {data.map((row) => {
            const cat = questionCategories.find((c) => c.id === row.category);
            const pct = total === 0 ? 0 : (row.count / total) * 100;
            return (
              <li key={row.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-2 text-mystic-silver/80">
                    <span>{cat?.icon ?? "❓"}</span>
                    <span>
                      {cat
                        ? locale === "zh"
                          ? cat.nameZh
                          : cat.nameEn
                        : row.category}
                    </span>
                  </span>
                  <span className="text-mystic-silver/60 tabular-nums">
                    {row.count}
                    <span className="ml-2 text-mystic-gold/70">
                      {pct.toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-mystic-dark/60 overflow-hidden border border-mystic-gold/10">
                  <div
                    className="h-full bg-gradient-to-r from-mystic-gold to-mystic-gold/40"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
