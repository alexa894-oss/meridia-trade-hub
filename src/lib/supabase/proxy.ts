import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./env";

// Refresca la sesión de Supabase, escribe las cookies en la respuesta que ya
// preparó next-intl y devuelve el id del usuario (o null).
export async function updateSession(request: NextRequest, response: NextResponse) {
  if (!isSupabaseConfigured) return { response, userId: null };

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return { response, userId: data?.claims?.sub ?? null };
}
