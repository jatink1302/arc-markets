export function TickerHeader({
  tradesToday,
  volumeToday,
  season,
}: {
  tradesToday: number;
  volumeToday: number;
  season: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-4 py-2 text-xs">
      <span className="flex items-center gap-1.5 font-medium text-gold">
        <span className="animate-live-pulse h-1.5 w-1.5 rounded-full bg-gold" />
        Market open
      </span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">
        <span className="font-mono text-foreground">{tradesToday.toLocaleString()}</span> trades
        today
      </span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">
        <span className="font-mono text-foreground">
          $
          {volumeToday.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>{" "}
        volume today
      </span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">Season {season}</span>
    </div>
  );
}
