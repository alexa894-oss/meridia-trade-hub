import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listFactories } from "@/lib/admin/factories";
import { countryName } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { ButtonLink } from "@/components/button-link";
import { StatusBadge } from "@/components/admin/ui";

export const instant = false;

// "Red de fabricantes": directorio interno (los compradores nunca lo ven).
export default async function FactoriesPage() {
  const [t, locale, factories] = await Promise.all([getTranslations("Admin.factories"), getLocale(), listFactories()]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-ink-muted">{t("intro")}</p>
        </div>
        <ButtonLink href="/admin/fabricantes/nueva">{t("add")}</ButtonLink>
      </div>

      {factories.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-muted">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-line bg-surface-muted text-xs tracking-wide text-ink-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.name")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.country")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.categories")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.verifications")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.account")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("columns.status")}</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t("columns.action")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {factories.map((f) => {
                const done = [f.verifications.identity, f.verifications.capacity, f.verifications.history].filter(Boolean).length;
                return (
                  <tr key={f.id} className="hover:bg-navy-50">
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-navy-800">{f.name ?? t("noName")}</span>
                      {f.legalName && f.legalName !== f.name ? <span className="block text-xs text-ink-muted">{f.legalName}</span> : null}
                    </td>
                    <td className="px-4 py-3">{countryName(f.country, locale)}</td>
                    <td className="px-4 py-3">{f.categories.map((c) => localized(c, locale)).join(", ") || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={done === 3 ? "font-semibold text-success" : "text-ink"}>{t("verifiedCount", { count: done })}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{t(`account.${f.account}`)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={f.status} label={t(`status.${f.status}`)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/fabricantes/${f.id}`} className="inline-flex min-h-9 items-center rounded-(--radius-control) border border-navy-800 px-3 font-semibold whitespace-nowrap text-navy-800 hover:bg-navy-50">
                        {t("open")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
