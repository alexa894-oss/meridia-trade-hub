import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countAccessRequestsByStatus, listAccessRequests } from "@/lib/admin/load";
import { countryName } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { formatDate, StatusBadge } from "@/components/admin/ui";
import type { Database } from "@/lib/supabase/database.types";

type Status = Database["public"]["Enums"]["company_status"];

export const instant = false;

const filters = ["pending", "info_requested", "registered", "validated", "rejected", "suspended", "all"] as const;
type Filter = (typeof filters)[number];

// "Solicitudes de acceso": empresas y personas naturales que piden entrar a Meridia.
export default async function AccessRequestsPage({ searchParams }: PageProps<"/[locale]/admin/accesos">) {
  const sp = await searchParams;
  const filter: Filter = typeof sp.estado === "string" && (filters as readonly string[]).includes(sp.estado) ? (sp.estado as Filter) : "pending";

  const [t, ts, locale, rows, counts] = await Promise.all([
    getTranslations("Admin.access"),
    getTranslations("Admin.status"),
    getLocale(),
    listAccessRequests(filter as Status | "pending" | "all"),
    countAccessRequestsByStatus(),
  ]);
  const countFor = (f: Filter) =>
    f === "all" ? null : f === "pending" ? (counts.in_review ?? 0) + (counts.reviewing ?? 0) : (counts[f] ?? 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-ink-muted">{t("intro")}</p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          {filters.map((f) => (
            <li key={f} className="shrink-0">
              <Link
                href={`/admin/accesos?estado=${f}`}
                aria-current={f === filter ? "true" : undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-(--radius-control) border px-3 text-sm ${
                  f === filter ? "border-navy-800 bg-navy-800 text-white" : "border-line bg-surface text-ink"
                }`}
              >
                {t(`filters.${f}`)}
                {countFor(f) !== null ? <span className="opacity-70">{countFor(f)}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-muted">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-surface-muted text-xs tracking-wide text-ink-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.name")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.type")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.country")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.sector")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.date")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.status")}</th>
                <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">{t("columns.action")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-navy-50">
                  <td className="px-4 py-3 font-semibold text-navy-800">{r.name ?? t("noName")}</td>
                  <td className="px-4 py-3">{t(`types.${r.accountType ?? "company"}`)}</td>
                  <td className="px-4 py-3">{countryName(r.country, locale)}</td>
                  <td className="px-4 py-3">{r.sector ? localized(r.sector, locale) : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.submittedAt ?? r.createdAt, locale)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} label={ts(r.status)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/accesos/${r.id}`} className="inline-flex min-h-9 items-center rounded-(--radius-control) border border-navy-800 px-3 font-semibold text-navy-800 hover:bg-navy-50">
                      {t("review")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
