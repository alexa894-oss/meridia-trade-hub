import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { loadAdminRfq } from "@/lib/rfqs/load";
import { Card, DataList, formatDate, StatusBadge } from "@/components/admin/ui";
import { AssignPanel, RfqActionPanel } from "@/components/admin/rfq-panels";
import { RfqSummary } from "@/components/rfqs/rfq-summary";
import { loadAdminQuotes } from "@/lib/quotes/load";
import { QuoteDetails } from "@/components/quotes/quote-details";
import { QuoteModeration } from "@/components/admin/quote-moderation";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminRfqPage({ params }: PageProps<"/[locale]/admin/solicitudes/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await loadAdminRfq(id);
  if (!data) notFound();
  const [t, tr, ts, locale] = await Promise.all([
    getTranslations("Admin.rfq"),
    getTranslations("Rfq"),
    getTranslations("Admin.status"),
    getLocale(),
  ]);
  const { rfq, buyer } = data;
  const [quotes, tq] = await Promise.all([loadAdminQuotes(rfq.id), getTranslations("Quote")]);
  const unitLabel = rfq.units ? localized(rfq.units.names as Record<string, string>, locale) : "";
  const canAssign = !["draft", "info_requested", "closed", "order_created"].includes(rfq.status);

  return (
    <div className="space-y-5">
      <Link href="/admin/solicitudes" className="text-sm font-semibold text-navy-800 hover:underline">
        ← {t("back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">
          #{rfq.number} · {rfq.product}
        </h1>
        <StatusBadge status={rfq.status} label={tr(`status.${rfq.status}`)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px] lg:items-start">
        <div className="space-y-5">
          <Card title={t("request")}>
            <RfqSummary rfq={rfq} imageUrl={data.imageUrl} />
          </Card>
          <Card title={t("quotes", { count: quotes.length })}>
            {quotes.length ? (
              <ul className="space-y-4">
                {quotes.map(({ quote, factoryName }) => (
                  <li key={quote.id} className="rounded-(--radius-control) border border-line p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-navy-800">{factoryName}</p>
                      <StatusBadge status={quote.status === "hidden" ? "rejected" : quote.status === "draft" ? "draft" : "validated"} label={tq(`status.${quote.status}`)} />
                    </div>
                    {quote.status === "draft" ? (
                      <p className="text-sm text-ink-muted">{t("quoteDraft")}</p>
                    ) : (
                      <QuoteDetails quote={quote} incoterms={rfq.incoterms} unitLabel={unitLabel} />
                    )}
                    <QuoteModeration quoteId={quote.id} status={quote.status} hiddenReason={quote.hidden_reason} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted">{t("noQuotes")}</p>
            )}
          </Card>
          <Card title={t("history")}>
            <ol className="space-y-3">
              {data.history.map((h) => (
                <li key={h.id} className="border-l-2 border-gold-300 pl-3">
                  <p className="text-sm font-semibold text-navy-800">
                    {h.from_status ? `${tr(`status.${h.from_status}` as never)} → ` : ""}
                    {tr(`status.${h.to_status}` as never)}
                  </p>
                  <p className="text-xs text-ink-muted">{formatDate(h.created_at, locale, true)}</p>
                  {h.note ? <p className="mt-1 text-sm whitespace-pre-line">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-4">
          <Card title={t("buyer")}>
            {buyer ? (
              <DataList
                items={[
                  {
                    label: t("buyerName"),
                    value: (
                      <Link href={`/admin/empresas/${buyer.id}`} className="text-navy-800 underline">
                        {buyer.buyer_details?.legal_name ?? buyer.buyer_details?.full_name}
                      </Link>
                    ),
                  },
                  { label: t("country"), value: countryName(buyer.country, locale) },
                  { label: t("sector"), value: buyer.sectors ? localized(buyer.sectors.names as Record<string, string>, locale) : null },
                  { label: t("companyStatus"), value: ts(buyer.status) },
                ]}
              />
            ) : null}
          </Card>
          <Card title={t("assignment")}>
            <AssignPanel rfqId={rfq.id} candidates={data.candidates} canAssign={canAssign} />
          </Card>
          <Card title={t("actions")}>
            <RfqActionPanel rfqId={rfq.id} canRequestInfo={rfq.status === "submitted"} canClose={!["closed", "draft"].includes(rfq.status)} />
          </Card>
        </div>
      </div>
    </div>
  );
}
