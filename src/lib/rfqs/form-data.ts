import "server-only";
import { countryOptions } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import type { RfqFormInitial } from "@/components/rfqs/rfq-form";
import { loadRfqOptions, type RfqRecord } from "./load";

// Opciones del formulario en el idioma activo.
export async function rfqFormOptions(locale: string) {
  const options = await loadRfqOptions();
  return {
    categories: options.categories.map((c) => ({ value: c.id, label: localized(c.names, locale) })),
    units: options.units.map((u) => ({ value: u.id, label: localized(u.names, locale) })),
    countries: countryOptions(locale).map((c) => ({ value: c.code, label: c.name })),
  };
}

export function rfqToInitial(rfq: NonNullable<RfqRecord> | null, defaultCountry: string | null): RfqFormInitial {
  return {
    id: rfq?.id ?? null,
    product: rfq?.product ?? "",
    categoryId: rfq?.category_id ?? "",
    description: rfq?.description ?? "",
    quantity: rfq?.quantity !== null && rfq?.quantity !== undefined ? String(rfq.quantity) : "",
    unitId: rfq?.unit_id ?? "",
    destinationCountry: rfq?.destination_country ?? defaultCountry ?? "",
    technicalSpecs: rfq?.technical_specs ?? "",
    deadline: rfq?.deadline ?? "",
    referenceUrl: rfq?.reference_url ?? "",
    referenceFileName: rfq?.reference_image_path ? rfq.reference_image_path.split("/").pop()! : null,
    acceptsAlternatives: rfq?.accepts_alternatives ?? true,
    needsSample: rfq?.needs_sample ?? false,
    incoterms: rfq?.incoterms ?? [],
    destinationPort: rfq?.destination_port ?? "",
    shippingModes: rfq?.shipping_modes ?? [],
  };
}
