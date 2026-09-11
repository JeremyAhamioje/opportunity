import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "oc_session";
const PUBLIC_PATHS = ["/login", "/setup"];

/**
 * Optimistic gate only — it checks that a session cookie exists so signed-out
 * requests are bounced before rendering. It deliberately does not verify the
 * token: real authorization happens in `requireViewer()`, which every page,
 * query and server action goes through.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!hasCookie && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (hasCookie && isPublic && pathname !== "/setup") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * `api` is excluded because those routes are not browser navigations and have
   * no session cookie to check — redirecting them to /login would turn every
   * machine-to-machine call into a 307 and hide the route's own authorization.
   * They are not thereby unprotected: /api/cron/digest requires a bearer token
   * and refuses when CRON_SECRET is unset. Any future API route must carry its
   * own check — this matcher will not do it for them.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
