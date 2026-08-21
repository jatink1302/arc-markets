"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const MAX_MESSAGE_LENGTH = 1000;

export async function sendChatMessage(leagueId: string, body: string) {
  const user = await requireUser();

  const trimmed = body.trim();
  if (!trimmed) return { success: false as const, error: "Message can't be empty." };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { success: false as const, error: "Message is too long." };
  }

  const member = await prisma.fantasyLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
  });
  if (!member) return { success: false as const, error: "You're not a member of this league." };

  await prisma.fantasyChatMessage.create({
    data: { leagueId, memberId: member.id, body: trimmed },
  });

  revalidatePath(`/leagues/${leagueId}/chat`);
  return { success: true as const };
}
