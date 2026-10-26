import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { loadOpportunity } from "@/lib/rfqs/load";
import { Card, DataList } from "@/components/admin/ui";
import { RfqSummary } from "@/components/rfqs/rfq-summary";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Una fábrica solo abre solicitudes asignadas: si no lo está, RLS no devuelve
// la fila y la página responde 404 (aunque se cambie la URL).
export default async function OpportunityPage({ params }: PageProps<"/[locale]/fabrica/oportunidades/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await loadOpportunity(id);
  if (!data) notFound();
  const [t, locale] = await Promise.all([getTranslations("Rfq"), getLocale()]);
  const { rfq, buyer } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/fabrica/oportunidades" className="text-sm font-semibold text-navy-800 hover:underline">
        ← {t("factory.back")}
      </Link>
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">
        #{rfq.number} · {rfq.product}
      </h1>

      <Card title={t("factory.buyer")}>
        <DataList
          items={[
            ...(buyer?.display_name ? [{ label: t("factory.buyerName"), value: buyer.display_name }] : []),
            { label: t("factory.sector"), value: buyer?.sector_names ? localized(buyer.sector_names as Record<string, string>, locale) : null },
            { label: t("factory.country"), value: buyer?.country ? countryName(buyer.country, locale) : null },
            { label: t("factory.verified"), value: buyer?.is_verified ? t("factory.verifiedYes") : t("factory.verifiedNo") },
          ]}
        />
      </Card>

      <Card title={t("factory.request")}>
        <RfqSummary rfq={rfq} imageUrl={data.imageUrl} />
      </Card>

      <p className="rounded-xl border border-gold-300 bg-gold-100 p-4 text-sm text-ink">{t("factory.quoteSoon")}</p>
    </div>
  );
}
