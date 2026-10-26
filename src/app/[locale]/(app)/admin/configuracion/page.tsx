import { getLocale, getTranslations } from "next-intl/server";
import { loadSettingsPage } from "@/lib/admin/load";
import { localized } from "@/lib/registration/load";
import { Card, formatDate } from "@/components/admin/ui";
import { LegalVersionForm, OptionsEditor, SettingsForm } from "@/components/admin/settings-forms";

export const instant = false;

export default async function SettingsPage() {
  const [t, locale, data] = await Promise.all([getTranslations("Admin.settings"), getLocale(), loadSettingsPage()]);
  const asRows = (rows: typeof data.sectors) =>
    rows.map((r) => ({ id: r.id, slug: r.slug, names: r.names as Record<string, string>, active: r.active, sort_order: r.sort_order }));

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>

      <Card title={t("platform")}>
        <SettingsForm settings={data.settings} />
      </Card>

      {(["terms", "non_circumvention"] as const).map((kind) => {
        const versions = data.legal.filter((d) => d.kind === kind);
        const current = versions[0];
        return (
          <Card key={kind} title={t(`legal.${kind}`)}>
            {current ? (
              <p className="mb-3 text-sm text-ink-muted">
                {t("currentVersion", {
                  version: current.version,
                  state: current.is_draft ? t("draft") : t("published"),
                  date: formatDate(current.published_at ?? current.created_at, locale),
                })}
              </p>
            ) : null}
            <p className="mb-3 text-sm text-ink-muted">{t("legalHint")}</p>
            <LegalVersionForm kind={kind} current={current ? localized(current.content as Record<string, string>, locale) : ""} />
          </Card>
        );
      })}

      <Card title={t("sectors")}>
        <OptionsEditor table="sectors" rows={asRows(data.sectors)} />
      </Card>
      <Card title={t("categories")}>
        <OptionsEditor table="categories" rows={asRows(data.categories)} />
      </Card>
      <Card title={t("units")}>
        <OptionsEditor table="units" rows={asRows(data.units)} />
      </Card>
    </div>
  );
}
