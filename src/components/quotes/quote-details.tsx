import { getLocale, getTranslations } from "next-intl/server";
import type { QuoteWithPrices } from "@/lib/quotes/load";
import { DataList, formatDate } from "@/components/admin/ui";
import { money, plainNumber } from "./format";

// Detalle de una cotización (vista de la fábrica y del administrador).
export async function QuoteDetails({ quote, incoterms, unitLabel }: { quote: QuoteWithPrices; incoterms: string[]; unitLabel: string }) {
  const [t, locale] = await Promise.all([getTranslations("Quote"), getLocale()]);
  const sample = !quote.sample_available
    ? t("sampleAvailable.no")
    : `${Number(quote.sample_cost) === 0 ? t("sampleFree") : money(quote.sample_cost, quote.currency, locale)} · ${
        quote.sample_shipping_free ? t("sampleShipping.free") : `${t("shippingCost")} ${money(quote.sample_shipping_cost, quote.currency, locale)}`
      }`;

  return (
    <div className="space-y-4">
      {quote.offer_type === "alternative" ? (
        <div className="rounded-(--radius-control) border border-gold-300 bg-gold-100 p-3 text-sm">
          <p className="font-semibold text-navy-800">{t("offerTypes.alternative")}</p>
          <p className="mt-1 whitespace-pre-line">{quote.alternative_differences}</p>
        </div>
      ) : null}
      <DataList
        items={[
          ...incoterms.map((term) => ({ label: t("fields.unitPrice", { term, unit: unitLabel }), value: money(quote.prices[term], quote.currency, locale) })),
          { label: t("fields.moqWithUnit", { unit: unitLabel }), value: plainNumber(quote.moq, locale) },
          { label: t("fields.productionTimeDays"), value: quote.production_time_days ? t("days", { count: quote.production_time_days }) : "—" },
          { label: t("fields.departurePort"), value: quote.departure_port },
          { label: t("fields.validUntil"), value: quote.valid_until ? formatDate(`${quote.valid_until}T12:00:00Z`, locale) : "—" },
          {
            label: t("sections.payment"),
            value: quote.deposit_pct !== null ? t("paymentSummary", { deposit: Number(quote.deposit_pct), depositWhen: quote.deposit_timing ?? "", balance: Number(quote.balance_pct), balanceWhen: quote.balance_timing ?? "" }) : "—",
          },
          { label: t("sections.sample"), value: sample },
        ]}
      />
    </div>
  );
}
