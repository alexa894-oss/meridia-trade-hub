import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { buyerQuoteAction } from "@/lib/quotes/actions";
import { openConversation } from "@/lib/messages/actions";
import { Link } from "@/i18n/navigation";
import type { loadComparator } from "@/lib/quotes/load";
import { formatDate, StatusBadge } from "@/components/admin/ui";
import { money, plainNumber } from "./format";

type Entry = Awaited<ReturnType<typeof loadComparator>>[number];

function ActionButton({ quoteId, action, children, tone = "neutral" }: { quoteId: string; action: string; children: ReactNode; tone?: "primary" | "neutral" | "danger" }) {
  const cls = {
    primary: "bg-navy-800 text-white hover:bg-navy-900",
    neutral: "border border-navy-800 text-navy-800 hover:bg-navy-50",
    danger: "text-danger hover:underline",
  }[tone];
  return (
    <form action={buyerQuoteAction}>
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="action" value={action} />
      <button type="submit" className={`inline-flex min-h-10 w-full items-center justify-center rounded-(--radius-control) px-3 text-sm font-semibold ${cls}`}>
        {children}
      </button>
    </form>
  );
}

// Comparador: una columna por fábrica. Muestra nombre, verificación, precio por
// término, tiempos, condiciones de pago, muestras y una marca si es alternativa.
export async function Comparator({ entries, incoterms, unitLabel, closed }: { entries: Entry[]; incoterms: string[]; unitLabel: string; closed: boolean }) {
  const [t, locale] = await Promise.all([getTranslations("Quote"), getLocale()]);
  const active = entries.filter((e) => e.quote.status !== "discarded");
  const discarded = entries.filter((e) => e.quote.status === "discarded");

  if (!entries.length) return <p className="text-ink-muted">{t("comparator.empty")}</p>;

  const rows: { label: string; render: (e: Entry) => ReactNode }[] = [
    {
      label: t("comparator.offer"),
      render: ({ quote }) =>
        quote.offer_type === "alternative" ? (
          <div>
            <span className="inline-flex rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-bold text-gold-700 uppercase">{t("offerTypes.alternative")}</span>
            <p className="mt-1 text-sm whitespace-pre-line">{quote.alternative_differences}</p>
          </div>
        ) : (
          t("offerTypes.exact")
        ),
    },
    ...incoterms.map((term) => ({
      label: t("fields.unitPrice", { term, unit: unitLabel }),
      render: ({ quote }: Entry) => <span className="font-semibold text-navy-800">{money(quote.prices[term], quote.currency, locale)}</span>,
    })),
    { label: t("fields.moqWithUnit", { unit: unitLabel }), render: ({ quote }) => plainNumber(quote.moq, locale) },
    { label: t("fields.productionTimeDays"), render: ({ quote }) => (quote.production_time_days ? t("days", { count: quote.production_time_days }) : "—") },
    { label: t("fields.departurePort"), render: ({ quote }) => quote.departure_port },
    { label: t("fields.validUntil"), render: ({ quote }) => (quote.valid_until ? formatDate(`${quote.valid_until}T12:00:00Z`, locale) : "—") },
    {
      label: t("sections.payment"),
      render: ({ quote }) => (
        <div className="space-y-0.5 text-sm">
          <p>{t("paymentDeposit", { pct: Number(quote.deposit_pct), when: quote.deposit_timing ?? "" })}</p>
          <p>{t("paymentBalance", { pct: Number(quote.balance_pct), when: quote.balance_timing ?? "" })}</p>
        </div>
      ),
    },
    {
      label: t("sections.sample"),
      render: ({ quote }) =>
        !quote.sample_available ? (
          t("sampleAvailable.no")
        ) : (
          <div className="text-sm">
            <p>{Number(quote.sample_cost) === 0 ? t("sampleFree") : t("sampleCostValue", { value: money(quote.sample_cost, quote.currency, locale) })}</p>
            <p>{quote.sample_shipping_free ? t("sampleShipping.free") : `${t("shippingCost")} ${money(quote.sample_shipping_cost, quote.currency, locale)}`}</p>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="-mx-5 overflow-x-auto sm:mx-0">
        <table className="min-w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-36 min-w-36 bg-surface p-3 text-sm font-medium text-ink-muted sm:w-48" />
              {active.map(({ quote, factory }) => (
                <th
                  key={quote.id}
                  scope="col"
                  className={`min-w-56 border-b border-line p-3 align-top ${quote.status === "preferred" ? "bg-gold-100" : ""}`}
                >
                  <p className="font-display font-semibold text-navy-800">{factory?.legal_name_en ?? t("comparator.factory")}</p>
                  {factory?.legal_name_zh ? <p className="text-sm text-ink-muted" lang="zh-CN">{factory.legal_name_zh}</p> : null}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {factory?.is_verified ? (
                      <span className="inline-flex rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">{t("comparator.verified")}</span>
                    ) : null}
                    {factory?.tier ? (
                      <span className="inline-flex rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-800">{t(`comparator.tiers.${factory.tier}`)}</span>
                    ) : null}
                    {quote.status !== "reviewed" && quote.status !== "submitted" ? (
                      <StatusBadge status={quote.status === "preferred" ? "validated" : "closed"} label={t(`status.${quote.status}`)} />
                    ) : null}
                  </div>
                  {factory?.founded_year ? <p className="mt-1 text-xs text-ink-muted">{t("comparator.foundedVerified", { year: factory.founded_year })}</p> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface p-3 align-top text-sm font-medium text-ink-muted">
                  {row.label}
                </th>
                {active.map((entry) => (
                  <td key={entry.quote.id} className={`border-b border-line p-3 align-top ${entry.quote.status === "preferred" ? "bg-gold-100/60" : ""}`}>
                    {row.render(entry)}
                  </td>
                ))}
              </tr>
            ))}
            {!closed ? (
              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-surface p-3 align-top text-sm font-medium text-ink-muted">
                  {t("comparator.actions")}
                </th>
                {active.map(({ quote }) => (
                  <td key={quote.id} className="space-y-2 p-3 align-top">
                    {quote.status === "expired" ? (
                      <p className="text-sm text-ink-muted">{t("comparator.expired")}</p>
                    ) : (
                      <>
                        {quote.status === "preferred" ? (
                          <ActionButton quoteId={quote.id} action="unprefer">
                            {t("comparator.unprefer")}
                          </ActionButton>
                        ) : (
                          <ActionButton quoteId={quote.id} action="prefer" tone="primary">
                            {t("comparator.prefer")}
                          </ActionButton>
                        )}
                        <form action={openConversation}>
                          <input type="hidden" name="rfqId" value={quote.rfq_id} />
                          <input type="hidden" name="factoryId" value={quote.factory_company_id} />
                          <button type="submit" className="inline-flex min-h-10 w-full items-center justify-center rounded-(--radius-control) border border-navy-800 px-3 text-sm font-semibold text-navy-800 hover:bg-navy-50">
                            {t("comparator.openConversation")}
                          </button>
                        </form>
                        <Link href={`/comprador/pedidos/nuevo?cotizacion=${quote.id}`} className="inline-flex min-h-10 w-full items-center justify-center rounded-(--radius-control) bg-gold-500 px-3 text-sm font-semibold text-navy-900 hover:bg-gold-300">
                          {t("comparator.createOrder")}
                        </Link>
                        <ActionButton quoteId={quote.id} action="discard" tone="danger">
                          {t("comparator.discard")}
                        </ActionButton>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {discarded.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-navy-800">{t("comparator.discarded", { count: discarded.length })}</summary>
          <ul className="mt-2 space-y-1 text-ink-muted">
            {discarded.map(({ quote, factory }) => (
              <li key={quote.id}>{factory?.legal_name_en ?? t("comparator.factory")}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
