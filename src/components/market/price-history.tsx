import { formatMoney } from "@/lib/utils";

type TradePoint = {
  id: string;
  price: number;
  createdAt: string;
  side: "BUY" | "SELL";
  quantity: number;
};

export function PriceHistory({ trades }: { trades: TradePoint[] }) {
  // Trades come newest-first; the chart reads left-to-right, oldest-first.
  const chronological = [...trades].reverse();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
        Recent trades
      </h2>

      {chronological.length > 1 && (
        <>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>${formatMoney(Math.min(...chronological.map((t) => t.price)))} low</span>
            <span>${formatMoney(Math.max(...chronological.map((t) => t.price)))} high</span>
          </div>
          <Sparkline prices={chronological.map((t) => t.price)} />
        </>
      )}

      {trades.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No trades yet — be the first.</p>
      ) : (
        <div className="mt-3 flex flex-col divide-y divide-border/60">
          {trades.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-1.5 text-sm">
              <span
                className={
                  "font-mono text-xs uppercase " +
                  (t.side === "BUY" ? "text-positive" : "text-negative")
                }
              >
                {t.side}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {t.quantity.toFixed(2)} @
              </span>
              <span className="font-mono text-sm text-foreground">${formatMoney(t.price)}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(t.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Sparkline({ prices }: { prices: number[] }) {
  const width = 280;
  const height = 56;
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
      className="mt-2 w-full"
      preserveAspectRatio="none"
      height={height}
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
