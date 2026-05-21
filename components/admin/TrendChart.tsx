import type { DailyPoint } from "@/lib/admin/stats";

interface TrendChartProps {
  data: DailyPoint[];
  title: string;
  subtitle?: string;
}

/**
 * 無外部套件的純 SVG 折線 + 面積圖,用於每日占卜數。
 */
export default function TrendChart({ data, title, subtitle }: TrendChartProps) {
  const W = 640;
  const H = 200;
  const PAD_X = 28;
  const PAD_Y = 24;

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const stepX =
    data.length > 1 ? (W - PAD_X * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PAD_X + i * stepX;
    const y =
      PAD_Y + (H - PAD_Y * 2) * (1 - d.count / maxCount);
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${H - PAD_Y} L ${points[0].x.toFixed(1)} ${H - PAD_Y} Z`
      : "";

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map(
    (t) => PAD_Y + (H - PAD_Y * 2) * (1 - t)
  );

  // 只顯示 0 / 1/4 / 1/2 / 3/4 / 100% 的 X 軸標籤
  const labelIdxs =
    data.length > 0
      ? [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor((data.length * 3) / 4), data.length - 1]
      : [];

  return (
    <div className="mystic-card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-serif text-mystic-gold">{title}</h3>
          {subtitle && (
            <p className="text-xs text-mystic-silver/60 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="text-xs text-mystic-silver/50">
          max {maxCount}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
        role="img"
        aria-label={title}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridYs.map((y, i) => (
          <line
            key={i}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={y}
            y2={y}
            stroke="rgba(212,175,55,0.08)"
            strokeWidth={1}
          />
        ))}

        {areaPath && <path d={areaPath} fill="url(#trendFill)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#d4af37"
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2}
            fill="#f5e6a8"
            opacity={p.count > 0 ? 1 : 0.25}
          >
            <title>{`${p.date}: ${p.count}`}</title>
          </circle>
        ))}

        {labelIdxs.map((idx, i) => {
          const p = points[idx];
          if (!p) return null;
          const short = p.date.slice(5);
          return (
            <text
              key={i}
              x={p.x}
              y={H - 6}
              fontSize={10}
              textAnchor="middle"
              fill="rgba(230,230,230,0.45)"
            >
              {short}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
