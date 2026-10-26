import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireProfile } from "@/lib/auth/guard";
import { loadPendingLegal } from "@/lib/legal/load";
import { localized } from "@/lib/registration/load";
import { LegalAcceptForm } from "@/components/legal-accept-form";
import { PageLoading } from "@/components/page-loading";

export const instant = false;

export default function LegalUpdatePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Pending />
    </Suspense>
  );
}

async function Pending() {
  const profile = await requireProfile();
  const [t, locale, pending] = await Promise.all([getTranslations("LegalUpdate"), getLocale(), loadPendingLegal(profile.id)]);
  if (!pending.documents.length) redirect({ href: "/panel", locale });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>
      <p className="text-ink-muted">{t("intro")}</p>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <LegalAcceptForm
          documents={pending.documents.map((d) => ({
            id: d.id,
            kind: d.kind,
            version: d.version,
            isDraft: d.is_draft,
            text: localized(d.content as Record<string, string>, locale),
          }))}
        />
      </section>
    </div>
  );
}
