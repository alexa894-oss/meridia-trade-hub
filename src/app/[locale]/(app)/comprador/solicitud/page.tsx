import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { RequestTracker } from "@/components/registration/status-card";

export const instant = false;

// Seguimiento de la solicitud de acceso.
export default async function Page({ searchParams }: PageProps<"/[locale]/comprador/solicitud">) {
  const [profile, sp, t] = await Promise.all([requireRole("buyer"), searchParams, getTranslations("RegistrationStatus")]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("pageTitle")}</h1>
      <RequestTracker profile={profile} justSubmitted={sp.enviada === "1"} />
    </div>
  );
}
