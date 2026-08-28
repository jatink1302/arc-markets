import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getNflState } from "@/lib/sleeper";
import { getNflverseSchedule, getNflverseWeeklyStats } from "@/lib/nflverse";
import {
  FLEX_ELIGIBLE,
  SUPERFLEX_ELIGIBLE,
  computeBestLineupPickIds,
  projectedPointsForPlayer,
} from "@/lib/fantasy-scoring";
import { buildSeasonScoringContext } from "@/lib/league-scoring-context";
import { SEASON_WEEKS } from "@/lib/fantasy-schedule";
import type { RosterSettings } from "@/lib/fantasy-defaults";

export class LineupError extends Error {}

const MAX_RETRIES = 3;

export async function setWeeklyStarter(
  userId: string,
  leagueId: string,
  week: number,
  starterPickId: string,
  benchPickId: string,
) {
  // Server Actions are callable directly (not just from this app's own UI, which always
  // passes an already-bounded week) — a crafted request could send anything, and TS types
  // aren't enforced at runtime, so this has to be checked here, not just upstream.
  if (!Number.isInteger(week) || week < 1 || week > SEASON_WEEKS) {
    throw new LineupError("That's not a valid week.");
  }
  if (starterPickId === benchPickId) {
    throw new LineupError("Pick a different player to swap in.");
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const league = await tx.fantasyLeague.findUniqueOrThrow({ where: { id: leagueId } });
          if (league.status !== "ACTIVE") {
            throw new LineupError("Lineups can only be set once the season is active.");
          }

          const member = await tx.fantasyLeagueMember.findUnique({
            where: { leagueId_userId: { leagueId, userId } },
          });
          if (!member) throw new LineupError("You're not a member of this league.");

          const matchup = await tx.fantasyMatchup.findFirst({
            where: { leagueId, week, OR: [{ memberAId: member.id }, { memberBId: member.id }] },
          });
          const importedPoints = matchup
            ? matchup.memberAId === member.id
              ? matchup.importedPointsA
              : matchup.importedPointsB
            : null;
          if (importedPoints !== null) {
            throw new LineupError("That week's score is already final — imported from Sleeper.");
          }

          const touchedPicks = await tx.fantasyDraftPick.findMany({
            where: {
              leagueId,
              memberId: member.id,
              droppedAt: null,
              id: { in: [starterPickId, benchPickId] },
            },
          });
          if (touchedPicks.length !== 2) {
            throw new LineupError("Both players must be on your current roster.");
          }
          const benchPick = touchedPicks.find((p) => p.id === benchPickId)!;

          const schedule = await getNflverseSchedule(league.season);
          const now = Date.now();
          function hasKickedOff(team: string | null): boolean {
            if (!team) return false;
            const entry = schedule.get(team)?.get(week);
            return entry ? entry.kickoffAt.getTime() <= now : false;
          }
          const startingPick = touchedPicks.find((p) => p.id === starterPickId)!;
          if (hasKickedOff(startingPick.playerTeam) || hasKickedOff(benchPick.playerTeam)) {
            throw new LineupError("That player's game has already started.");
          }

          // Recompute the member's current effective lineup the same way the display does —
          // display and mutation must share one resolution path, not two that can disagree.
          const allPicks = await tx.fantasyDraftPick.findMany({
            where: { leagueId, memberId: member.id, droppedAt: null },
          });
          const weeklyStarterRows = await tx.fantasyWeeklyStarter.findMany({
            where: { leagueId, memberId: member.id },
          });
          const liveState = await getNflState();
          const ctx = await buildSeasonScoringContext(
            {
              season: league.season,
              picks: allPicks,
              rosterSettings: league.rosterSettings,
              scoringSettings: league.scoringSettings,
              weeklyStarters: weeklyStarterRows.map((w) => ({
                memberId: w.memberId,
                week: w.week,
                pickId: w.pickId,
              })),
            },
            liveState,
          );
          const currentLineup = ctx.lineupFor(member.id, week);
          const currentStarter = currentLineup.starters.find((s) => s.id === starterPickId);
          const isCurrentlyBenched = currentLineup.bench.some((b) => b.id === benchPickId);
          if (!currentStarter || !isCurrentlyBenched) {
            throw new LineupError("That swap is no longer valid — try again.");
          }

          const eligible =
            currentStarter.slot === "FLEX"
              ? FLEX_ELIGIBLE.has(benchPick.playerPosition ?? "")
              : currentStarter.slot === "SUPERFLEX"
                ? SUPERFLEX_ELIGIBLE.has(benchPick.playerPosition ?? "")
                : benchPick.playerPosition === currentStarter.slot;
          if (!eligible) {
            throw new LineupError(`${benchPick.playerName} isn't eligible for that slot.`);
          }

          const existingRows = await tx.fantasyWeeklyStarter.findMany({
            where: { leagueId, memberId: member.id, week },
          });
          if (existingRows.length === 0) {
            // First edit for this week — seed a full snapshot of the resolved current lineup
            // before applying the delta, so a later trade/drop has a well-formed set to
            // auto-topoff against instead of a sparse partial one.
            await tx.fantasyWeeklyStarter.createMany({
              data: currentLineup.starters.map((s) => ({
                leagueId,
                memberId: member.id,
                week,
                pickId: s.id,
              })),
            });
          }

          await tx.fantasyWeeklyStarter.deleteMany({
            where: { leagueId, memberId: member.id, week, pickId: starterPickId },
          });
          await tx.fantasyWeeklyStarter.create({
            data: { leagueId, memberId: member.id, week, pickId: benchPickId },
          });

          return { memberId: member.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof LineupError) throw err;
      const isConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isConflict && attempt < MAX_RETRIES - 1) continue;
      if (isConflict) throw new LineupError("That didn't go through — try again.");
      throw err;
    }
  }
  throw new LineupError("That didn't go through — try again.");
}

// "Set Best Lineup": compute the highest-projected valid combination and set it as the
// week's explicit lineup, wholesale replacing whatever's currently set. A player whose game
// has already kicked off can never be moved by this — a currently-locked starter stays pinned
// (their slot's remaining capacity shrinks by one), a currently-locked bench player is
// excluded from consideration entirely (their game already happened without them; adding them
// after the fact would fabricate a decision that was never actually made in time). Only the
// unlocked portion of the roster gets re-optimized.
export async function setBestLineup(userId: string, leagueId: string, week: number) {
  if (!Number.isInteger(week) || week < 1 || week > SEASON_WEEKS) {
    throw new LineupError("That's not a valid week.");
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const league = await tx.fantasyLeague.findUniqueOrThrow({ where: { id: leagueId } });
          if (league.status !== "ACTIVE") {
            throw new LineupError("Lineups can only be set once the season is active.");
          }

          const member = await tx.fantasyLeagueMember.findUnique({
            where: { leagueId_userId: { leagueId, userId } },
          });
          if (!member) throw new LineupError("You're not a member of this league.");

          const matchup = await tx.fantasyMatchup.findFirst({
            where: { leagueId, week, OR: [{ memberAId: member.id }, { memberBId: member.id }] },
          });
          const importedPoints = matchup
            ? matchup.memberAId === member.id
              ? matchup.importedPointsA
              : matchup.importedPointsB
            : null;
          if (importedPoints !== null) {
            throw new LineupError("That week's score is already final — imported from Sleeper.");
          }

          const allPicks = await tx.fantasyDraftPick.findMany({
            where: { leagueId, memberId: member.id, droppedAt: null },
          });
          const weeklyStarterRows = await tx.fantasyWeeklyStarter.findMany({
            where: { leagueId, memberId: member.id },
          });
          const liveState = await getNflState();
          const ctx = await buildSeasonScoringContext(
            {
              season: league.season,
              picks: allPicks,
              rosterSettings: league.rosterSettings,
              scoringSettings: league.scoringSettings,
              weeklyStarters: weeklyStarterRows.map((w) => ({
                memberId: w.memberId,
                week: w.week,
                pickId: w.pickId,
              })),
            },
            liveState,
          );
          const currentLineup = ctx.lineupFor(member.id, week);

          const schedule = await getNflverseSchedule(league.season);
          const now = Date.now();
          function hasKickedOff(team: string | null): boolean {
            if (!team) return false;
            const entry = schedule.get(team)?.get(week);
            return entry ? entry.kickoffAt.getTime() <= now : false;
          }

          const lockedStarters = currentLineup.starters.filter((s) => hasKickedOff(s.playerTeam));
          const lockedStarterIds = new Set(lockedStarters.map((s) => s.id));
          const lockedBenchIds = new Set(
            currentLineup.bench.filter((b) => hasKickedOff(b.playerTeam)).map((b) => b.id),
          );

          const reducedSettings: RosterSettings = { ...ctx.rosterSettings };
          for (const s of lockedStarters) {
            const key = s.slot as keyof RosterSettings;
            reducedSettings[key] = Math.max(0, (reducedSettings[key] ?? 0) - 1);
          }

          const candidatePicks = allPicks
            .filter((p) => !lockedBenchIds.has(p.id) && !lockedStarterIds.has(p.id))
            .map((p) => ({
              id: p.id,
              pickNo: p.pickNo,
              nflverseId: p.nflverseId,
              playerName: p.playerName,
              playerTeam: p.playerTeam,
              playerPosition: p.playerPosition,
            }));

          const previousSeasonStats = await getNflverseWeeklyStats(liveState.previous_season);
          const projectedByGsisId = new Map<string, number>();
          for (const p of allPicks) {
            if (!projectedByGsisId.has(p.nflverseId)) {
              projectedByGsisId.set(
                p.nflverseId,
                projectedPointsForPlayer(p.nflverseId, previousSeasonStats),
              );
            }
          }

          const bestFillIds = computeBestLineupPickIds(
            candidatePicks,
            reducedSettings,
            projectedByGsisId,
          );
          const finalStarterIds = new Set([...lockedStarterIds, ...bestFillIds]);

          await tx.fantasyWeeklyStarter.deleteMany({
            where: { leagueId, memberId: member.id, week },
          });
          await tx.fantasyWeeklyStarter.createMany({
            data: Array.from(finalStarterIds).map((pickId) => ({
              leagueId,
              memberId: member.id,
              week,
              pickId,
            })),
          });

          return { memberId: member.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof LineupError) throw err;
      const isConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isConflict && attempt < MAX_RETRIES - 1) continue;
      if (isConflict) throw new LineupError("That didn't go through — try again.");
      throw err;
    }
  }
  throw new LineupError("That didn't go through — try again.");
}
