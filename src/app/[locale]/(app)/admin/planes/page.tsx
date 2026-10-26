import { getLocale, getTranslations } from "next-intl/server";
import { listPlans } from "@/lib/admin/load";
import { Card } from "@/components/admin/ui";
import { PlanForm } from "@/components/admin/plan-form";

export const instant = false;

// Planes de membresía de fábricas. La tabla nace vacía: el administrador define
// nombre, precio, moneda y periodicidad. Ningún plan puede mencionar el showroom.
export default async function PlansPage() {
  const [t, locale, plans] = await Promise.all([getTranslations("Admin.plans"), getLocale(), listPlans()]);
  const money = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-ink-muted">{t("intro")}</p>
      </div>

      {plans.length === 0 ? <p className="rounded-xl border border-line bg-surface p-5 text-ink-muted">{t("empty")}</p> : null}

      {plans.map((plan) => (
        <details key={plan.id} className="group rounded-xl border border-line bg-surface">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-5">
            <span>
              <span className="font-display text-lg font-semibold text-navy-800">{plan.name}</span>
              <span className="block text-sm text-ink-muted">
                {money(Number(plan.price), plan.currency)} · {t(`periods.${plan.billing_period}`)}
              </span>
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${plan.active ? "bg-success/10 text-success" : "bg-navy-50 text-ink-muted"}`}>
              {plan.active ? t("active") : t("inactive")}
            </span>
          </summary>
          <div className="border-t border-line p-5">
            <PlanForm plan={{ ...plan, price: Number(plan.price) }} />
          </div>
        </details>
      ))}

      <Card title={t("newPlan")}>
        <PlanForm />
      </Card>
    </div>
  );
}
