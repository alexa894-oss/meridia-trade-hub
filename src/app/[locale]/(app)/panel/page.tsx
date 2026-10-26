import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireProfile } from "@/lib/auth/guard";
import { roleHome } from "@/lib/auth/roles";
import { PageLoading } from "@/components/page-loading";

export const instant = false;

// Punto de entrada único tras ingresar: la cuenta decide a qué panel ir.
export default function PanelPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RedirectToRoleHome />
    </Suspense>
  );
}

async function RedirectToRoleHome() {
  const profile = await requireProfile();
  redirect({ href: roleHome[profile.role], locale: await getLocale() });
  return null;
}
