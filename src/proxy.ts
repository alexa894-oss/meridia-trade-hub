import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { guestOnlyPrefixes, matchesPrefix, protectedPrefixes } from "@/lib/auth/roles";
import { updateSession } from "@/lib/supabase/proxy";

const handleI18nRouting = createIntlMiddleware(routing);

// Separa el prefijo de idioma (p. ej. /zh-CN) del resto de la ruta.
function splitLocale(pathname: string) {
  for (const locale of routing.locales as readonly string[]) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return { prefix: `/${locale}`, path: pathname.slice(locale.length + 1) || "/" };
    }
  }
  return { prefix: "", path: pathname };
}

function redirectKeepingCookies(request: NextRequest, from: NextResponse, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

// Chequeo optimista de sesión. La autorización real por rol ocurre en el
// servidor (RoleGate) y en la base de datos (RLS).
export async function proxy(request: NextRequest) {
  const intlResponse = handleI18nRouting(request);
  if (intlResponse.headers.has("location")) return intlResponse;

  const { response, userId } = await updateSession(request, intlResponse);
  const { prefix, path } = splitLocale(request.nextUrl.pathname);

  if (!userId && matchesPrefix(path, protectedPrefixes)) {
    const next = encodeURIComponent(path + request.nextUrl.search);
    return redirectKeepingCookies(request, response, `${prefix}/ingresar`, `?next=${next}`);
  }
  if (userId && matchesPrefix(path, guestOnlyPrefixes)) {
    return redirectKeepingCookies(request, response, `${prefix}/panel`);
  }
  return response;
}

export const config = {
  matcher: "/((?!api|auth|_next|_vercel|.*\\..*).*)",
};
