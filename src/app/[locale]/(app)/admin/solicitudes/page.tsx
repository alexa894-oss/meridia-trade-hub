import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { countAdminRfqsByStatus, listAdminRfqs, rfqStatuses, type RfqStatus } from "@/lib/rfqs/load";
import { formatDate, StatusBadge } from "@/components/admin/ui";

export const instant = false;

const tabs = rfqStatuses.filter((s) => s !== "draft");

export default async function AdminRfqsPage({ searchParams }: PageProps<"/[locale]/admin/solicitudes">) {
  const sp = await searchParams;
  const status = (typeof sp.estado === "string" && [...tabs, "all"].includes(sp.estado) ? sp.estado : "submitted") as RfqStatus | "all";
  const [t, tr, locale, rfqs, counts] = await Promise.all([
    getTranslations("Admin.rfqs"),
    getTranslations("Rfq"),
    getLocale(),
    listAdminRfqs(status),
    countAdminRfqsByStatus(),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          {[...tabs, "all" as const].map((s) => (
            <li key={s} className="shrink-0">
              <Link
                href={`/admin/solicitudes?estado=${s}`}
                aria-current={s === status ? "true" : undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-(--radius-control) border px-3 text-sm ${
                  s === status ? "border-navy-800 bg-navy-800 text-white" : "border-line bg-surface text-ink"
                }`}
              >
                {s === "all" ? t("all") : tr(`status.${s}`)}
                {s !== "all" ? <span className="opacity-70">{counts[s] ?? 0}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {rfqs.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rfqs.map((r) => {
            const buyer = r.companies;
            const buyerName = buyer?.buyer_details?.legal_name ?? buyer?.buyer_details?.full_name ?? "";
            const assignments = (r.rfq_assignments as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <li key={r.id}>
                <Link href={`/admin/solicitudes/${r.id}`} className="grid gap-2 p-4 hover:bg-navy-50 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-800">
                      #{r.number} · {r.product}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {buyerName}
                      {buyer?.country ? ` · ${countryName(buyer.country, locale)}` : ""}
                      {r.categories ? ` · ${localized(r.categories.names as Record<string, string>, locale)}` : ""}
                      {` · ${t("factories", { count: assignments })}`}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {r.submitted_at ? t("submittedAt", { date: formatDate(r.submitted_at, locale, true) }) : ""}
                      {r.deadline ? ` · ${tr("deadlineOn", { date: formatDate(`${r.deadline}T12:00:00Z`, locale) })}` : ""}
                    </p>
                  </div>
                  <span className="justify-self-start sm:justify-self-end">
                    <StatusBadge status={r.status} label={tr(`status.${r.status}`)} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
