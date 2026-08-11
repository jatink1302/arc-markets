export function MiniSparkline({
  prices,
  width = 64,
  height = 24,
}: {
  prices: number[];
  width?: number;
  height?: number;
}) {
  if (prices.length < 2) {
    return <div style={{ width, height }} />;
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const trendingUp = prices[prices.length - 1] >= prices[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={trendingUp ? "var(--color-positive)" : "var(--color-negative)"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
