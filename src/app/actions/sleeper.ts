"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  getSleeperUserByUsername,
  getUserLeagues,
  getCurrentNflSeason,
  getLeagueRosters,
  getLeagueUsers,
  getAllPlayersMap,
  getNflState,
  sleeperPlayerDisplayName,
  SleeperNotFoundError,
  type SleeperLeague,
} from "@/lib/sleeper";
import {
  getNflverseRosters,
  getNflverseWeeklyStats,
  normalizeGsisId,
  normalizePlayerName,
  type NflverseRosterIndex,
  type NflverseWeeklyStat,
} from "@/lib/nflverse";

const FALLBACK_PLAYER_PRICE = 10;
const MIN_PLAYER_PRICE = 5;
const MAX_PLAYER_PRICE = 50;
const POINTS_TO_PRICE_FACTOR = 0.15;

// New players get a starting price shaped by how they actually performed last
// season (real PPR total), instead of everyone opening at the same flat price.
// A ~300-point season caps out near $50; a scoreless bench player floors at $5.
function priceFromSeasonPoints(totalPoints: number): number {
  const price = MIN_PLAYER_PRICE + totalPoints * POINTS_TO_PRICE_FACTOR;
  return Math.min(MAX_PLAYER_PRICE, Math.max(MIN_PLAYER_PRICE, price));
}

export async function lookupSleeperLeagues(username: string) {
  const trimmed = username.trim();
  if (!trimmed) {
    return { success: false as const, error: "Enter a Sleeper username." };
  }

  try {
    const [sleeperUser, season] = await Promise.all([
      getSleeperUserByUsername(trimmed),
      getCurrentNflSeason(),
    ]);
    const leagues = await getUserLeagues(sleeperUser.user_id, season);
    if (leagues.length === 0) {
      return {
        success: false as const,
        error: "No leagues found for that account this season.",
      };
    }
    return { success: true as const, sleeperUserId: sleeperUser.user_id, leagues };
  } catch (err) {
    if (err instanceof SleeperNotFoundError) {
      return { success: false as const, error: "No Sleeper user with that username." };
    }
    return { success: false as const, error: "Couldn't reach Sleeper right now. Try again." };
  }
}

export async function importLeague(
  sleeperUserId: string,
  username: string,
  league: SleeperLeague,
) {
  const authUser = await requireUser();

  try {
    const [rosters, leagueUsers, sleeperPlayersMap, nflState] = await Promise.all([
      getLeagueRosters(league.league_id),
      getLeagueUsers(league.league_id),
      getAllPlayersMap(), // used only to resolve sleeperPlayerId -> gsis_id below, never as content
      getNflState(),
    ]);

    // Best-effort: if any of this fails, players just fall back to Sleeper's own
    // name/team/position and the flat starting price, rather than blocking the import.
    let nflverseRosters: NflverseRosterIndex = {
      byGsisId: new Map(),
      byNormalizedName: new Map(),
    };
    let weeklyStatsByGsisId = new Map<string, NflverseWeeklyStat[]>();
    try {
      const [rosterData, statsData] = await Promise.all([
        getNflverseRosters(nflState.season),
        getNflverseWeeklyStats(nflState.previous_season),
      ]);
      nflverseRosters = rosterData;
      weeklyStatsByGsisId = statsData;
    } catch (err) {
      console.error("Couldn't load nflverse player data:", err);
    }

    function seasonTotalFor(gsisId: string | null | undefined): number | undefined {
      if (!gsisId) return undefined;
      const lines = weeklyStatsByGsisId.get(gsisId);
      if (!lines) return undefined;
      return lines.reduce((sum, l) => sum + l.pointsPpr, 0);
    }

    const usersById = new Map(leagueUsers.map((u) => [u.user_id, u]));

    const dbLeague = await prisma.league.upsert({
      where: { sleeperLeagueId: league.league_id },
      update: { name: league.name, season: league.season, totalRosters: league.total_rosters },
      create: {
        sleeperLeagueId: league.league_id,
        name: league.name,
        season: league.season,
        totalRosters: league.total_rosters,
      },
    });

    const rosterIdByOwner = new Map<number, string>();
    for (const roster of rosters) {
      const owner = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
      const dbRoster = await prisma.sleeperRoster.upsert({
        where: {
          leagueId_sleeperRosterId: {
            leagueId: dbLeague.id,
            sleeperRosterId: roster.roster_id,
          },
        },
        update: {
          sleeperOwnerId: roster.owner_id,
          displayName: owner?.display_name ?? `Team ${roster.roster_id}`,
          teamName: owner?.metadata?.team_name ?? null,
          avatarUrl: owner?.avatar ?? null,
        },
        create: {
          leagueId: dbLeague.id,
          sleeperRosterId: roster.roster_id,
          sleeperOwnerId: roster.owner_id,
          displayName: owner?.display_name ?? `Team ${roster.roster_id}`,
          teamName: owner?.metadata?.team_name ?? null,
          avatarUrl: owner?.avatar ?? null,
        },
      });
      rosterIdByOwner.set(roster.roster_id, dbRoster.id);
    }

    const weeklyStatRows: { playerId: string; season: string; week: number; pointsPpr: number }[] =
      [];

    for (const roster of rosters) {
      const rosterId = rosterIdByOwner.get(roster.roster_id)!;
      for (const sleeperPlayerId of roster.players ?? []) {
        // Sleeper's dump is used only to resolve which real player this is — via gsis_id when
        // Sleeper has it (only ~20% of players in practice, and sometimes whitespace-padded, so
        // always normalized before use), falling back to a normalized-name match against
        // nflverse's own roster otherwise. Never used as the content source itself.
        const sleeperMeta = sleeperPlayersMap[sleeperPlayerId];
        const rawGsisId = sleeperMeta?.gsis_id ? normalizeGsisId(sleeperMeta.gsis_id) : undefined;
        const fallbackName = sleeperMeta
          ? sleeperPlayerDisplayName(sleeperMeta, sleeperPlayerId)
          : sleeperPlayerId;

        // A normalized name can match more than one real player (e.g. two different active
        // NFL players are both named "Justin Jefferson"). When it does, prefer whichever
        // candidate's team matches Sleeper's own team for this player — Sleeper's team
        // assignment doesn't depend on gsis_id, so it's a reliable tiebreaker even for the
        // ~80% of players missing one. Ambiguous with no team match just takes the first
        // candidate, same as the old always-take-one behavior.
        const nameCandidates = nflverseRosters.byNormalizedName.get(
          normalizePlayerName(fallbackName),
        );
        const nflverseEntry =
          (rawGsisId ? nflverseRosters.byGsisId.get(rawGsisId) : undefined) ??
          (nameCandidates && nameCandidates.length > 1
            ? (nameCandidates.find((c) => c.team === sleeperMeta?.team) ?? nameCandidates[0])
            : nameCandidates?.[0]);

        const fullName = nflverseEntry?.fullName ?? fallbackName;
        const team = nflverseEntry?.team ?? sleeperMeta?.team ?? null;
        const position = nflverseEntry?.position ?? sleeperMeta?.position ?? "UNK";
        const headshotUrl = nflverseEntry?.headshotUrl ?? null;
        const resolvedGsisId = nflverseEntry?.gsisId ?? null;

        const seasonPoints = seasonTotalFor(resolvedGsisId);
        const startingPrice =
          seasonPoints !== undefined
            ? priceFromSeasonPoints(seasonPoints)
            : FALLBACK_PLAYER_PRICE;

        const player = await prisma.player.upsert({
          where: {
            leagueId_sleeperPlayerId: {
              leagueId: dbLeague.id,
              sleeperPlayerId,
            },
          },
          update: {
            fullName,
            team,
            position,
            headshotUrl,
            nflverseId: resolvedGsisId,
            rosterId,
          },
          create: {
            leagueId: dbLeague.id,
            sleeperPlayerId,
            nflverseId: resolvedGsisId,
            fullName,
            team,
            position,
            headshotUrl,
            rosterId,
            basePrice: startingPrice,
            currentPrice: startingPrice,
          },
        });

        for (const line of resolvedGsisId ? (weeklyStatsByGsisId.get(resolvedGsisId) ?? []) : []) {
          weeklyStatRows.push({
            playerId: player.id,
            season: nflState.previous_season,
            week: line.week,
            pointsPpr: line.pointsPpr,
          });
        }
      }
    }

    if (weeklyStatRows.length > 0) {
      await prisma.playerWeeklyStat.createMany({
        data: weeklyStatRows,
        skipDuplicates: true,
      });
    }

    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        sleeperUsername: username,
        sleeperUserId,
        activeLeagueId: dbLeague.id,
      },
    });

    return { success: true as const, leagueId: dbLeague.id };
  } catch (err) {
    console.error(err);
    return { success: false as const, error: "Couldn't import that league. Try again." };
  }
}
