import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadRegistration } from "@/lib/registration/load";
import { rfqFormOptions, rfqToInitial } from "@/lib/rfqs/form-data";
import { RfqForm } from "@/components/rfqs/rfq-form";

export const instant = false;

export default async function NewRfqPage() {
  const profile = await requireRole("buyer");
  const [t, locale, registration] = await Promise.all([getTranslations("Rfq"), getLocale(), loadRegistration(profile)]);
  const options = await rfqFormOptions(locale);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/comprador/solicitudes" className="text-sm font-semibold text-navy-800 hover:underline">
        ← {t("buyer.back")}
      </Link>
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("buyer.new")}</h1>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <RfqForm
          initial={rfqToInitial(null, registration.company?.country ?? null)}
          {...options}
          canSubmit={registration.company?.status === "validated"}
        />
      </section>
    </div>
  );
}
