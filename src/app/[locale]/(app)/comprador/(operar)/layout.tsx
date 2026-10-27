import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadCompanyStatus } from "@/lib/registration/load";
import { REQUEST_BASE } from "@/lib/registration/steps";

// Solicitudes de cotización, pedidos y mensajes: solo con la solicitud de acceso aprobada.
// (La base también lo exige: un solicitante pendiente no puede crear solicitudes.)
export default async function Layout({ children }: { children: ReactNode }) {
  const profile = await requireRole("buyer");
  const status = await loadCompanyStatus(profile.companyId);
  if (status !== "validated") redirect({ href: REQUEST_BASE, locale: await getLocale() });
  return children;
}
