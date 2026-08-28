"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  executeSetRosterSlot,
  executeUpdateTaxiIrCapacity,
  RosterSlotError,
} from "@/lib/roster-slot";

export async function setRosterSlot(
  leagueId: string,
  pickId: string,
  targetSlot: "ACTIVE" | "TAXI" | "IR",
) {
  const user = await requireUser();

  try {
    const result = await executeSetRosterSlot(user.id, leagueId, pickId, targetSlot);
    revalidatePath(`/leagues/${leagueId}`);
    return { success: true as const, ...result };
  } catch (err) {
    if (err instanceof RosterSlotError) {
      return { success: false as const, error: err.message };
    }
    console.error(err);
    return { success: false as const, error: "Something went wrong moving that player." };
  }
}

export async function updateTaxiIrCapacity(leagueId: string, taxi: number, ir: number) {
  const user = await requireUser();

  try {
    const result = await executeUpdateTaxiIrCapacity(user.id, leagueId, taxi, ir);
    revalidatePath(`/leagues/${leagueId}`);
    return result;
  } catch (err) {
    if (err instanceof RosterSlotError) {
      return { success: false as const, error: err.message };
    }
    console.error(err);
    return { success: false as const, error: "Something went wrong updating those limits." };
  }
}
