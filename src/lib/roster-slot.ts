import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { activeRosterCap, type RosterSettings } from "@/lib/fantasy-defaults";

export class RosterSlotError extends Error {}

const MAX_RETRIES = 3;

const SLOT_LABEL: Record<"ACTIVE" | "TAXI" | "IR", string> = {
  ACTIVE: "active roster",
  TAXI: "taxi squad",
  IR: "IR",
};

// Member-facing move between Active/Taxi/IR. Deliberately has no kickoff-lock gate — the
// same "no per-week snapshot" characteristic already applies to executeDrop (free-agency.ts)
// with no such guard there either, so gating only this action would be inconsistent without
// actually closing the loophole. A known, pre-existing rough edge, not this feature's to fix.
export async function executeSetRosterSlot(
  userId: string,
  leagueId: string,
  pickId: string,
  targetSlot: "ACTIVE" | "TAXI" | "IR",
) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const league = await tx.fantasyLeague.findUniqueOrThrow({ where: { id: leagueId } });
          if (league.status !== "ACTIVE") {
            throw new RosterSlotError("Roster moves are only available once the season has started.");
          }

          const member = await tx.fantasyLeagueMember.findUnique({
            where: { leagueId_userId: { leagueId, userId } },
          });
          if (!member) throw new RosterSlotError("You're not a member of this league.");

          const pick = await tx.fantasyDraftPick.findUnique({ where: { id: pickId } });
          if (!pick || pick.memberId !== member.id || pick.droppedAt) {
            throw new RosterSlotError("You can only move your own rostered players.");
          }

          if (pick.rosterSlot === targetSlot) {
            return { pickId };
          }

          // The pick is never already counted in the target slot (it's moving from a
          // different one), so unlike free agency there's no double-count risk to net out.
          const rosterSettings = league.rosterSettings as unknown as RosterSettings;
          const cap =
            targetSlot === "ACTIVE"
              ? activeRosterCap(rosterSettings)
              : (rosterSettings[targetSlot] ?? 0);
          const occupied = await tx.fantasyDraftPick.count({
            where: { leagueId, memberId: member.id, droppedAt: null, rosterSlot: targetSlot },
          });
          if (occupied >= cap) {
            throw new RosterSlotError(`Your ${SLOT_LABEL[targetSlot]} is full (${cap} slots).`);
          }

          await tx.fantasyDraftPick.update({
            where: { id: pickId },
            data: { rosterSlot: targetSlot },
          });

          return { pickId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof RosterSlotError) throw err;
      const isConflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isConflict && attempt < MAX_RETRIES - 1) continue;
      if (isConflict) throw new RosterSlotError("That didn't go through — try again.");
      throw err;
    }
  }
  throw new RosterSlotError("That didn't go through — try again.");
}

// Commissioner-only Taxi/IR capacity change. A narrow bypass of updateLeagueSettings's
// FORMING-only lock (fantasy-league.ts) — safe specifically because TAXI/IR are never
// referenced by STRICT_SLOTS/FLEX_ELIGIBLE/SUPERFLEX_ELIGIBLE in fantasy-scoring.ts, so
// changing their capacity can never retroactively alter any already-decided week's lineup
// math, only which slot a player currently sits in (a live-only concept).
export async function executeUpdateTaxiIrCapacity(
  userId: string,
  leagueId: string,
  taxi: number,
  ir: number,
) {
  if (!Number.isInteger(taxi) || taxi < 0 || taxi > 20) {
    throw new RosterSlotError("Taxi Squad capacity must be a whole number between 0 and 20.");
  }
  if (!Number.isInteger(ir) || ir < 0 || ir > 20) {
    throw new RosterSlotError("IR capacity must be a whole number between 0 and 20.");
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const member = await tx.fantasyLeagueMember.findUnique({
            where: { leagueId_userId: { leagueId, userId } },
          });
          if (!member || member.role !== "COMMISSIONER") {
            throw new RosterSlotError("Only the commissioner can edit league settings.");
          }

          const league = await tx.fantasyLeague.findUniqueOrThrow({ where: { id: leagueId } });
          if (league.status !== "ACTIVE") {
            throw new RosterSlotError("Use the league settings form before the draft starts.");
          }

          async function maxOccupied(slot: "TAXI" | "IR"): Promise<number> {
            const rows = await tx.fantasyDraftPick.groupBy({
              by: ["memberId"],
              where: { leagueId, droppedAt: null, rosterSlot: slot },
              _count: { _all: true },
            });
            return Math.max(0, ...rows.map((r) => r._count._all));
          }

          const maxTaxi = await maxOccupied("TAXI");
          if (taxi < maxTaxi) {
            throw new RosterSlotError(
              `At least one team has ${maxTaxi} players on Taxi — raise the limit or move players first.`,
            );
          }
          const maxIr = await maxOccupied("IR");
          if (ir < maxIr) {
            throw new RosterSlotError(
              `At least one team has ${maxIr} players on IR — raise the limit or move players first.`,
            );
          }

          const currentSettings = league.rosterSettings as unknown as RosterSettings;
          await tx.fantasyLeague.update({
            where: { id: leagueId },
            data: {
              rosterSettings: {
                ...currentSettings,
                TAXI: taxi,
                IR: ir,
              } as unknown as Prisma.InputJsonValue,
            },
          });

          return { success: true as const };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof RosterSlotError) throw err;
      const isConflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isConflict && attempt < MAX_RETRIES - 1) continue;
      if (isConflict) throw new RosterSlotError("That didn't go through — try again.");
      throw err;
    }
  }
  throw new RosterSlotError("That didn't go through — try again.");
}
