import { EmptyStateCard } from "@/components/empty-state-card";
import { TeamAvatar } from "@/components/matchup/team-avatar";
import { cn, shortSlot } from "@/lib/utils";
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
  logoUrl: string | null;
  starters: SeasonLineupPlayer[];
  totalPoints: number;
};

function TeamColumn({ side, align }: { side: SeasonMatchupSide; align: "left" | "right" }) {
  return (
    <div className={cn("flex flex-col gap-2", align === "right" ? "items-end text-right" : "items-start")}>
      <TeamAvatar sleeperRosterId={null} name={side.teamName} logoUrl={side.logoUrl} accent="positive" />
      <div className="min-w-0 max-w-20 sm:max-w-[130px]">
        <div className="truncate font-display text-sm tracking-wide text-positive sm:text-lg">
          {side.teamName}
        </div>
      </div>
    </div>
  );
}

// Compact by design, same reasoning as matchup-view.tsx's StarterHalf — packs two players
// plus a slot pill into one row width.
function StarterHalf({ player, align }: { player: SeasonLineupPlayer | null; align: "left" | "right" }) {
  if (!player) return <div />;
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <div className="truncate text-xs font-medium text-foreground sm:text-sm">{player.playerName}</div>
      <div className="truncate text-[10px] text-muted-foreground sm:text-xs">
        {player.playerPosition ?? "UNK"} · {player.playerTeam ?? "FA"}
        <span className="font-mono text-foreground"> · {player.points.toFixed(1)}</span>
      </div>
    </div>
  );
}

function PairedStarterRow({
  mine,
  opponent,
}: {
  mine: SeasonLineupPlayer | null;
  opponent: SeasonLineupPlayer | null;
}) {
  const slot = mine?.slot ?? opponent?.slot ?? "";
  return (
    <div className="grid grid-cols-[1fr_2.5rem_1fr] items-center gap-1.5 px-3 py-2.5 sm:grid-cols-[1fr_3rem_1fr] sm:gap-3 sm:px-4">
      <StarterHalf player={mine} align="left" />
      <span className="shrink-0 rounded-full border border-positive/40 px-1 py-0.5 text-center font-mono text-[9px] font-semibold uppercase tracking-wide text-positive sm:px-2 sm:text-[10px]">
        {slot ? shortSlot(slot) : "—"}
      </span>
      <StarterHalf player={opponent} align="right" />
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
  const rowCount = Math.max(mine?.starters.length ?? 0, opponent?.starters.length ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <WeekSelect basePath={`/leagues/${leagueId}`} week={week} seasonWeeks={seasonWeeks} />

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
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-3 sm:p-5">
            <div className="flex items-start justify-between gap-1 sm:gap-3">
              <TeamColumn side={mine} align="left" />

              <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pt-2">
                <svg
                  aria-hidden
                  viewBox="0 0 100 110"
                  className="pointer-events-none absolute inset-0 top-1/2 left-1/2 hidden h-32 w-32 -translate-x-1/2 -translate-y-1/2 text-foreground/10 sm:block"
                >
                  <path
                    d="M50 2 L94 18 V52 C94 82 74 100 50 108 C26 100 6 82 6 52 V18 Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                </svg>
                <span className="relative rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground sm:px-2.5 sm:text-[10px]">
                  Week {week}
                </span>
                <div className="relative whitespace-nowrap font-mono text-lg font-bold text-foreground sm:text-3xl">
                  {mine.totalPoints.toFixed(1)} – {opponent.totalPoints.toFixed(1)}
                </div>
              </div>

              <TeamColumn side={opponent} align="right" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card">
            <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-positive">
              Starters
            </h3>
            <div className="flex flex-col divide-y divide-border/60">
              {Array.from({ length: rowCount }, (_, i) => (
                <PairedStarterRow
                  key={`${mine.starters[i]?.slot ?? "x"}-${i}`}
                  mine={mine.starters[i] ?? null}
                  opponent={opponent.starters[i] ?? null}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
