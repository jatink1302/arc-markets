import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserSeeded } from "@/lib/ledger";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      await ensureUserSeeded(data.user.id, data.user.email ?? "");
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
