"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  ConversionError,
  loadPreviewInputs,
  executeLeagueConversion,
  executeTeamClaim,
} from "@/lib/fantasy-league-conversion";

export async function previewLeagueConversion() {
  const authUser = await requireUser();
  try {
    const result = await loadPreviewInputs(authUser.id);
    if (result.alreadyConverted) {
      return { success: true as const, alreadyConverted: true as const, leagueId: result.leagueId };
    }
    return {
      success: true as const,
      alreadyConverted: false as const,
      leagueName: result.league.name,
      teamCount: result.league.totalRosters,
      weeksToImport: result.weeksToImport,
      limitations: result.limitations,
    };
  } catch (err) {
    if (err instanceof ConversionError) return { success: false as const, error: err.message };
    console.error(err);
    return { success: false as const, error: "Couldn't preview the conversion. Try again." };
  }
}

export async function convertSleeperLeagueToNative() {
  const authUser = await requireUser();
  try {
    const { leagueId, limitations } = await executeLeagueConversion(authUser.id);
    revalidatePath("/leagues");
    return { success: true as const, leagueId, limitations };
  } catch (err) {
    if (err instanceof ConversionError) return { success: false as const, error: err.message };
    console.error(err);
    return { success: false as const, error: "Couldn't convert this league. Try again." };
  }
}

export async function claimFantasyTeam(memberId: string) {
  const authUser = await requireUser();
  try {
    const { leagueId } = await executeTeamClaim(authUser.id, memberId);
    revalidatePath("/leagues");
    revalidatePath(`/leagues/${leagueId}`);
    return { success: true as const, leagueId };
  } catch (err) {
    if (err instanceof ConversionError) return { success: false as const, error: err.message };
    console.error(err);
    return { success: false as const, error: "Couldn't claim this team. Try again." };
  }
}
