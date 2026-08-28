import "server-only";
import {
  projectedPointsForPlayer,
  FLEX_ELIGIBLE,
  SUPERFLEX_ELIGIBLE,
} from "@/lib/fantasy-scoring";
import type { buildSeasonScoringContext } from "@/lib/league-scoring-context";
import type {
  NflverseRosterIndex,
  NflverseScheduleEntry,
  NflverseWeeklyStat,
} from "@/lib/nflverse";
import type { StarterRow, BenchOption } from "@/app/(app)/leagues/[id]/starters-view";

type ScoringContext = Awaited<ReturnType<typeof buildSeasonScoringContext>>;

// Shared by the native league page's "My Team" tab (always the caller's own member) and the
// standalone /leagues/[id]/team/[memberId] page (read-only viewing of any member) — same
// schedule/eligibility/bench-option enrichment either way, only isOwner/isImportedWeek differ.
export function buildStarterRows({
  ctx,
  memberId,
  week,
  isOwner,
  isImportedWeek,
  nflverseRosters,
  schedule,
  previousSeasonStats,
  now,
}: {
  ctx: ScoringContext;
  memberId: string;
  week: number;
  isOwner: boolean;
  isImportedWeek: boolean;
  nflverseRosters: NflverseRosterIndex;
  schedule: Map<string, Map<number, NflverseScheduleEntry>>;
  previousSeasonStats: Map<string, NflverseWeeklyStat[]>;
  now: number;
}): StarterRow[] {
  const canEditLineup = isOwner && !isImportedWeek;

  function scheduleLabelFor(team: string | null): { label: string; locked: boolean } {
    if (!team) return { label: "FA", locked: false };
    const entry = schedule.get(team)?.get(week);
    if (!entry) return { label: "Bye", locked: false };
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    }).format(entry.kickoffAt);
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    }).format(entry.kickoffAt);
    return {
      label: `${weekday} ${time} ${entry.isHome ? "vs" : "@"} ${entry.opponent}`,
      locked: entry.kickoffAt.getTime() <= now,
    };
  }

  function isEligibleForSlot(position: string | null, slot: string): boolean {
    if (!position) return false;
    if (slot === "FLEX") return FLEX_ELIGIBLE.has(position);
    if (slot === "SUPERFLEX") return SUPERFLEX_ELIGIBLE.has(position);
    return position === slot;
  }

  const lineup = ctx.lineupFor(memberId, week);

  function benchOptionFor(pick: (typeof lineup.bench)[number]): BenchOption {
    return {
      pickId: pick.id,
      playerName: pick.playerName,
      playerTeam: pick.playerTeam,
      playerPosition: pick.playerPosition,
      headshotUrl: nflverseRosters.byGsisId.get(pick.nflverseId)?.headshotUrl ?? null,
      projectedPoints: projectedPointsForPlayer(pick.nflverseId, previousSeasonStats),
    };
  }

  // An imported week's real score came from Sleeper's own scoring rules, which Summit's
  // engine isn't guaranteed to reproduce exactly (see the FantasyMatchup schema comment) —
  // showing a Summit-recomputed lineup/per-player breakdown here would present a fabricated
  // "starters" list that might not be what was actually started, or sum to the real score.
  if (isImportedWeek) return [];

  return lineup.starters.map((s) => {
    const { label, locked } = scheduleLabelFor(s.playerTeam);
    const hasStats = ctx.weekStats.get(s.nflverseId)?.some((l) => l.week === week) ?? false;
    return {
      pickId: s.id,
      slot: s.slot,
      playerName: s.playerName,
      playerTeam: s.playerTeam,
      playerPosition: s.playerPosition,
      headshotUrl: nflverseRosters.byGsisId.get(s.nflverseId)?.headshotUrl ?? null,
      scheduleLabel: label,
      projectedPoints: projectedPointsForPlayer(s.nflverseId, previousSeasonStats),
      points: hasStats ? s.points : null,
      locked,
      benchOptions:
        canEditLineup && !locked
          ? lineup.bench
              .filter(
                (b) =>
                  isEligibleForSlot(b.playerPosition, s.slot) &&
                  !scheduleLabelFor(b.playerTeam).locked,
              )
              .map(benchOptionFor)
          : [],
    };
  });
}
