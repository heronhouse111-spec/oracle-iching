import type { AdminUserRow } from "@/lib/admin/stats";

interface Props {
  rows: AdminUserRow[];
  locale: "zh" | "en";
}

function formatDate(iso: string | null, locale: "zh" | "en"): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(
    locale === "zh" ? "zh-TW" : "en-US",
    { year: "2-digit", month: "2-digit", day: "2-digit" }
  );
}

export default function RecentUsers({ rows, locale }: Props) {
  return (
    <div className="mystic-card p-5">
      <h3 className="font-serif text-mystic-gold mb-1">
        {locale === "zh" ? "最新註冊用戶" : "Newest Users"}
      </h3>
      <p className="text-xs text-mystic-silver/60 mb-4">
        {locale === "zh" ? "最近 10 位" : "Last 10"}
      </p>

      {rows.length === 0 ? (
        <p className="text-mystic-silver/50 text-sm py-8 text-center">
          {locale === "zh" ? "尚無用戶" : "No users yet"}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 py-2 border-b border-mystic-gold/5 last:border-b-0"
            >
              <div className="w-8 h-8 rounded-full bg-mystic-gold/15 border border-mystic-gold/30 flex items-center justify-center text-mystic-gold text-xs font-bold shrink-0">
                {(u.display_name || u.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-mystic-silver/90 truncate">
                    {u.display_name || u.email || u.id.slice(0, 8)}
                  </p>
                  {u.is_admin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-mystic-gold/40 text-mystic-gold uppercase tracking-wider">
                      admin
                    </span>
                  )}
                </div>
                {u.display_name && u.email && (
                  <p className="text-xs text-mystic-silver/50 truncate">
                    {u.email}
                  </p>
                )}
              </div>
              <div className="text-xs text-mystic-silver/50 tabular-nums text-right shrink-0">
                {formatDate(u.signed_up_at, locale)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
