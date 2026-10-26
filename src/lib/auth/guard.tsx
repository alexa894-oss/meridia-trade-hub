import "server-only";
import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentProfile, type CurrentProfile } from "./session";
import { roleHome, type Role } from "./roles";
import { loadPendingLegal } from "@/lib/legal/load";

// Exige sesión; si no hay, envía a "Ingresar a Meridia".
export async function requireProfile(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect({ href: "/ingresar", locale: await getLocale() });
  }
  return profile!;
}

// Exige un rol concreto; con otro rol, devuelve a su propio panel.
export async function requireRole(allowed: Role): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (profile.role !== allowed) {
    redirect({ href: roleHome[profile.role], locale: await getLocale() });
  }
  return profile;
}

// Envoltorio para layouts: debe ir dentro de <Suspense> (lee cookies).
// Si hay una versión nueva de los textos legales, se pide aceptarla antes de seguir.
export async function RoleGate({ allow, children }: { allow: Role; children: ReactNode }) {
  const profile = await requireRole(allow);
  if (allow !== "admin") {
    const legal = await loadPendingLegal(profile.id);
    if (legal.mustAccept) redirect({ href: "/textos-legales", locale: await getLocale() });
  }
  return children;
}
