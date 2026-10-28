import { getLocale, getTranslations } from "next-intl/server";
import { countryName } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import type { RfqRecord } from "@/lib/rfqs/load";
import { DataList, formatDate } from "@/components/admin/ui";

// Ficha de la solicitud. La ven el comprador, la fábrica asignada y Meridia;
// por eso nunca incluye datos de la empresa compradora.
export async function RfqSummary({ rfq, imageUrl }: { rfq: NonNullable<RfqRecord>; imageUrl: string | null }) {
  const [t, locale] = await Promise.all([getTranslations("Rfq"), getLocale()]);
  const unit = rfq.units ? localized(rfq.units.names as Record<string, string>, locale) : "";
  const quantity = rfq.quantity !== null ? `${new Intl.NumberFormat(locale).format(Number(rfq.quantity))} ${unit}` : null;
  const isImage = imageUrl && rfq.reference_image_path && !rfq.reference_image_path.endsWith(".pdf");

  return (
    <div className="space-y-5">
      <DataList
        items={[
          { label: t("fields.product"), value: rfq.product },
          { label: t("fields.category"), value: rfq.categories ? localized(rfq.categories.names as Record<string, string>, locale) : null },
          { label: t("fields.quantity"), value: quantity },
          {
            label: t("fields.purchaseFrequency"),
            value: rfq.purchase_frequencies ? localized(rfq.purchase_frequencies.names as Record<string, string>, locale) : null,
          },
          { label: t("fields.destinationCountry"), value: rfq.destination_country ? countryName(rfq.destination_country, locale) : null },
          { label: t("fields.deadline"), value: rfq.deadline ? formatDate(`${rfq.deadline}T12:00:00Z`, locale) : null },
          { label: t("fields.incoterms"), value: rfq.incoterms.length ? rfq.incoterms.join(" · ") : null },
          { label: t("fields.destinationPort"), value: rfq.destination_port },
          {
            label: t("fields.shippingModes"),
            value: rfq.shipping_modes.length ? rfq.shipping_modes.map((m) => t(`shippingModes.${m}`)).join(" · ") : t("notSpecified"),
          },
          { label: t("fields.acceptsAlternatives"), value: rfq.accepts_alternatives ? t("yes") : t("no") },
          { label: t("fields.needsSample"), value: rfq.needs_sample ? t("yes") : t("no") },
        ]}
      />
      <div>
        <p className="text-sm text-ink-muted">{t("fields.description")}</p>
        <p className="mt-0.5 whitespace-pre-line">{rfq.description ?? "—"}</p>
      </div>
      <div>
        <p className="text-sm text-ink-muted">{t("fields.technicalSpecs")}</p>
        <p className="mt-0.5 whitespace-pre-line">{rfq.technical_specs ?? "—"}</p>
      </div>
      <div>
        <p className="text-sm text-ink-muted">{t("fields.reference")}</p>
        <div className="mt-1 space-y-2">
          {imageUrl ? (
            isImage ? (
              <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada y temporal de Storage */}
                <img src={imageUrl} alt={t("fields.reference")} className="max-h-64 rounded-(--radius-control) border border-line" />
              </a>
            ) : (
              <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-800 underline">
                {t("openFile")}
              </a>
            )
          ) : null}
          {rfq.reference_url ? (
            <a href={rfq.reference_url} target="_blank" rel="noopener noreferrer nofollow" className="block break-all text-navy-800 underline">
              {rfq.reference_url}
            </a>
          ) : null}
          {!imageUrl && !rfq.reference_url ? <p>—</p> : null}
        </div>
      </div>
    </div>
  );
}
