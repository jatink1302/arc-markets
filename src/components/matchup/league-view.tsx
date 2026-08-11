import Link from "next/link";
import { EmptyStateCard } from "@/components/empty-state-card";
import { TeamBadge } from "@/components/matchup/team-badge";
import type { StandingsRow, WeekMatchupPairing } from "@/components/matchup/types";

export function LeagueView({
  week,
  standings,
  pairings,
}: {
  week: number;
  standings: StandingsRow[];
  pairings: WeekMatchupPairing[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
          Standings
        </h3>
        <div className="flex flex-col divide-y divide-border/60">
          {standings.map((row, i) => (
            <Link
              key={row.sleeperRosterId}
              href={`/matchup/team/${row.sleeperRosterId}?from=league`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-secondary"
            >
              <div className="flex items-center gap-3">
                <span className="w-4 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <TeamBadge name={row.name} size="sm" />
                <span className="text-sm font-medium text-foreground">{row.name}</span>
              </div>
              <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
                <span>
                  {row.wins}-{row.losses}
                  {row.ties > 0 ? `-${row.ties}` : ""}
                </span>
                <span className="text-foreground">{row.pointsFor.toFixed(1)} PF</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
          Week {week} matchups
        </h3>
        {pairings.length === 0 ? (
          <div className="p-4">
            <EmptyStateCard
              title="No matchups yet"
              description="The weekly schedule hasn't been generated yet for this league."
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border/60">
            {pairings.map((p) => (
              <div key={p.matchupId} className="flex items-center justify-between px-4 py-2.5">
                <Link
                  href={`/matchup/team/${p.teamA.sleeperRosterId}?from=league`}
                  className="truncate text-sm text-foreground hover:underline"
                >
                  {p.teamA.name}
                </Link>
                <span className="font-mono text-sm text-muted-foreground">
                  {p.teamA.points.toFixed(1)} – {(p.teamB?.points ?? 0).toFixed(1)}
                </span>
                {p.teamB ? (
                  <Link
                    href={`/matchup/team/${p.teamB.sleeperRosterId}?from=league`}
                    className="truncate text-sm text-foreground hover:underline"
                  >
                    {p.teamB.name}
                  </Link>
                ) : (
                  <span className="truncate text-sm text-foreground">BYE</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
