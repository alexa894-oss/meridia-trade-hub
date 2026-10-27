import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadCompanyStatus } from "@/lib/registration/load";

// Oportunidades, pedidos, comisiones y mensajes: solo fábricas habilitadas por Meridia.
// (La base también lo exige: una fábrica no habilitada no ve solicitudes asignadas.)
export default async function Layout({ children }: { children: ReactNode }) {
  const profile = await requireRole("factory");
  if ((await loadCompanyStatus(profile.companyId)) !== "validated") redirect({ href: "/fabrica", locale: await getLocale() });
  return children;
}
