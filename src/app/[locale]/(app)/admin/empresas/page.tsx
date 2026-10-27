import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { companyStatuses, countCompaniesByStatus, listCompanies } from "@/lib/admin/load";
import { countryName } from "@/lib/countries";
import { formatDate, StatusBadge } from "@/components/admin/ui";
import type { Database } from "@/lib/supabase/database.types";

type Status = Database["public"]["Enums"]["company_status"];
type Kind = Database["public"]["Enums"]["company_kind"];

export const instant = false;

// "Empresas por validar": compradoras y fábricas con documentos, fechas y estado.
export default async function CompaniesPage({ searchParams }: PageProps<"/[locale]/admin/empresas">) {
  const sp = await searchParams;
  const status = (typeof sp.estado === "string" && [...companyStatuses, "all"].includes(sp.estado) ? sp.estado : "all") as Status | "all";
  // Los compradores se revisan en "Solicitudes de acceso".
  const kind: Kind = "factory";

  const [t, ts, locale, companies, counts] = await Promise.all([
    getTranslations("Admin.companies"),
    getTranslations("Admin.status"),
    getLocale(),
    listCompanies({ status, kind }),
    countCompaniesByStatus("factory"),
  ]);
  const href = (next: { estado?: string }) => {
    const params = new URLSearchParams({ estado: next.estado ?? status });
    return `/admin/empresas?${params}`;
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          {[...companyStatuses, "all" as const].map((s) => (
            <li key={s} className="shrink-0">
              <Link
                href={href({ estado: s })}
                aria-current={s === status ? "true" : undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-(--radius-control) border px-3 text-sm ${
                  s === status ? "border-navy-800 bg-navy-800 text-white" : "border-line bg-surface text-ink"
                }`}
              >
                {s === "all" ? t("all") : ts(s)}
                {s !== "all" ? <span className="opacity-70">{counts[s] ?? 0}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {companies.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {companies.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/empresas/${c.id}`}
                className="grid gap-2 p-4 hover:bg-navy-50 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-800">{c.name ?? t("noName")}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {t(`kind.${c.kind === "buyer" ? (c.accountType ?? "company") : "factory"}`)} ·{" "}
                    {countryName(c.country, locale)} · {t("documents", { count: c.documents })}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {t("registeredAt", { date: formatDate(c.createdAt, locale) })}
                    {c.submittedAt ? ` · ${t("submittedAt", { date: formatDate(c.submittedAt, locale, true) })}` : ""}
                  </p>
                </div>
                <span className="justify-self-start sm:justify-self-end">
                  <StatusBadge status={c.status} label={ts(c.status)} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
