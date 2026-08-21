import { EmptyStateCard } from "@/components/empty-state-card";
import { TeamBadge } from "@/components/matchup/team-badge";
import { WeekSelect } from "./week-select";

export type SeasonLineupPlayer = {
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
  slot: string;
  points: number;
};

export type SeasonMatchupSide = {
  memberId: string;
  teamName: string;
  starters: SeasonLineupPlayer[];
  totalPoints: number;
};

function LineupCard({ title, players }: { title: string; players: SeasonLineupPlayer[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col divide-y divide-border/60">
        {players.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No starters.</p>
        ) : (
          players.map((p) => (
            <div
              key={`${p.slot}-${p.playerName}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{p.playerName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {p.slot} · {p.playerPosition ?? "UNK"} · {p.playerTeam ?? "FA"}
                </div>
              </div>
              <div className="shrink-0 font-mono text-sm text-foreground">
                {p.points.toFixed(1)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SeasonMatchupView({
  leagueId,
  week,
  seasonWeeks,
  hasStarted,
  mine,
  opponent,
}: {
  leagueId: string;
  week: number;
  seasonWeeks: number;
  hasStarted: boolean;
  mine: SeasonMatchupSide | null;
  opponent: SeasonMatchupSide | null; // null = bye week (only meaningful when mine is set)
}) {
  return (
    <div className="flex flex-col gap-4">
      <WeekSelect leagueId={leagueId} week={week} seasonWeeks={seasonWeeks} />

      {!hasStarted ? (
        <EmptyStateCard
          title="Season hasn't started yet"
          description="Real scores show up here automatically once games are played."
        />
      ) : !mine ? (
        <EmptyStateCard
          title="No matchup found"
          description="Something's off with the schedule for this week."
        />
      ) : !opponent ? (
        <EmptyStateCard
          title="Bye week"
          description={`${mine.teamName} doesn't play in week ${week}.`}
        />
      ) : (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col items-center gap-2 justify-self-start">
              <TeamBadge name={mine.teamName} />
              <span className="max-w-20 truncate text-xs text-muted-foreground">
                {mine.teamName}
              </span>
            </div>
            <div className="text-center">
              <div className="text-xs whitespace-nowrap uppercase tracking-wide text-muted-foreground">
                Week {week}
              </div>
              <div className="whitespace-nowrap font-mono text-lg font-semibold text-foreground">
                {mine.totalPoints.toFixed(1)} – {opponent.totalPoints.toFixed(1)}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 justify-self-end">
              <TeamBadge name={opponent.teamName} />
              <span className="max-w-20 truncate text-xs text-muted-foreground">
                {opponent.teamName}
              </span>
            </div>
          </div>

          <LineupCard title="Your starters" players={mine.starters} />
          <LineupCard title={`${opponent.teamName}'s starters`} players={opponent.starters} />
        </>
      )}
    </div>
  );
}
