"use server";

import { requireUser } from "@/lib/auth";
import { ensureUserSeeded } from "@/lib/ledger";

// Called right after a client-side signUp/signInWithPassword succeeds with an active
// session (no email confirmation step involved) — the /auth/callback route handles
// seeding for the confirmation-link path; this covers the direct-session path.
export async function ensureSeeded() {
  const user = await requireUser();
  await ensureUserSeeded(user.id, user.email ?? "");
}
