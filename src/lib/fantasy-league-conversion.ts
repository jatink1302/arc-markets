import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getNflState, getSleeperLeagueSettings, getMatchups, type SleeperMatchup } from "@/lib/sleeper";
import { importLeague } from "@/app/actions/sleeper";
import { mapSleeperScoring, mapSleeperRosterPositions } from "@/lib/sleeper-conversion";
import { generateInviteCode } from "@/lib/fantasy-defaults";
import { SEASON_WEEKS } from "@/lib/fantasy-schedule";

export class ConversionError extends Error {}

// Weeks strictly before this one are "already played, real Sleeper result" — the rest
// (current + future) stay live-computed by Summit's own scoring engine, exactly like any
// organic native league. Mirrors buildSeasonScoringContext's own week-boundary math
// (src/lib/league-scoring-context.ts) so a converted league's "historical vs. live" split
// is identical at conversion time and at every later render.
function boundaryWeek(
  leagueSeason: string,
  liveState: { season: string; season_type: string; week: number },
): number {
  const isLiveSeason = leagueSeason === liveState.season;
  if (!isLiveSeason) return SEASON_WEEKS + 1; // a past/completed season — everything is historical
  const seasonInProgress = liveState.season_type === "regular" || liveState.season_type === "post";
  return seasonInProgress ? liveState.week : 1; // pre-kickoff — nothing has happened yet
}

export async function loadPreviewInputs(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.activeLeagueId) {
    throw new ConversionError("Connect a Sleeper league first.");
  }
  const league = await prisma.league.findUniqueOrThrow({ where: { id: user.activeLeagueId } });

  const existing = await prisma.fantasyLeague.findUnique({
    where: { sourceSleeperLeagueId: league.sleeperLeagueId },
  });
  if (existing) return { alreadyConverted: true as const, leagueId: existing.id };

  const [liveState, settings] = await Promise.all([
    getNflState(),
    getSleeperLeagueSettings(league.sleeperLeagueId),
  ]);

  const { scoring, limitations: scoringLimitations } = mapSleeperScoring(settings.scoring_settings);
  const { roster, limitations: rosterLimitations } = mapSleeperRosterPositions(settings.roster_positions);
  const leagueType: "REDRAFT" | "DYNASTY" = settings.settings.type === 2 ? "DYNASTY" : "REDRAFT";

  const realRegularSeasonWeeks = settings.settings.playoff_week_start - 1;
  const weeksToImport = Math.min(realRegularSeasonWeeks, SEASON_WEEKS);
  const weekLimitations: string[] = [];
  if (realRegularSeasonWeeks > SEASON_WEEKS) {
    weekLimitations.push(
      `Your Sleeper league's regular season is ${realRegularSeasonWeeks} weeks — Summit only supports a ` +
        `${SEASON_WEEKS}-week schedule, so week${realRegularSeasonWeeks - SEASON_WEEKS > 1 ? "s" : ""} beyond ${SEASON_WEEKS} won't be imported.`,
    );
  }

  return {
    alreadyConverted: false as const,
    user,
    league,
    liveState,
    scoring,
    roster,
    leagueType,
    weeksToImport,
    limitations: [...scoringLimitations, ...rosterLimitations, ...weekLimitations],
  };
}

type MatchupPairing = {
  week: number;
  sleeperRosterIdA: number;
  sleeperRosterIdB: number | null;
  importedPointsA: number | null;
  importedPointsB: number | null;
};

export async function executeLeagueConversion(userId: string) {
  const inputs = await loadPreviewInputs(userId);
  if (inputs.alreadyConverted) {
    return { leagueId: inputs.leagueId, limitations: [] as string[] };
  }
  const { user, league, liveState, scoring, roster, leagueType, weeksToImport, limitations } = inputs;

  // Force-refresh System-1 data first so the players/rosters we import are current —
  // reuses the existing, working gsis_id/name-matching upserts verbatim rather than
  // duplicating that logic here.
  const refreshed = await importLeague(user.sleeperUserId!, user.sleeperUsername!, {
    league_id: league.sleeperLeagueId,
    name: league.name,
    season: league.season,
    total_rosters: league.totalRosters,
    avatar: null,
  });
  if (!refreshed.success) {
    throw new ConversionError("Couldn't refresh the Sleeper league's data. Try again.");
  }

  const sleeperRosters = await prisma.sleeperRoster.findMany({
    where: { leagueId: league.id },
    include: { players: true },
  });

  const importerRoster = sleeperRosters.find((r) => r.sleeperOwnerId === user.sleeperUserId);
  if (!importerRoster) {
    throw new ConversionError("Couldn't find your own team in this Sleeper league.");
  }

  const boundary = boundaryWeek(league.season, liveState);
  let importedPlayerCount = 0;
  let unresolvedPlayerCount = 0;

  // Fetch every regular-season week's real matchups up front (parallel), then group each
  // week by matchup_id: a pair is a real matchup, a lone entry is a bye — same convention
  // FantasyMatchup already uses for a generated round-robin's bye weeks.
  const weeklyMatchups = await Promise.all(
    Array.from({ length: weeksToImport }, (_, i) => i + 1).map((week) =>
      getMatchups(league.sleeperLeagueId, week)
        .then((m) => ({ week, matchups: m }))
        .catch(() => ({ week, matchups: [] as SleeperMatchup[] })),
    ),
  );

  const pairings: MatchupPairing[] = [];
  for (const { week, matchups } of weeklyMatchups) {
    const byMatchupId = new Map<number, SleeperMatchup[]>();
    for (const m of matchups) {
      if (m.matchup_id === null) continue;
      const group = byMatchupId.get(m.matchup_id) ?? [];
      group.push(m);
      byMatchupId.set(m.matchup_id, group);
    }
    const isHistorical = week < boundary;
    for (const group of byMatchupId.values()) {
      const [a, b] = group;
      pairings.push({
        week,
        sleeperRosterIdA: a.roster_id,
        sleeperRosterIdB: b ? b.roster_id : null,
        importedPointsA: isHistorical ? Number(a.points ?? 0) : null,
        importedPointsB: isHistorical && b ? Number(b.points ?? 0) : null,
      });
    }
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const leagueId = await prisma.$transaction(
        async (tx) => {
          const alreadyConverted = await tx.fantasyLeague.findUnique({
            where: { sourceSleeperLeagueId: league.sleeperLeagueId },
          });
          if (alreadyConverted) return alreadyConverted.id;

          const newLeague = await tx.fantasyLeague.create({
            data: {
              name: league.name,
              inviteCode: generateInviteCode(),
              status: "ACTIVE",
              season: league.season,
              leagueType,
              rosterSettings: roster,
              scoringSettings: scoring,
              sourceSleeperLeagueId: league.sleeperLeagueId,
              convertedAt: new Date(),
            },
          });

          // A real league's full player set is 150-250+ rows plus ~10 members and ~130+
          // matchups — one awaited create() per row blew well past Prisma's default 5s
          // transaction timeout. IDs are generated up front (crypto.randomUUID(), not
          // Prisma's own cuid default — any unique string works as a primary key) so the
          // member lookup map is known immediately, without a round trip per row, and
          // every table can be inserted with a single batched createMany.
          const memberIdBySleeperRosterId = new Map<number, string>();
          const memberRows = sleeperRosters.map((sr) => {
            const id = crypto.randomUUID();
            memberIdBySleeperRosterId.set(sr.sleeperRosterId, id);
            const isImporter = sr.id === importerRoster.id;
            return {
              id,
              leagueId: newLeague.id,
              userId: isImporter ? user.id : null,
              role: (isImporter ? "COMMISSIONER" : "MEMBER") as "COMMISSIONER" | "MEMBER",
              teamName: sr.teamName ?? sr.displayName,
              sleeperOwnerId: sr.sleeperOwnerId,
              sleeperRosterId: sr.sleeperRosterId,
            };
          });
          await tx.fantasyLeagueMember.createMany({ data: memberRows });

          let pickNo = 0;
          const pickRows: Prisma.FantasyDraftPickCreateManyInput[] = [];
          for (const sr of sleeperRosters) {
            const memberId = memberIdBySleeperRosterId.get(sr.sleeperRosterId)!;
            for (const player of sr.players) {
              pickNo += 1;
              if (!player.nflverseId) unresolvedPlayerCount += 1;
              importedPlayerCount += 1;
              pickRows.push({
                leagueId: newLeague.id,
                memberId,
                pickNo,
                round: null,
                source: "IMPORTED",
                nflverseId: player.nflverseId ?? player.sleeperPlayerId,
                playerName: player.fullName,
                playerTeam: player.team,
                playerPosition: player.position,
              });
            }
          }
          if (pickRows.length > 0) {
            await tx.fantasyDraftPick.createMany({ data: pickRows });
          }

          await tx.fantasyLeague.update({
            where: { id: newLeague.id },
            data: { currentPickNo: pickNo },
          });

          const matchupRows: Prisma.FantasyMatchupCreateManyInput[] = [];
          for (const p of pairings) {
            const memberAId = memberIdBySleeperRosterId.get(p.sleeperRosterIdA);
            const memberBId =
              p.sleeperRosterIdB !== null ? memberIdBySleeperRosterId.get(p.sleeperRosterIdB) : null;
            if (!memberAId) continue; // roster not in this league's current SleeperRoster set — skip defensively
            matchupRows.push({
              leagueId: newLeague.id,
              week: p.week,
              memberAId,
              memberBId: memberBId ?? null,
              importedPointsA: p.importedPointsA,
              importedPointsB: memberBId ? p.importedPointsB : null,
            });
          }
          if (matchupRows.length > 0) {
            await tx.fantasyMatchup.createMany({ data: matchupRows });
          }

          return newLeague.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 },
      );

      const finalLimitations = [...limitations];
      if (unresolvedPlayerCount > 0) {
        finalLimitations.push(
          `${unresolvedPlayerCount} of ${importedPlayerCount} imported players couldn't be matched to real player stats and will always score 0.`,
        );
      }
      return { leagueId, limitations: finalLimitations };
    } catch (err) {
      const isSerializationConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isSerializationConflict && attempt < MAX_RETRIES - 1) continue;
      throw err;
    }
  }
  throw new ConversionError("The league changed while converting — try again.");
}

export async function executeTeamClaim(userId: string, memberId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.sleeperUserId) {
    throw new ConversionError("Connect a Sleeper account first.");
  }

  const member = await prisma.fantasyLeagueMember.findUnique({ where: { id: memberId } });
  if (!member || member.userId !== null || member.sleeperOwnerId !== user.sleeperUserId) {
    throw new ConversionError("This team can't be claimed by your account.");
  }

  const alreadyInLeague = await prisma.fantasyLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId: member.leagueId, userId: user.id } },
  });
  if (alreadyInLeague) {
    throw new ConversionError("You're already a member of this league.");
  }

  await prisma.fantasyLeagueMember.update({
    where: { id: memberId },
    data: { userId: user.id },
  });

  return { leagueId: member.leagueId };
}
