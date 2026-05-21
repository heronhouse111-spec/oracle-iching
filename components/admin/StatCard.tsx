interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: string;
  accent?: "gold" | "silver" | "rose" | "emerald";
}

const ACCENTS: Record<NonNullable<StatCardProps["accent"]>, string> = {
  gold: "from-mystic-gold/25 to-mystic-gold/0 border-mystic-gold/30",
  silver: "from-mystic-silver/20 to-mystic-silver/0 border-mystic-silver/30",
  rose: "from-rose-400/25 to-rose-400/0 border-rose-400/30",
  emerald: "from-emerald-400/25 to-emerald-400/0 border-emerald-400/30",
};

export default function StatCard({
  label,
  value,
  sublabel,
  icon,
  accent = "gold",
}: StatCardProps) {
  return (
    <div
      className={`mystic-card relative overflow-hidden p-5 border bg-gradient-to-br ${ACCENTS[accent]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-mystic-silver/60">
            {label}
          </p>
          <p className="mt-2 text-3xl font-serif text-gold-gradient leading-none">
            {value}
          </p>
          {sublabel && (
            <p className="mt-2 text-xs text-mystic-silver/60">{sublabel}</p>
          )}
        </div>
        {icon && <div className="text-3xl opacity-70">{icon}</div>}
      </div>
    </div>
  );
}
