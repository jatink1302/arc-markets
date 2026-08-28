import "server-only";
import type { SleeperState } from "@/lib/sleeper";
import { getNflverseRawWeeklyStats, type NflverseRawWeekStat } from "@/lib/nflverse";
import { computeWeeklyLineup, type WeeklyLineup } from "@/lib/fantasy-scoring";
import { SEASON_WEEKS } from "@/lib/fantasy-schedule";
import type { RosterSettings, ScoringSettings } from "@/lib/fantasy-defaults";

type ScoringContextPick = {
  id: string;
  memberId: string;
  pickNo: number;
  round: number | null;
  nflverseId: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
  droppedAt: Date | null;
  rosterSlot: "ACTIVE" | "TAXI" | "IR";
};

type ScoringContextMatchup = {
  week: number;
  memberAId: string;
  memberBId: string | null;
  importedPointsA: number | null;
  importedPointsB: number | null;
};

type ScoringContextWeeklyStarter = {
  memberId: string;
  week: number;
  pickId: string;
};

// Shared by src/app/leagues/[id]/page.tsx (the Matchup tab) and the standalone
// team-schedule route — both need the same "what's everyone's roster scoring this week"
// setup. Two real call sites, unlike some one-off helpers deliberately not extracted
// during the free-agency pass.
export async function buildSeasonScoringContext(
  league: {
    season: string;
    picks: ScoringContextPick[];
    rosterSettings: unknown;
    scoringSettings: unknown;
    // Only present for a league converted from Sleeper (see
    // fantasy-league-conversion.ts) — omit entirely for an organic native league.
    matchups?: ScoringContextMatchup[];
    // Every FantasyWeeklyStarter row for the league — omit for a league with no manual
    // lineup selections yet, same "optional, empty means pure greedy" style as matchups.
    weeklyStarters?: ScoringContextWeeklyStarter[];
  },
  liveState: SleeperState,
) {
  const isLiveSeason = league.season === liveState.season;
  const seasonInProgress = liveState.season_type === "regular" || liveState.season_type === "post";
  const currentWeek = isLiveSeason ? (seasonInProgress ? liveState.week : 0) : SEASON_WEEKS;
  const hasStarted = currentWeek > 0;
  const clampedCurrentWeek = Math.min(Math.max(currentWeek, 1), SEASON_WEEKS);

  const activePicks = league.picks.filter((p) => !p.droppedAt);
  const picksByMember = new Map<string, ScoringContextPick[]>();
  for (const p of activePicks) {
    const list = picksByMember.get(p.memberId) ?? [];
    list.push(p);
    picksByMember.set(p.memberId, list);
  }

  // A narrower view of picksByMember for lineup purposes only — Taxi/IR picks stay in
  // activePicks/picksByMember (roster display, trades, free-agent exclusion all still need
  // them) but can never be a starter or bench-swap candidate, matching a real Sleeper league.
  const starterEligibleByMember = new Map<string, ScoringContextPick[]>();
  for (const p of activePicks) {
    if (p.rosterSlot !== "ACTIVE") continue;
    const list = starterEligibleByMember.get(p.memberId) ?? [];
    list.push(p);
    starterEligibleByMember.set(p.memberId, list);
  }

  // TAXI/IR default to 0 here (not just at the read site) because a league created before
  // this feature existed has a stored rosterSettings JSON blob genuinely missing those keys,
  // not zeroed — same precedent as SUPERFLEX before it. Normalizing once here means every
  // consumer of ctx.rosterSettings downstream can read .TAXI/.IR directly.
  const rawRosterSettings = league.rosterSettings as unknown as RosterSettings;
  const rosterSettings: RosterSettings = {
    ...rawRosterSettings,
    TAXI: rawRosterSettings.TAXI ?? 0,
    IR: rawRosterSettings.IR ?? 0,
  };
  const scoringSettings = league.scoringSettings as unknown as ScoringSettings;

  const weekStats = hasStarted
    ? await getNflverseRawWeeklyStats(league.season).catch(
        () => new Map<string, NflverseRawWeekStat[]>(),
      )
    : new Map<string, NflverseRawWeekStat[]>();

  // A member's manual set for week N carries forward to N+1, N+2, ... until they touch a
  // later week again — resolved at read time by walking backward to the nearest week with
  // any persisted rows, no scheduled job needed. See FantasyWeeklyStarter's schema comment.
  const manualStartersByMemberWeek = new Map<string, Map<number, Set<string>>>();
  for (const row of league.weeklyStarters ?? []) {
    const memberWeeks = manualStartersByMemberWeek.get(row.memberId) ?? new Map<number, Set<string>>();
    const set = memberWeeks.get(row.week) ?? new Set<string>();
    set.add(row.pickId);
    memberWeeks.set(row.week, set);
    manualStartersByMemberWeek.set(row.memberId, memberWeeks);
  }

  function resolveManualStarters(memberId: string, week: number): Set<string> | undefined {
    const memberWeeks = manualStartersByMemberWeek.get(memberId);
    if (!memberWeeks) return undefined;
    for (let w = week; w >= 1; w--) {
      const set = memberWeeks.get(w);
      if (set) return set;
    }
    return undefined;
  }

  function lineupFor(memberId: string, week: number): WeeklyLineup {
    const picks = starterEligibleByMember.get(memberId) ?? [];
    return computeWeeklyLineup(
      picks.map((p) => ({
        id: p.id,
        pickNo: p.pickNo,
        nflverseId: p.nflverseId,
        playerName: p.playerName,
        playerTeam: p.playerTeam,
        playerPosition: p.playerPosition,
      })),
      rosterSettings,
      weekStats,
      week,
      scoringSettings,
      resolveManualStarters(memberId, week),
    );
  }

  // Cached real Sleeper scores for a converted league's already-played weeks — see the
  // FantasyMatchup schema comment. Empty for an organic native league (matchups omitted).
  const cachedScoreByMemberWeek = new Map<string, number>();
  for (const m of league.matchups ?? []) {
    if (m.importedPointsA !== null) {
      cachedScoreByMemberWeek.set(`${m.memberAId}:${m.week}`, m.importedPointsA);
    }
    if (m.memberBId && m.importedPointsB !== null) {
      cachedScoreByMemberWeek.set(`${m.memberBId}:${m.week}`, m.importedPointsB);
    }
  }

  function weekScoreFor(memberId: string, week: number): number {
    const cached = cachedScoreByMemberWeek.get(`${memberId}:${week}`);
    return cached ?? lineupFor(memberId, week).totalPoints;
  }

  return {
    hasStarted,
    clampedCurrentWeek,
    activePicks,
    picksByMember,
    rosterSettings,
    scoringSettings,
    weekStats,
    lineupFor,
    weekScoreFor,
  };
}
