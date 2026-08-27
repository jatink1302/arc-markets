"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getNflState } from "@/lib/sleeper";
import { Prisma } from "@/generated/prisma/client";
import { executeDraftPick, DraftError } from "@/lib/draft";
import {
  DEFAULT_ROSTER_SETTINGS,
  DEFAULT_SCORING_SETTINGS,
  generateInviteCode,
  MIN_LEAGUE_MEMBERS,
  MAX_LEAGUE_MEMBERS,
  type RosterSettings,
  type ScoringSettings,
} from "@/lib/fantasy-defaults";

export async function createLeague(
  name: string,
  leagueType: "REDRAFT" | "DYNASTY" = "REDRAFT",
) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return { success: false as const, error: "Enter a league name." };

  const state = await getNflState().catch(() => null);
  const season = state?.season ?? "2026";

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const league = await prisma.fantasyLeague.create({
        data: {
          name: trimmed,
          inviteCode: generateInviteCode(),
          season,
          leagueType,
          rosterSettings: DEFAULT_ROSTER_SETTINGS,
          scoringSettings: DEFAULT_SCORING_SETTINGS,
          members: { create: { userId: user.id, role: "COMMISSIONER" } },
        },
      });
      return { success: true as const, leagueId: league.id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        continue; // invite code collision — regenerate and retry
      }
      throw err;
    }
  }
  return { success: false as const, error: "Couldn't create the league. Try again." };
}

export async function joinLeague(inviteCode: string, teamName?: string) {
  const user = await requireUser();
  const code = inviteCode.trim().toUpperCase();
  if (!code) return { success: false as const, error: "Enter an invite code." };

  const league = await prisma.fantasyLeague.findUnique({
    where: { inviteCode: code },
    include: { members: true },
  });
  if (!league) return { success: false as const, error: "No league found with that code." };

  const alreadyMember = league.members.some((m) => m.userId === user.id);
  if (alreadyMember) return { success: true as const, leagueId: league.id };

  if (league.status !== "FORMING") {
    return { success: false as const, error: "This league has already started drafting." };
  }
  if (league.members.length >= MAX_LEAGUE_MEMBERS) {
    return { success: false as const, error: "This league is full." };
  }

  await prisma.fantasyLeagueMember.create({
    data: { leagueId: league.id, userId: user.id, teamName: teamName?.trim() || null },
  });
  revalidatePath(`/leagues/${league.id}`);

  return { success: true as const, leagueId: league.id };
}

export async function updateLeagueSettings(
  leagueId: string,
  rosterSettings: RosterSettings,
  scoringSettings: ScoringSettings,
  season: string,
) {
  const user = await requireUser();
  const trimmedSeason = season.trim();
  if (!trimmedSeason) return { success: false as const, error: "Enter a season." };

  const member = await prisma.fantasyLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
  });
  if (!member || member.role !== "COMMISSIONER") {
    return { success: false as const, error: "Only the commissioner can edit league settings." };
  }

  const league = await prisma.fantasyLeague.findUniqueOrThrow({ where: { id: leagueId } });
  if (league.status !== "FORMING") {
    return { success: false as const, error: "Settings lock once the draft starts." };
  }

  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: {
      rosterSettings: rosterSettings as unknown as Prisma.InputJsonValue,
      scoringSettings: scoringSettings as unknown as Prisma.InputJsonValue,
      season: trimmedSeason,
    },
  });
  revalidatePath(`/leagues/${leagueId}`);
  return { success: true as const };
}

export async function startDraft(leagueId: string) {
  const user = await requireUser();

  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    include: { members: true },
  });
  const member = league.members.find((m) => m.userId === user.id);
  if (!member || member.role !== "COMMISSIONER") {
    return { success: false as const, error: "Only the commissioner can start the draft." };
  }
  if (league.status !== "FORMING") {
    return { success: false as const, error: "The draft has already started." };
  }
  if (league.members.length < MIN_LEAGUE_MEMBERS) {
    return {
      success: false as const,
      error: `Need at least ${MIN_LEAGUE_MEMBERS} members to start (have ${league.members.length}).`,
    };
  }

  const draftOrder = league.members.map((m) => m.id);
  for (let i = draftOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [draftOrder[i], draftOrder[j]] = [draftOrder[j], draftOrder[i]];
  }

  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: { status: "DRAFTING", draftOrder, currentPickNo: 0 },
  });
  revalidatePath(`/leagues/${leagueId}`);
  return { success: true as const };
}

export async function makePick(
  leagueId: string,
  player: { nflverseId: string; name: string; team: string | null; position: string | null },
) {
  const user = await requireUser();

  try {
    const result = await executeDraftPick(user.id, leagueId, player);
    revalidatePath(`/leagues/${leagueId}`);
    return { success: true as const, ...result };
  } catch (err) {
    if (err instanceof DraftError) {
      return { success: false as const, error: err.message };
    }
    console.error(err);
    return { success: false as const, error: "Something went wrong making that pick." };
  }
}
