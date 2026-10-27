import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { listOpportunities } from "@/lib/rfqs/load";
import { formatDate } from "@/components/admin/ui";

export const instant = false;

// Oportunidades: solo las solicitudes que Meridia asignó a esta fábrica (RLS).
export default async function OpportunitiesPage() {
  const [t, locale, items] = await Promise.all([getTranslations("Rfq"), getLocale(), listOpportunities()]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("factory.title")}</h1>
      {items.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-muted">{t("factory.empty")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {items.map(({ rfqs: r, assigned_at }) => (
            <li key={r!.id}>
              <Link href={`/fabrica/oportunidades/${r!.id}`} className="block p-4 hover:bg-navy-50">
                <p className="font-semibold text-navy-800">
                  #{r!.number} · {r!.product}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {r!.categories ? `${localized(r!.categories.names as Record<string, string>, locale)} · ` : ""}
                  {r!.quantity !== null ? `${new Intl.NumberFormat(locale).format(Number(r!.quantity))} ${r!.units ? localized(r!.units.names as Record<string, string>, locale) : ""} · ` : ""}
                  {r!.destination_country ? countryName(r!.destination_country, locale) : ""}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {t("factory.assignedOn", { date: formatDate(assigned_at, locale) })}
                  {r!.deadline ? ` · ${t("deadlineOn", { date: formatDate(`${r!.deadline}T12:00:00Z`, locale) })}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
