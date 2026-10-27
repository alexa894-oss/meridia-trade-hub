import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { loadOpportunity } from "@/lib/rfqs/load";
import { requireRole } from "@/lib/auth/guard";
import { loadFactoryQuote } from "@/lib/quotes/load";
import { QuoteForm } from "@/components/quotes/quote-form";
import { QuoteDetails } from "@/components/quotes/quote-details";
import { StatusBadge } from "@/components/admin/ui";
import { openConversation } from "@/lib/messages/actions";
import { Card, DataList } from "@/components/admin/ui";
import { RfqSummary } from "@/components/rfqs/rfq-summary";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Una fábrica solo abre solicitudes asignadas: si no lo está, RLS no devuelve
// la fila y la página responde 404 (aunque se cambie la URL).
export default async function OpportunityPage({ params }: PageProps<"/[locale]/fabrica/oportunidades/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const profile = await requireRole("factory");
  const data = await loadOpportunity(id);
  if (!data) notFound();
  const [t, tq, locale, own] = await Promise.all([
    getTranslations("Rfq"),
    getTranslations("Quote"),
    getLocale(),
    loadFactoryQuote(id, profile.companyId!),
  ]);
  const { rfq, buyer } = data;
  const { quote } = own;
  const unitLabel = rfq.units ? localized(rfq.units.names as Record<string, string>, locale) : "";
  const canQuote = ["assigned", "quoted", "negotiating"].includes(rfq.status);
  const str = (n: number | null) => (n === null ? "" : String(n));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/fabrica/oportunidades" className="text-sm font-semibold text-navy-800 hover:underline">
        ← {t("factory.back")}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">
          #{rfq.number} · {rfq.product}
        </h1>
        <form action={openConversation}>
          <input type="hidden" name="rfqId" value={rfq.id} />
          <input type="hidden" name="factoryId" value={profile.companyId!} />
          <button type="submit" className="inline-flex min-h-11 items-center rounded-(--radius-control) border border-navy-800 px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50">
            {tq("factory.writeBuyer")}
          </button>
        </form>
      </div>

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

      <Card
        title={tq("factory.title")}
        actions={quote && quote.status !== "draft" ? <StatusBadge status={quote.status === "hidden" ? "rejected" : quote.status === "pending_approval" ? "in_review" : "validated"} label={tq(`status.${quote.status}`)} /> : undefined}
      >
        {quote && quote.status !== "draft" ? (
          <div className="space-y-4">
            {quote.status === "hidden" ? (
              <p role="alert" className="rounded-(--radius-control) border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                {tq("factory.hidden", { reason: quote.hidden_reason ?? "" })}
              </p>
            ) : quote.status === "pending_approval" ? (
              <p className="rounded-(--radius-control) border border-gold-300 bg-gold-100 p-3 text-sm text-ink">{tq("factory.pendingHelp")}</p>
            ) : (
              <p className="text-sm text-ink-muted">{tq("factory.sentHelp")}</p>
            )}
            <QuoteDetails quote={quote} incoterms={rfq.incoterms} unitLabel={unitLabel} />
          </div>
        ) : canQuote ? (
          <QuoteForm
            rfqId={rfq.id}
            incoterms={rfq.incoterms}
            acceptsAlternatives={rfq.accepts_alternatives}
            unitLabel={unitLabel}
            initial={{
              offerType: quote?.offer_type ?? "exact",
              alternativeDifferences: quote?.alternative_differences ?? "",
              currency: quote?.currency ?? "",
              prices: Object.fromEntries(Object.entries(quote?.prices ?? {}).map(([k, v]) => [k, String(v)])),
              moq: str(quote?.moq ?? null),
              productionTimeDays: str(quote?.production_time_days ?? null),
              departurePort: quote?.departure_port ?? own.defaultPort ?? "",
              validUntil: quote?.valid_until ?? "",
              depositPct: str(quote?.deposit_pct ?? null),
              depositTiming: quote?.deposit_timing ?? "",
              balancePct: str(quote?.balance_pct ?? null),
              balanceTiming: quote?.balance_timing ?? "",
              sampleAvailable: quote?.sample_available === true ? "yes" : quote?.sample_available === false ? "no" : "",
              sampleCost: str(quote?.sample_cost ?? null),
              sampleShipping: quote?.sample_shipping_free === true ? "free" : quote?.sample_shipping_free === false ? "paid" : "",
              sampleShippingCost: str(quote?.sample_shipping_cost ?? null),
            }}
          />
        ) : (
          <p className="text-ink-muted">{tq("factory.closed")}</p>
        )}
      </Card>
    </div>
  );
}
