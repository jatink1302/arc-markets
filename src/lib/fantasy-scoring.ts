import "server-only";
import type { NflverseRawWeekStat } from "@/lib/nflverse";
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

const FLEX_ELIGIBLE = new Set(["RB", "WR", "TE"]);
const SUPERFLEX_ELIGIBLE = new Set(["QB", "RB", "WR", "TE"]);
// Strict single-position slots — DEF included for completeness even though nflverse's
// player-level stats have no team-defense rows to score against (confirmed directly: no "DEF"
// position appears anywhere in stats_player_week), so a DEF pick just never scores — same
// graceful zero as any other bye/no-data week, not a special case to handle.
const STRICT_SLOTS: (keyof RosterSettings)[] = ["QB", "RB", "WR", "TE", "DEF", "K"];

// Greedy auto-lineup: no manual weekly lineup-setting in v1 (see plan) — each week, a member's
// highest-scoring valid lineup is assigned automatically, strict slots first (by that week's
// points, descending), then FLEX from what's left, then SUPERFLEX from what's left after that.
export function computeWeeklyLineup(
  picks: LineupPickInput[],
  rosterSettings: RosterSettings,
  weekStatsByGsisId: Map<string, NflverseRawWeekStat[]>,
  week: number,
  scoring: ScoringSettings,
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
    const candidates = pool
      .filter((p) => remaining.has(p.id) && eligible(p))
      .sort((a, b) => b.points - a.points);
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
