import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loadAlerts } from "@/lib/admin/load";
import { listPendingQuotes } from "@/lib/quotes/load";
import { Card } from "@/components/admin/ui";

export const instant = false;

// Panel del administrador: alertas con umbral configurable (sin plazo fijo).
export default async function AdminDashboard() {
  const t = await getTranslations("Admin.dashboard");
  const [alerts, pendingQuotes] = await Promise.all([loadAlerts(), listPendingQuotes()]);
  if (!alerts) return null;

  const tiles = [
    {
      key: "companies",
      href: "/admin/accesos",
      count: alerts.companies_in_review,
      overdue: alerts.companies_overdue,
      hours: alerts.pending_company_hours,
    },
    {
      key: "rfqs",
      href: "/admin/solicitudes?estado=assigned",
      count: alerts.rfqs_awaiting_quotes,
      overdue: alerts.rfqs_overdue,
      hours: alerts.unanswered_rfq_hours,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {tiles.map((tile) => {
          const alerting = (tile.overdue ?? 0) > 0;
          return (
            <section
              key={tile.key}
              className={`rounded-xl border p-5 sm:p-6 ${alerting ? "border-danger/40 bg-danger/5" : "border-line bg-surface"}`}
            >
              <h2 className="font-display text-lg font-semibold text-navy-800">{t(`${tile.key}.title`)}</h2>
              <p className="mt-3 font-display text-4xl font-bold text-navy-800">{tile.count}</p>
              <p className="text-sm text-ink-muted">{t(`${tile.key}.countLabel`)}</p>
              <p className={`mt-4 text-sm ${alerting ? "font-semibold text-danger" : "text-ink-muted"}`}>
                {tile.hours === null
                  ? t("noThreshold")
                  : t(`${tile.key}.overdue`, { count: tile.overdue ?? 0, hours: tile.hours })}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                <Link href={tile.href} className="text-navy-800 underline-offset-4 hover:underline">
                  {t(`${tile.key}.review`)}
                </Link>
                {tile.hours === null ? (
                  <Link href="/admin/configuracion" className="text-navy-800 underline-offset-4 hover:underline">
                    {t("setThreshold")}
                  </Link>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <Card title={`${t("quotes.title")} · ${pendingQuotes.length}`}>
        {pendingQuotes.length ? (
          <ul className="divide-y divide-line">
            {pendingQuotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 text-sm text-ink">
                  {t("quotes.item", { number: q.rfqNumber ?? "", product: q.product, factory: q.factoryName })}
                </span>
                <Link href={`/admin/solicitudes/${q.rfqId}`} className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline">
                  {t("quotes.review")}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t("quotes.empty")}</p>
        )}
      </Card>

      <Card title={t("rfqs.toAssignTitle")}>
        <p className="text-ink">
          {t("rfqs.toAssign", { count: alerts.rfqs_to_assign })}
        </p>
        <Link href="/admin/solicitudes?estado=submitted" className="mt-2 inline-block text-sm font-semibold text-navy-800 underline-offset-4 hover:underline">
          {t("rfqs.assignNow")}
        </Link>
      </Card>
    </div>
  );
}
