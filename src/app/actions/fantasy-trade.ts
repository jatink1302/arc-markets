"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";

export async function proposeTrade(
  leagueId: string,
  recipientMemberId: string,
  offeredPickIds: string[],
  requestedPickIds: string[],
) {
  const user = await requireUser();

  if (offeredPickIds.length === 0 || requestedPickIds.length === 0) {
    return { success: false as const, error: "Offer and request at least one player each." };
  }

  const league = await prisma.fantasyLeague.findUnique({ where: { id: leagueId } });
  if (!league) return { success: false as const, error: "League not found." };
  if (league.status !== "ACTIVE") {
    return { success: false as const, error: "Trades are only open once the season has started." };
  }

  const me = await prisma.fantasyLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
  });
  if (!me) return { success: false as const, error: "You're not a member of this league." };
  if (me.id === recipientMemberId) {
    return { success: false as const, error: "You can't trade with yourself." };
  }

  const recipient = await prisma.fantasyLeagueMember.findUnique({
    where: { id: recipientMemberId },
  });
  if (!recipient || recipient.leagueId !== leagueId) {
    return { success: false as const, error: "That team isn't in this league." };
  }

  const picks = await prisma.fantasyDraftPick.findMany({
    where: { id: { in: [...offeredPickIds, ...requestedPickIds] } },
  });
  const pickById = new Map(picks.map((p) => [p.id, p]));

  for (const id of offeredPickIds) {
    const pick = pickById.get(id);
    if (pick?.memberId !== me.id) {
      return { success: false as const, error: "You can only offer your own players." };
    }
    if (pick.droppedAt) {
      return { success: false as const, error: "One of those players has already been dropped." };
    }
  }
  for (const id of requestedPickIds) {
    const pick = pickById.get(id);
    if (pick?.memberId !== recipientMemberId) {
      return { success: false as const, error: "You can only request their players." };
    }
    if (pick.droppedAt) {
      return { success: false as const, error: "One of those players has already been dropped." };
    }
  }

  await prisma.fantasyTrade.create({
    data: {
      leagueId,
      proposerId: me.id,
      recipientId: recipientMemberId,
      items: {
        create: [
          ...offeredPickIds.map((pickId) => ({ pickId, fromMemberId: me.id })),
          ...requestedPickIds.map((pickId) => ({ pickId, fromMemberId: recipientMemberId })),
        ],
      },
    },
  });

  revalidatePath(`/leagues/${leagueId}`);
  return { success: true as const };
}

export async function respondToTrade(tradeId: string, accept: boolean) {
  const user = await requireUser();

  const trade = await prisma.fantasyTrade.findUnique({
    where: { id: tradeId },
    include: { items: true },
  });
  if (!trade) return { success: false as const, error: "Trade not found." };

  const me = await prisma.fantasyLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId: trade.leagueId, userId: user.id } },
  });
  if (!me || me.id !== trade.recipientId) {
    return { success: false as const, error: "Only the recipient can respond to this trade." };
  }
  if (trade.status !== "PENDING") {
    return { success: false as const, error: "This trade has already been resolved." };
  }

  if (!accept) {
    await prisma.fantasyTrade.update({
      where: { id: tradeId },
      data: { status: "REJECTED", respondedAt: new Date() },
    });
    revalidatePath(`/leagues/${trade.leagueId}`);
    return { success: true as const };
  }

  class StaleTradeError extends Error {}

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const freshTrade = await tx.fantasyTrade.findUniqueOrThrow({ where: { id: tradeId } });
          if (freshTrade.status !== "PENDING") {
            throw new StaleTradeError("This trade has already been resolved.");
          }

          for (const item of trade.items) {
            // Re-verify each player is still owned by whoever offered it and hasn't been
            // dropped since the trade was proposed — a concurrent free-agent drop/add on
            // the same player (or a re-trade) would otherwise let this silently produce
            // duplicate ownership of one real player across two members.
            const pick = await tx.fantasyDraftPick.findUniqueOrThrow({ where: { id: item.pickId } });
            if (pick.droppedAt || pick.memberId !== item.fromMemberId) {
              throw new StaleTradeError(
                "One of the players in this trade has changed hands since it was proposed — ask them to re-propose it.",
              );
            }
            const newOwnerId =
              item.fromMemberId === freshTrade.proposerId ? freshTrade.recipientId : freshTrade.proposerId;
            await tx.fantasyDraftPick.update({
              where: { id: item.pickId },
              data: { memberId: newOwnerId },
            });
          }

          await tx.fantasyTrade.update({
            where: { id: tradeId },
            data: { status: "ACCEPTED", respondedAt: new Date() },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      break;
    } catch (err) {
      if (err instanceof StaleTradeError) {
        return { success: false as const, error: err.message };
      }
      const isConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isConflict && attempt < MAX_RETRIES - 1) continue;
      if (isConflict) return { success: false as const, error: "That didn't go through — try again." };
      throw err;
    }
  }

  revalidatePath(`/leagues/${trade.leagueId}`);
  return { success: true as const };
}

export async function counterTrade(
  originalTradeId: string,
  offeredPickIds: string[],
  requestedPickIds: string[],
) {
  const user = await requireUser();

  if (offeredPickIds.length === 0 || requestedPickIds.length === 0) {
    return { success: false as const, error: "Offer and request at least one player each." };
  }

  const original = await prisma.fantasyTrade.findUnique({ where: { id: originalTradeId } });
  if (!original) return { success: false as const, error: "Trade not found." };

  const me = await prisma.fantasyLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId: original.leagueId, userId: user.id } },
  });
  if (!me || me.id !== original.recipientId) {
    return { success: false as const, error: "Only the recipient can counter this trade." };
  }
  if (original.status !== "PENDING") {
    return { success: false as const, error: "This trade has already been resolved." };
  }

  const league = await prisma.fantasyLeague.findUnique({ where: { id: original.leagueId } });
  if (!league || league.status !== "ACTIVE") {
    return { success: false as const, error: "Trades are only open once the season has started." };
  }

  // New proposer/recipient are the original trade's roles reversed.
  const newProposerId = original.recipientId;
  const newRecipientId = original.proposerId;

  const picks = await prisma.fantasyDraftPick.findMany({
    where: { id: { in: [...offeredPickIds, ...requestedPickIds] } },
  });
  const pickById = new Map(picks.map((p) => [p.id, p]));

  for (const id of offeredPickIds) {
    const pick = pickById.get(id);
    if (pick?.memberId !== newProposerId) {
      return { success: false as const, error: "You can only offer your own players." };
    }
    if (pick.droppedAt) {
      return { success: false as const, error: "One of those players has already been dropped." };
    }
  }
  for (const id of requestedPickIds) {
    const pick = pickById.get(id);
    if (pick?.memberId !== newRecipientId) {
      return { success: false as const, error: "You can only request their players." };
    }
    if (pick.droppedAt) {
      return { success: false as const, error: "One of those players has already been dropped." };
    }
  }

  class StaleTradeError extends Error {}

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const freshOriginal = await tx.fantasyTrade.findUniqueOrThrow({
            where: { id: originalTradeId },
          });
          if (freshOriginal.status !== "PENDING") {
            throw new StaleTradeError("This trade has already been resolved.");
          }

          await tx.fantasyTrade.update({
            where: { id: originalTradeId },
            data: { status: "COUNTERED", respondedAt: new Date() },
          });

          await tx.fantasyTrade.create({
            data: {
              leagueId: original.leagueId,
              proposerId: newProposerId,
              recipientId: newRecipientId,
              counteredFromId: originalTradeId,
              items: {
                create: [
                  ...offeredPickIds.map((pickId) => ({ pickId, fromMemberId: newProposerId })),
                  ...requestedPickIds.map((pickId) => ({ pickId, fromMemberId: newRecipientId })),
                ],
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      break;
    } catch (err) {
      if (err instanceof StaleTradeError) {
        return { success: false as const, error: err.message };
      }
      const isConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isConflict && attempt < MAX_RETRIES - 1) continue;
      if (isConflict) return { success: false as const, error: "That didn't go through — try again." };
      throw err;
    }
  }

  revalidatePath(`/leagues/${original.leagueId}`);
  return { success: true as const };
}

export async function cancelTrade(tradeId: string) {
  const user = await requireUser();

  const trade = await prisma.fantasyTrade.findUnique({ where: { id: tradeId } });
  if (!trade) return { success: false as const, error: "Trade not found." };

  const me = await prisma.fantasyLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId: trade.leagueId, userId: user.id } },
  });
  if (!me || me.id !== trade.proposerId) {
    return { success: false as const, error: "Only the proposer can cancel this trade." };
  }
  if (trade.status !== "PENDING") {
    return { success: false as const, error: "This trade has already been resolved." };
  }

  await prisma.fantasyTrade.update({
    where: { id: tradeId },
    data: { status: "CANCELLED", respondedAt: new Date() },
  });
  revalidatePath(`/leagues/${trade.leagueId}`);
  return { success: true as const };
}
