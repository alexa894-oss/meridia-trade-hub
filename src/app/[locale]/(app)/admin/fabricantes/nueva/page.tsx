import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loadCategoryOptions } from "@/lib/admin/factories";
import { countryOptions } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { FactoryForm } from "@/components/admin/factory-form";

export const instant = false;

// Red de fabricantes → Agregar fabricante (formulario interno).
export default async function NewFactoryPage() {
  const [t, locale, categories] = await Promise.all([getTranslations("Admin.factories"), getLocale(), loadCategoryOptions()]);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/admin/fabricantes" className="text-sm font-semibold text-navy-800 hover:underline">
          ← {t("back")}
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("add")}</h1>
        <p className="mt-1 text-ink-muted">{t("addIntro")}</p>
      </div>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <FactoryForm
          initial={{}}
          countries={countryOptions(locale).map((c) => ({ value: c.code, label: c.name }))}
          categories={categories.map((c) => ({ value: c.id, label: localized(c.names, locale) }))}
        />
      </section>
    </div>
  );
}
