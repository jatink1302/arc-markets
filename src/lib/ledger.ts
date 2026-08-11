import "server-only";
import { prisma } from "@/lib/prisma";
import { quoteBuy, quoteSell } from "@/lib/amm";
import { Prisma } from "@/generated/prisma/client";

export const STARTING_BALANCE = 10_000;

export class TradeError extends Error {}

/** A user's cash balance is never stored — always the sum of their CASH ledger entries. */
export async function getBalance(userId: string): Promise<number> {
  const result = await prisma.ledgerEntry.aggregate({
    where: { userId, type: "CASH" },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

export async function getPositions(userId: string) {
  return prisma.position.findMany({
    where: { userId, quantity: { gt: 0 } },
    include: { player: true },
    orderBy: { updatedAt: "desc" },
  });
}

/** Creates the app-side User row and grants the starting play-money balance. Idempotent. */
export async function ensureUserSeeded(userId: string, email: string) {
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email },
  });

  const existingSeed = await prisma.ledgerEntry.findFirst({
    where: { userId, note: "signup-seed" },
  });
  if (existingSeed) return;

  await prisma.ledgerEntry.create({
    data: {
      userId,
      type: "CASH",
      amount: STARTING_BALANCE,
      note: "signup-seed",
    },
  });
}

export async function executeTrade(
  userId: string,
  playerId: string,
  side: "BUY" | "SELL",
  quantity: number,
) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new TradeError("Quantity must be a positive number.");
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const player = await tx.player.findUniqueOrThrow({
            where: { id: playerId },
          });
          const curve = {
            basePrice: Number(player.basePrice),
            slope: Number(player.slope),
            supply: player.supply,
          };

          const quote =
            side === "BUY" ? quoteBuy(curve, quantity) : quoteSell(curve, quantity);
          const supplyAfter =
            side === "BUY" ? player.supply + quantity : player.supply - quantity;

          if (side === "BUY") {
            const balance = await tx.ledgerEntry.aggregate({
              where: { userId, type: "CASH" },
              _sum: { amount: true },
            });
            if (Number(balance._sum.amount ?? 0) < quote.amount) {
              throw new TradeError("Insufficient balance for this trade.");
            }
          } else {
            const position = await tx.position.findUnique({
              where: { userId_playerId: { userId, playerId } },
            });
            if (!position || Number(position.quantity) < quantity) {
              throw new TradeError("You don't hold enough contracts to sell that many.");
            }
          }

          const trade = await tx.trade.create({
            data: {
              userId,
              playerId,
              side,
              quantity,
              price: quote.avgPrice,
              totalAmount: quote.amount,
              priceBefore: Number(player.currentPrice),
              priceAfter: quote.priceAfter,
            },
          });

          const cashDelta = side === "BUY" ? -quote.amount : quote.amount;
          const positionDelta = side === "BUY" ? quantity : -quantity;

          await tx.ledgerEntry.createMany({
            data: [
              {
                userId,
                type: "CASH",
                amount: cashDelta,
                tradeId: trade.id,
              },
              {
                userId,
                type: "POSITION",
                playerId,
                amount: positionDelta,
                tradeId: trade.id,
              },
            ],
          });

          await tx.player.update({
            where: { id: playerId },
            data: { supply: supplyAfter, currentPrice: quote.priceAfter },
          });

          const costBasisDelta = side === "BUY" ? quote.amount : -quote.amount;
          await tx.position.upsert({
            where: { userId_playerId: { userId, playerId } },
            create: {
              userId,
              playerId,
              quantity: positionDelta,
              costBasis: costBasisDelta,
            },
            update: {
              quantity: { increment: positionDelta },
              costBasis: { increment: costBasisDelta },
            },
          });

          return trade;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      const isSerializationConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isSerializationConflict && attempt < MAX_RETRIES - 1) {
        continue;
      }
      if (isSerializationConflict) {
        throw new TradeError("Market moved while placing your trade — please try again.");
      }
      throw err;
    }
  }
  throw new TradeError("Market moved while placing your trade — please try again.");
}
