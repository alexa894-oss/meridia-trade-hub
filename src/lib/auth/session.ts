import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Role } from "./roles";

export type CurrentProfile = {
  id: string;
  email: string | null;
  role: Role;
  fullName: string | null;
  companyId: string | null;
};

// Lee la sesión verificada (getClaims valida el JWT) y el perfil con su rol.
// Se memoriza por request para no repetir la consulta.
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  // Marca la lectura como dinámica antes de que el cliente de Supabase use la hora actual.
  await connection();
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, company_id")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    email: typeof claims.email === "string" ? claims.email : null,
    role: profile.role as Role,
    fullName: profile.full_name,
    companyId: profile.company_id,
  };
});
