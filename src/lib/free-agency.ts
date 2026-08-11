import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { totalRosterSlots, type RosterSettings } from "@/lib/fantasy-defaults";

export class FreeAgencyError extends Error {}

const MAX_RETRIES = 3;

export async function executeFreeAgentMove(
  userId: string,
  leagueId: string,
  add: { nflverseId: string; name: string; team: string | null; position: string | null },
  dropPickId?: string,
) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const league = await tx.fantasyLeague.findUniqueOrThrow({ where: { id: leagueId } });
          if (league.status !== "ACTIVE") {
            throw new FreeAgencyError("Free agency is only open once the season has started.");
          }

          const member = await tx.fantasyLeagueMember.findUnique({
            where: { leagueId_userId: { leagueId, userId } },
          });
          if (!member) throw new FreeAgencyError("You're not a member of this league.");

          const alreadyRostered = await tx.fantasyDraftPick.findFirst({
            where: { leagueId, nflverseId: add.nflverseId, droppedAt: null },
          });
          if (alreadyRostered) throw new FreeAgencyError("That player is already rostered.");

          let dropPick = null;
          if (dropPickId) {
            dropPick = await tx.fantasyDraftPick.findUnique({ where: { id: dropPickId } });
            if (!dropPick || dropPick.memberId !== member.id || dropPick.droppedAt) {
              throw new FreeAgencyError("You can only drop your own rostered players.");
            }
          }

          const activeCount = await tx.fantasyDraftPick.count({
            where: { leagueId, memberId: member.id, droppedAt: null },
          });
          const rosterSettings = league.rosterSettings as unknown as RosterSettings;
          const cap = totalRosterSlots(rosterSettings);
          const projectedCount = activeCount - (dropPick ? 1 : 0) + 1;
          if (projectedCount > cap) {
            throw new FreeAgencyError(
              `Your roster is full (${cap} slots) — drop a player to make room.`,
            );
          }

          if (dropPick) {
            await tx.fantasyDraftPick.update({
              where: { id: dropPick.id },
              data: { droppedAt: new Date() },
            });
          }

          const pickNo = league.currentPickNo + 1;
          const created = await tx.fantasyDraftPick.create({
            data: {
              leagueId,
              memberId: member.id,
              pickNo,
              round: null,
              source: "FREE_AGENT",
              nflverseId: add.nflverseId,
              playerName: add.name,
              playerTeam: add.team,
              playerPosition: add.position,
            },
          });

          await tx.fantasyLeague.update({
            where: { id: leagueId },
            data: { currentPickNo: pickNo },
          });

          return { pickId: created.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof FreeAgencyError) throw err;
      const isConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isConflict && attempt < MAX_RETRIES - 1) continue;
      if (isConflict) throw new FreeAgencyError("That didn't go through — try again.");
      throw err;
    }
  }
  throw new FreeAgencyError("That didn't go through — try again.");
}

export async function executeDrop(userId: string, leagueId: string, pickId: string) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const league = await tx.fantasyLeague.findUniqueOrThrow({ where: { id: leagueId } });
          if (league.status !== "ACTIVE") {
            throw new FreeAgencyError("Free agency is only open once the season has started.");
          }

          const member = await tx.fantasyLeagueMember.findUnique({
            where: { leagueId_userId: { leagueId, userId } },
          });
          if (!member) throw new FreeAgencyError("You're not a member of this league.");

          const pick = await tx.fantasyDraftPick.findUnique({ where: { id: pickId } });
          if (!pick || pick.memberId !== member.id || pick.droppedAt) {
            throw new FreeAgencyError("You can only drop your own rostered players.");
          }

          await tx.fantasyDraftPick.update({
            where: { id: pickId },
            data: { droppedAt: new Date() },
          });

          return { pickId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof FreeAgencyError) throw err;
      const isConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isConflict && attempt < MAX_RETRIES - 1) continue;
      if (isConflict) throw new FreeAgencyError("That didn't go through — try again.");
      throw err;
    }
  }
  throw new FreeAgencyError("That didn't go through — try again.");
}
