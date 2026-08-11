import Link from "next/link";
import { EmptyStateCard } from "@/components/empty-state-card";
import { TeamBadge } from "@/components/matchup/team-badge";
import { RosterPlayerRow } from "@/components/matchup/roster-player-row";
import type { MatchupSide } from "@/components/matchup/types";

export function MatchupView({
  week,
  mine,
  opponent,
}: {
  week: number;
  mine: MatchupSide | null;
  opponent: MatchupSide | null;
}) {
  if (!mine) {
    return (
      <EmptyStateCard
        title="No matchup yet"
        description="This week's matchup will show up here once your league's schedule is set."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <Link
          href={`/matchup/team/${mine.sleeperRosterId}?from=matchup`}
          className="flex flex-col items-center gap-2"
        >
          <TeamBadge name={mine.rosterName} />
          <span className="max-w-24 truncate text-xs text-muted-foreground hover:text-foreground">
            {mine.rosterName}
          </span>
        </Link>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Week {week}</div>
          <div className="font-mono text-xl font-semibold text-foreground">
            {mine.totalPoints.toFixed(1)} – {(opponent?.totalPoints ?? 0).toFixed(1)}
          </div>
        </div>
        {opponent ? (
          <Link
            href={`/matchup/team/${opponent.sleeperRosterId}?from=matchup`}
            className="flex flex-col items-center gap-2"
          >
            <TeamBadge name={opponent.rosterName} />
            <span className="max-w-24 truncate text-xs text-muted-foreground hover:text-foreground">
              {opponent.rosterName}
            </span>
          </Link>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <TeamBadge name="?" />
            <span className="max-w-24 truncate text-xs text-muted-foreground">TBD</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
          Your starters
        </h3>
        <div className="flex flex-col divide-y divide-border/60">
          {mine.rows.map((row) => (
            <RosterPlayerRow key={row.sleeperPlayerId} row={row} />
          ))}
        </div>
      </div>

      {opponent && (
        <div className="rounded-lg border border-border bg-card">
          <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
            {opponent.rosterName}&apos;s starters
          </h3>
          <div className="flex flex-col divide-y divide-border/60">
            {opponent.rows.map((row) => (
              <RosterPlayerRow key={row.sleeperPlayerId} row={row} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
