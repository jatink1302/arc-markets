import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// One per request — Server Components/Actions call this fresh each time so the
// cookie store (and therefore the session) is always current.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component (not a Server Action/Route Handler) —
            // middleware already refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
