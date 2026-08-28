import "server-only";
import type { NflverseRawWeekStat, NflverseWeeklyStat } from "@/lib/nflverse";
import type { RosterSettings, ScoringSettings } from "@/lib/fantasy-defaults";

export function computeFantasyPoints(stat: NflverseRawWeekStat, scoring: ScoringSettings): number {
  return (
    stat.passingTds * scoring.passingTd +
    stat.passingYards * scoring.passingYardsPerPoint +
    stat.passingInterceptions * scoring.interception +
    stat.rushingTds * scoring.rushingTd +
    stat.rushingYards * scoring.rushingYardsPerPoint +
    stat.receivingTds * scoring.receivingTd +
    stat.receivingYards * scoring.receivingYardsPerPoint +
    stat.receptions * scoring.reception +
    stat.fumblesLost * scoring.fumbleLost
  );
}

export type LineupPickInput = {
  id: string;
  pickNo: number;
  nflverseId: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
};

export type LineupPick = LineupPickInput & { points: number };

export type WeeklyLineup = {
  starters: (LineupPick & { slot: string })[];
  bench: LineupPick[];
  totalPoints: number;
};

// Exported for lineup.ts's swap validation — a bench player can only be swapped into a
// vacated slot if it's eligible for that slot's position rule, same rule the optimizer uses.
export const FLEX_ELIGIBLE = new Set(["RB", "WR", "TE"]);
export const SUPERFLEX_ELIGIBLE = new Set(["QB", "RB", "WR", "TE"]);
// Strict single-position slots — DEF included for completeness even though nflverse's
// player-level stats have no team-defense rows to score against (confirmed directly: no "DEF"
// position appears anywhere in stats_player_week), so a DEF pick just never scores — same
// graceful zero as any other bye/no-data week, not a special case to handle.
const STRICT_SLOTS: (keyof RosterSettings)[] = ["QB", "RB", "WR", "TE", "DEF", "K"];

// A member's lineup for a week: manually-chosen starters (see FantasyWeeklyStarter) take
// priority within each slot they're eligible for, filled in stable pickNo order so labels
// don't flicker based on that week's performance; any slot capacity left over — an unset
// week, or a manual starter that got traded/dropped since — auto-fills from the rest of the
// roster by that week's points, descending, exactly like the pre-manual-lineup behavior this
// degrades to when manualStarterPickIds is empty/undefined.
export function computeWeeklyLineup(
  picks: LineupPickInput[],
  rosterSettings: RosterSettings,
  weekStatsByGsisId: Map<string, NflverseRawWeekStat[]>,
  week: number,
  scoring: ScoringSettings,
  manualStarterPickIds?: Set<string>,
): WeeklyLineup {
  function pointsFor(nflverseId: string): number {
    const lines = weekStatsByGsisId.get(nflverseId);
    const line = lines?.find((l) => l.week === week);
    return line ? computeFantasyPoints(line, scoring) : 0;
  }

  const pool: LineupPick[] = picks.map((p) => ({ ...p, points: pointsFor(p.nflverseId) }));
  const remaining = new Set(pool.map((p) => p.id));
  const starters: (LineupPick & { slot: string })[] = [];

  function takeTop(eligible: (p: LineupPick) => boolean, count: number, slot: string) {
    const eligiblePool = pool.filter((p) => remaining.has(p.id) && eligible(p));
    const manual = eligiblePool
      .filter((p) => manualStarterPickIds?.has(p.id))
      .sort((a, b) => a.pickNo - b.pickNo);
    const rest = eligiblePool
      .filter((p) => !manualStarterPickIds?.has(p.id))
      .sort((a, b) => b.points - a.points);
    const candidates = [...manual, ...rest];
    for (let i = 0; i < count && i < candidates.length; i++) {
      starters.push({ ...candidates[i], slot });
      remaining.delete(candidates[i].id);
    }
  }

  for (const slot of STRICT_SLOTS) {
    takeTop((p) => p.playerPosition === slot, rosterSettings[slot], slot);
  }
  takeTop(
    (p) => !!p.playerPosition && FLEX_ELIGIBLE.has(p.playerPosition),
    rosterSettings.FLEX,
    "FLEX",
  );
  takeTop(
    (p) => !!p.playerPosition && SUPERFLEX_ELIGIBLE.has(p.playerPosition),
    rosterSettings.SUPERFLEX,
    "SUPERFLEX",
  );

  const bench = pool.filter((p) => remaining.has(p.id));
  const totalPoints = starters.reduce((sum, s) => sum + s.points, 0);

  return { starters, bench, totalPoints };
}

// "Set Best Lineup": the highest-projected combination from a candidate pool, filling a given
// slot capacity. Deliberately a separate, small function rather than a refactor of
// computeWeeklyLineup above — that function is already the more complex, thoroughly-tested
// one; a little duplication here is the safer trade against risking a regression in it. No
// manual-priority concept (this computes a fresh recommendation, not respecting an existing
// choice), and no real-points fallback (ranks purely by projection, the only honest basis for
// a week that hasn't been played yet). The caller (lib/lineup.ts) is responsible for excluding
// any locked (already-kicked-off) picks from `candidates` and reducing `slotsNeeded` by
// whatever's already pinned — this function just fills whatever capacity it's given.
export function computeBestLineupPickIds(
  candidates: LineupPickInput[],
  slotsNeeded: RosterSettings,
  projectedPointsByNflverseId: Map<string, number>,
): Set<string> {
  function projFor(nflverseId: string): number {
    return projectedPointsByNflverseId.get(nflverseId) ?? 0;
  }

  const remaining = new Set(candidates.map((p) => p.id));
  const chosen = new Set<string>();

  function takeTop(eligible: (p: LineupPickInput) => boolean, count: number) {
    const pool = candidates
      .filter((p) => remaining.has(p.id) && eligible(p))
      .sort((a, b) => projFor(b.nflverseId) - projFor(a.nflverseId));
    for (let i = 0; i < count && i < pool.length; i++) {
      chosen.add(pool[i].id);
      remaining.delete(pool[i].id);
    }
  }

  for (const slot of STRICT_SLOTS) {
    takeTop((p) => p.playerPosition === slot, slotsNeeded[slot] ?? 0);
  }
  takeTop(
    (p) => !!p.playerPosition && FLEX_ELIGIBLE.has(p.playerPosition),
    slotsNeeded.FLEX ?? 0,
  );
  takeTop(
    (p) => !!p.playerPosition && SUPERFLEX_ELIGIBLE.has(p.playerPosition),
    slotsNeeded.SUPERFLEX ?? 0,
  );

  return chosen;
}

// A simple, honest stand-in for real projections (this app has no such data source): a
// player's average PPR points per game from last season. Same heuristic already used for the
// Sleeper-connected Matchup card's team-level projection — extracted here as a pure function
// over pre-fetched stats so both surfaces share one implementation.
export function projectedPointsForPlayer(
  gsisId: string,
  weeklyStats: Map<string, NflverseWeeklyStat[]>,
): number {
  const lines = weeklyStats.get(gsisId);
  if (!lines || lines.length === 0) return 0;
  return lines.reduce((sum, l) => sum + l.pointsPpr, 0) / lines.length;
}

export type SeasonStandingsRow = {
  memberId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

// Sums every scheduled matchup's outcome through a given week into a standings table — pure
// function, takes a weekScoreFor callback so the caller decides how a member's total for a
// given week is computed (i.e. via computeWeeklyLineup above) without this function needing to
// know about rosters/stats/scoring settings itself.
export function computeSeasonStandings(
  memberIds: string[],
  matchups: { week: number; memberAId: string; memberBId: string | null }[],
  weekScoreFor: (memberId: string, week: number) => number,
  throughWeek: number,
): SeasonStandingsRow[] {
  const rows = new Map<string, SeasonStandingsRow>();
  for (const id of memberIds) {
    rows.set(id, { memberId: id, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 });
  }

  for (const m of matchups) {
    if (m.week > throughWeek || !m.memberBId) continue; // beyond current week, or a bye
    const rowA = rows.get(m.memberAId);
    const rowB = rows.get(m.memberBId);
    if (!rowA || !rowB) continue;

    const scoreA = weekScoreFor(m.memberAId, m.week);
    const scoreB = weekScoreFor(m.memberBId, m.week);
    rowA.pointsFor += scoreA;
    rowA.pointsAgainst += scoreB;
    rowB.pointsFor += scoreB;
    rowB.pointsAgainst += scoreA;

    if (scoreA > scoreB) {
      rowA.wins++;
      rowB.losses++;
    } else if (scoreB > scoreA) {
      rowB.wins++;
      rowA.losses++;
    } else {
      rowA.ties++;
      rowB.ties++;
    }
  }

  return Array.from(rows.values()).sort(
    (a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor,
  );
}
