import { Suspense } from "react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { PageLoading } from "@/components/page-loading";
import { AccessRequestWizard } from "@/components/registration/access-request-wizard";
import { countryOptions } from "@/lib/countries";
import { loadOptions, localized } from "@/lib/registration/load";
import { industryBySlug } from "@/lib/public/industries";
import { createClient } from "@/lib/supabase/server";

// "Solicitar acceso": el formulario completo va antes de crear la cuenta.
export default async function RequestAccessPage({ params, searchParams }: PageProps<"/[locale]/solicitar-acceso">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AccessRequest");

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")} wide>
      <Suspense fallback={<PageLoading />}>
        <RequestForm searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function RequestForm({ searchParams }: { searchParams: PageProps<"/[locale]/solicitar-acceso">["searchParams"] }) {
  const [locale, sp, tp] = await Promise.all([getLocale(), searchParams, getTranslations("Portal.industries")]);
  const supabase = await createClient();
  const [options, legal, settings] = await Promise.all([
    loadOptions(),
    supabase.rpc("current_legal_documents"),
    supabase.rpc("get_public_settings"),
  ]);
  const opt = (rows: { id: string; names: Record<string, string> }[]) => rows.map((r) => ({ value: r.id, label: localized(r.names, locale) }));

  // Lo que el visitante eligió en el portal: industria (precarga sus categorías) y producto buscado.
  const industry = typeof sp.industria === "string" ? industryBySlug(sp.industria) : undefined;
  const product = typeof sp.producto === "string" ? sp.producto.trim().slice(0, 120) : "";
  const categoryIds = industry
    ? options.categories.filter((c) => (industry.categories as readonly string[]).includes(c.slug)).map((c) => c.id)
    : [];
  const interest = product ? `Producto de interés: ${product}` : "";
  const initialValues: Record<string, string> = {
    ...(categoryIds.length ? { categoryIds: categoryIds.join(",") } : {}),
    ...(interest ? { needsDescription: interest, purchasePurpose: interest } : {}),
    ...(product && !industry ? { otherProducts: product } : {}),
  };
  const prefilled = [product, industry ? tp(`${industry.slug}.name`) : ""].filter(Boolean);

  return (
    <AccessRequestWizard
      countries={countryOptions(locale).map((c) => ({ value: c.code, label: c.name }))}
      sectors={opt(options.sectors)}
      categories={opt(options.categories)}
      frequencies={opt(options.frequencies)}
      allowIndividual={(settings.data as Record<string, unknown> | null)?.allow_individual_buyers !== false}
      // Botón de datos ficticios: solo en el servidor de desarrollo local.
      demo={process.env.NODE_ENV === "development"}
      initialValues={initialValues}
      prefilled={prefilled}
      legalDocuments={(legal.data ?? []).map((d) => ({
        id: d.id,
        kind: d.kind,
        version: d.version,
        isDraft: d.is_draft,
        text: localized(d.content as Record<string, string>, locale),
      }))}
    />
  );
}
