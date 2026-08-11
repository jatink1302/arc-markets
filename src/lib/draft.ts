import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { totalRosterSlots, type RosterSettings } from "@/lib/fantasy-defaults";
import { currentRound, whoseTurnMemberId } from "@/lib/draft-order";
import { generateRoundRobinSchedule } from "@/lib/fantasy-schedule";

export class DraftError extends Error {}

export async function executeDraftPick(
  userId: string,
  leagueId: string,
  player: { nflverseId: string; name: string; team: string | null; position: string | null },
) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const league = await tx.fantasyLeague.findUniqueOrThrow({ where: { id: leagueId } });
          if (league.status !== "DRAFTING" || !league.draftOrder) {
            throw new DraftError("The draft isn't active.");
          }
          const draftOrder = league.draftOrder as string[];

          const member = await tx.fantasyLeagueMember.findUnique({
            where: { leagueId_userId: { leagueId, userId } },
          });
          if (!member) throw new DraftError("You're not a member of this league.");

          const expectedMemberId = whoseTurnMemberId(draftOrder, league.currentPickNo);
          if (expectedMemberId !== member.id) {
            throw new DraftError("It's not your turn.");
          }

          const alreadyPicked = await tx.fantasyDraftPick.findFirst({
            where: { leagueId, nflverseId: player.nflverseId },
          });
          if (alreadyPicked) throw new DraftError("That player has already been drafted.");

          const pickNo = league.currentPickNo + 1;
          const round = currentRound(league.currentPickNo, draftOrder.length) + 1;

          await tx.fantasyDraftPick.create({
            data: {
              leagueId,
              memberId: member.id,
              pickNo,
              round,
              nflverseId: player.nflverseId,
              playerName: player.name,
              playerTeam: player.team,
              playerPosition: player.position,
            },
          });

          const rosterSettings = league.rosterSettings as unknown as RosterSettings;
          const totalPicks = draftOrder.length * totalRosterSlots(rosterSettings);
          const isComplete = pickNo >= totalPicks;

          await tx.fantasyLeague.update({
            where: { id: leagueId },
            data: {
              currentPickNo: pickNo,
              status: isComplete ? "ACTIVE" : undefined,
            },
          });

          if (isComplete) {
            const schedule = generateRoundRobinSchedule(draftOrder);
            await tx.fantasyMatchup.createMany({
              data: schedule.map((m) => ({
                leagueId,
                week: m.week,
                memberAId: m.memberAId,
                memberBId: m.memberBId,
              })),
            });
          }

          return { pickNo, round, isComplete };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof DraftError) throw err;
      const isConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isConflict && attempt < MAX_RETRIES - 1) continue;
      if (isConflict) throw new DraftError("The draft moved — try again.");
      throw err;
    }
  }
  throw new DraftError("The draft moved — try again.");
}
