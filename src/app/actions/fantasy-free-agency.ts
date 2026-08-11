"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { executeFreeAgentMove, executeDrop, FreeAgencyError } from "@/lib/free-agency";

export async function addFreeAgent(
  leagueId: string,
  player: { nflverseId: string; name: string; team: string | null; position: string | null },
  dropPickId?: string,
) {
  const user = await requireUser();

  try {
    const result = await executeFreeAgentMove(user.id, leagueId, player, dropPickId);
    revalidatePath(`/leagues/${leagueId}`);
    return { success: true as const, ...result };
  } catch (err) {
    if (err instanceof FreeAgencyError) {
      return { success: false as const, error: err.message };
    }
    console.error(err);
    return { success: false as const, error: "Something went wrong adding that player." };
  }
}

export async function dropPlayer(leagueId: string, pickId: string) {
  const user = await requireUser();

  try {
    const result = await executeDrop(user.id, leagueId, pickId);
    revalidatePath(`/leagues/${leagueId}`);
    return { success: true as const, ...result };
  } catch (err) {
    if (err instanceof FreeAgencyError) {
      return { success: false as const, error: err.message };
    }
    console.error(err);
    return { success: false as const, error: "Something went wrong dropping that player." };
  }
}
