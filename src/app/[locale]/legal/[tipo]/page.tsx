import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localized } from "@/lib/registration/load";
import { createClient } from "@/lib/supabase/server";
import { PageLoading } from "@/components/page-loading";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

// Se lee la versión vigente del texto al pedir la página.
export const instant = false;

const kinds = { terminos: "terms", privacidad: "privacy", "no-elusion": "non_circumvention" } as const;
type Slug = keyof typeof kinds;

export function generateStaticParams() {
  return Object.keys(kinds).map((tipo) => ({ tipo }));
}

// Texto legal vigente, público (el mismo que se acepta al solicitar acceso).
export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[tipo]">) {
  const { locale, tipo } = await params;
  setRequestLocale(locale);
  if (!(tipo in kinds)) notFound();
  return (
    <>
      <PublicHeader />
      <main className="flex-1 bg-surface-muted">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <Suspense fallback={<PageLoading />}>
            <LegalText kind={kinds[tipo as Slug]} locale={locale} />
          </Suspense>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

async function LegalText({ kind, locale }: { kind: (typeof kinds)[Slug]; locale: string }) {
  const [t, tr] = await Promise.all([getTranslations("Portal.legalPage"), getTranslations("Registration.legal")]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_legal_documents");
  const doc = (data ?? []).find((d) => d.kind === kind);
  return (
    <article className="grid gap-5 rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <Link href="/" className="text-sm font-semibold text-navy-800 hover:underline">
        {t("back")}
      </Link>
      <h1 className="font-display text-3xl font-bold text-navy-800">{tr(kind)}</h1>
      {doc ? (
        <>
          <p className="text-sm text-ink-muted">{t("version", { version: doc.version })}</p>
          {doc.is_draft ? <p className="rounded-(--radius-control) border border-gold-300 bg-gold-100 px-4 py-3 text-sm text-ink">{t("draft")}</p> : null}
          <div className="whitespace-pre-line text-ink">{localized(doc.content as Record<string, string>, locale)}</div>
        </>
      ) : (
        <p className="text-ink-muted">{t("missing")}</p>
      )}
    </article>
  );
}
