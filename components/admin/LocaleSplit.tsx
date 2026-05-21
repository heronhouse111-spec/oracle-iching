import type { LocaleCount } from "@/lib/admin/stats";

interface Props {
  data: LocaleCount[];
  locale: "zh" | "en";
}

const LOCALE_LABELS: Record<string, { zh: string; en: string; flag: string }> = {
  zh: { zh: "中文", en: "Chinese", flag: "🀄" },
  en: { zh: "英文", en: "English", flag: "🔤" },
};

export default function LocaleSplit({ data, locale }: Props) {
  const total = data.reduce((s, r) => s + r.count, 0);

  return (
    <div className="mystic-card p-5">
      <h3 className="font-serif text-mystic-gold mb-1">
        {locale === "zh" ? "語系分布" : "Locale Split"}
      </h3>
      <p className="text-xs text-mystic-silver/60 mb-4">
        {locale === "zh" ? "過去 30 天占卜請求" : "Last 30 days of requests"}
      </p>

      {total === 0 ? (
        <p className="text-mystic-silver/50 text-sm py-8 text-center">
          {locale === "zh" ? "尚無資料" : "No data yet"}
        </p>
      ) : (
        <>
          <div className="flex h-3 rounded-full overflow-hidden border border-mystic-gold/10">
            {data.map((row, i) => {
              const pct = (row.count / total) * 100;
              const bg =
                row.locale === "zh"
                  ? "bg-gradient-to-r from-mystic-gold to-mystic-gold/70"
                  : "bg-gradient-to-r from-emerald-400 to-emerald-400/60";
              return (
                <div
                  key={i}
                  className={bg}
                  style={{ width: `${pct}%` }}
                  title={`${row.locale}: ${row.count}`}
                />
              );
            })}
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {data.map((row) => {
              const lbl = LOCALE_LABELS[row.locale];
              const pct = (row.count / total) * 100;
              return (
                <li
                  key={row.locale}
                  className="flex items-center justify-between"
                >
                  <span className="text-mystic-silver/80 flex items-center gap-2">
                    <span>{lbl?.flag ?? "🌐"}</span>
                    <span>
                      {lbl
                        ? locale === "zh"
                          ? lbl.zh
                          : lbl.en
                        : row.locale.toUpperCase()}
                    </span>
                  </span>
                  <span className="text-mystic-silver/60 tabular-nums text-xs">
                    {row.count}
                    <span className="ml-2 text-mystic-gold/70">
                      {pct.toFixed(0)}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
