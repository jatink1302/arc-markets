"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  setWeeklyStarter as executeSetWeeklyStarter,
  setBestLineup as executeSetBestLineup,
  LineupError,
} from "@/lib/lineup";

export async function setWeeklyStarter(
  leagueId: string,
  week: number,
  starterPickId: string,
  benchPickId: string,
) {
  const user = await requireUser();

  try {
    const result = await executeSetWeeklyStarter(
      user.id,
      leagueId,
      week,
      starterPickId,
      benchPickId,
    );
    revalidatePath(`/leagues/${leagueId}`);
    revalidatePath(`/leagues/${leagueId}/team/${result.memberId}`);
    return { success: true as const, ...result };
  } catch (err) {
    if (err instanceof LineupError) {
      return { success: false as const, error: err.message };
    }
    console.error(err);
    return { success: false as const, error: "Something went wrong setting that lineup." };
  }
}

export async function setBestLineup(leagueId: string, week: number) {
  const user = await requireUser();

  try {
    const result = await executeSetBestLineup(user.id, leagueId, week);
    revalidatePath(`/leagues/${leagueId}`);
    revalidatePath(`/leagues/${leagueId}/team/${result.memberId}`);
    return { success: true as const, ...result };
  } catch (err) {
    if (err instanceof LineupError) {
      return { success: false as const, error: err.message };
    }
    console.error(err);
    return { success: false as const, error: "Something went wrong setting your best lineup." };
  }
}
