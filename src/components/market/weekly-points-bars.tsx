import { EmptyStateCard } from "@/components/empty-state-card";

export type WeeklyPoints = { week: number; points: number };

export function WeeklyPointsBars({
  title,
  games,
  emptyTitle,
  emptyDescription,
  summary,
}: {
  title: string;
  games: WeeklyPoints[];
  emptyTitle: string;
  emptyDescription: string;
  summary?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {summary && <span className="font-mono text-xs text-muted-foreground">{summary}</span>}
      </div>
      {games.length === 0 ? (
        <div className="mt-3">
          <EmptyStateCard title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        <Bars games={games} />
      )}
    </div>
  );
}

function Bars({ games }: { games: WeeklyPoints[] }) {
  const max = Math.max(...games.map((g) => g.points), 1);
  return (
    <div className="mt-4 flex items-end justify-between gap-2 overflow-x-auto">
      {games.map((g) => (
        <div key={g.week} className="flex min-w-8 flex-1 flex-col items-center gap-1.5">
          <span className="font-mono text-xs text-foreground">{g.points.toFixed(1)}</span>
          <div className="flex h-24 w-full items-end">
            <div
              className="w-full rounded-t bg-positive"
              style={{ height: `${(g.points / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] uppercase text-muted-foreground">W{g.week}</span>
        </div>
      ))}
    </div>
  );
}
