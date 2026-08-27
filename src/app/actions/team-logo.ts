"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const BUCKET = "team-logos";

// file.type is client-reported and trivially spoofable — the extension used for the
// stored object (and therefore its public URL) comes from sniffing real magic bytes
// instead, not from trusting that header.
async function sniffImageExtension(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export async function uploadTeamLogo(sleeperRosterId: number, formData: FormData) {
  const authUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: authUser.id } });
  if (!user.sleeperUserId || !user.activeLeagueId) {
    return { success: false as const, error: "Connect a Sleeper account first." };
  }

  // sleeperRosterId is only unique within a league (Sleeper numbers rosters 1..N per
  // league independently) — scope to the caller's own connected league so this can't
  // resolve to a same-numbered roster in a different league.
  const roster = await prisma.sleeperRoster.findUnique({
    where: { leagueId_sleeperRosterId: { leagueId: user.activeLeagueId, sleeperRosterId } },
  });
  if (!roster || !roster.sleeperOwnerId || roster.sleeperOwnerId !== user.sleeperUserId) {
    return { success: false as const, error: "You can only change your own team's logo." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false as const, error: "No file provided." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false as const, error: "Image must be 5MB or smaller." };
  }
  const ext = await sniffImageExtension(file);
  if (!ext) {
    return { success: false as const, error: "That doesn't look like a PNG, JPEG, or WEBP image." };
  }

  const supabase = await createClient();
  const path = `${roster.leagueId}/${roster.sleeperRosterId}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: `image/${ext === "jpg" ? "jpeg" : ext}` });
  if (uploadError) {
    return { success: false as const, error: "Upload failed. Try again." };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust: the path is stable across re-uploads (upsert), so without a query param
  // a browser/CDN cache would keep serving the old image after a real change.
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  await prisma.sleeperRoster.update({
    where: { id: roster.id },
    data: { customLogoUrl: publicUrl },
  });

  revalidatePath("/matchup");
  return { success: true as const, logoUrl: publicUrl };
}
