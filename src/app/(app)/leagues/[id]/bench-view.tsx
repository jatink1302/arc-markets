import { PlayerAvatar } from "@/components/player-avatar";

export type BenchRow = {
  pickId: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
  headshotUrl: string | null;
  scheduleLabel: string;
  projectedPoints: number;
  points: number | null; // null = no real stats yet, shown as "-"
};

export function BenchView({ bench }: { bench: BenchRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
          Bench
        </h3>
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {bench.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No bench players.</p>
        ) : (
          bench.map((row) => (
            <div key={row.pickId} className="flex items-center gap-3 px-4 py-2.5">
              <PlayerAvatar headshotUrl={row.headshotUrl} name={row.playerName} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {row.playerName}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {row.playerPosition ?? "UNK"} · {row.scheduleLabel}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm text-foreground">
                  {row.points !== null ? row.points.toFixed(1) : "-"}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  Proj {row.projectedPoints.toFixed(1)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
