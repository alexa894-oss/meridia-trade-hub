import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listBuyerRfqs } from "@/lib/rfqs/load";
import { localized } from "@/lib/registration/load";
import { ButtonLink } from "@/components/button-link";
import { formatDate, StatusBadge } from "@/components/admin/ui";

export const instant = false;

export default async function BuyerRfqsPage() {
  const [t, locale, rfqs] = await Promise.all([getTranslations("Rfq"), getLocale(), listBuyerRfqs()]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("buyer.title")}</h1>
        <ButtonLink href="/comprador/solicitudes/nueva">{t("buyer.new")}</ButtonLink>
      </div>
      {rfqs.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-muted">{t("buyer.empty")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rfqs.map((r) => (
            <li key={r.id}>
              <Link href={`/comprador/solicitudes/${r.id}`} className="grid gap-2 p-4 hover:bg-navy-50 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-800">
                    #{r.number} · {r.product}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {r.quantity !== null ? `${new Intl.NumberFormat(locale).format(Number(r.quantity))} ${r.units ? localized(r.units.names as Record<string, string>, locale) : ""} · ` : ""}
                    {r.deadline ? t("deadlineOn", { date: formatDate(`${r.deadline}T12:00:00Z`, locale) }) : t("noDeadline")}
                  </p>
                </div>
                <span className="justify-self-start sm:justify-self-end">
                  <StatusBadge status={r.status} label={t(`status.${r.status}`)} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
