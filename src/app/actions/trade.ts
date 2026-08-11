"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { executeTrade, TradeError } from "@/lib/ledger";

export async function placeTrade(
  playerId: string,
  side: "BUY" | "SELL",
  quantity: number,
) {
  const user = await requireUser();

  try {
    const trade = await executeTrade(user.id, playerId, side, quantity);
    revalidatePath("/markets");
    revalidatePath(`/markets/${playerId}`);
    revalidatePath("/portfolio");
    revalidatePath("/matchup");

    return {
      success: true as const,
      trade: {
        id: trade.id,
        side: trade.side,
        quantity: Number(trade.quantity),
        price: Number(trade.price),
        totalAmount: Number(trade.totalAmount),
        priceAfter: Number(trade.priceAfter),
      },
    };
  } catch (err) {
    if (err instanceof TradeError) {
      return { success: false as const, error: err.message };
    }
    console.error(err);
    return { success: false as const, error: "Something went wrong placing that trade." };
  }
}
