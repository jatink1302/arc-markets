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

  const rosterSettings = league.rosterSettings as unknown as RosterSettings;
  const scoringSettings = league.scoringSettings as unknown as ScoringSettings;

  const weekStats = hasStarted
    ? await getNflverseRawWeeklyStats(league.season).catch(
        () => new Map<string, NflverseRawWeekStat[]>(),
      )
    : new Map<string, NflverseRawWeekStat[]>();

  function lineupFor(memberId: string, week: number): WeeklyLineup {
    const picks = picksByMember.get(memberId) ?? [];
    return computeWeeklyLineup(
      picks.map((p) => ({
        id: p.id,
        nflverseId: p.nflverseId,
        playerName: p.playerName,
        playerTeam: p.playerTeam,
        playerPosition: p.playerPosition,
      })),
      rosterSettings,
      weekStats,
      week,
      scoringSettings,
    );
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
  };
}
