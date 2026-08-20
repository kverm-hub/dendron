import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/registreren", "/auth"];

export async function updateSession(request: NextRequest) {
  // Verzamel cookies die Supabase tijdens deze request wil setten,
  // zodat we ze op zowel een pass-through als een redirect-response kunnen toepassen.
  const cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(setCookies) {
          setCookies.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            cookiesToSet.push({ name, value, options });
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p)) || path === "/";

  function applyCookies(response: NextResponse) {
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options as Record<string, unknown> | undefined);
    }
    return response;
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return applyCookies(NextResponse.redirect(url));
  }

  if (user && (path === "/login" || path === "/registreren" || path === "/")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === "kind" ? "/kind" : "/ouder";
    return applyCookies(NextResponse.redirect(url));
  }

  if (user && (path.startsWith("/ouder") || path.startsWith("/kind"))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const expectedPrefix = profile?.role === "kind" ? "/kind" : "/ouder";
    if (!path.startsWith(expectedPrefix)) {
      const url = request.nextUrl.clone();
      url.pathname = expectedPrefix;
      return applyCookies(NextResponse.redirect(url));
    }
  }

  return applyCookies(NextResponse.next({ request }));
}
