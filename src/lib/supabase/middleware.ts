import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Required: this refreshes the auth token and must run before any route logic.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // An authenticated user landing on /login (stale tab, bookmark, browser
  // back/forward cache) should never see the form — send them straight in.
  // GET only: a POST here is a Server Action (e.g. ensureSeeded(), fired from the
  // login page itself right after signup/login, before the client-side redirect)
  // — redirecting that would hand the action's fetch a full-page RSC response
  // instead of an action result, which it can't parse ("unexpected response").
  if (user && request.nextUrl.pathname === "/login" && request.method === "GET") {
    const url = request.nextUrl.clone();
    url.pathname = "/matchup";
    return NextResponse.redirect(url);
  }

  return response;
}
