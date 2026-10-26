import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/button-link";
import type { CurrentProfile } from "@/lib/auth/session";
import { loadRegistration } from "@/lib/registration/load";
import { registrationBase } from "@/lib/registration/steps";

// Estado del registro de la empresa en el panel del comprador o la fábrica.
// "Verificada" solo aparece cuando un administrador validó la empresa.
export async function RegistrationStatusCard({ profile, role }: { profile: CurrentProfile; role: "buyer" | "factory" }) {
  const t = await getTranslations("RegistrationStatus");
  const data = await loadRegistration(profile);
  const status = data.company?.status ?? "not_started";
  const href = registrationBase(role);
  const tone =
    status === "validated"
      ? "border-success/30 bg-success/5"
      : status === "rejected" || status === "suspended"
        ? "border-danger/30 bg-danger/5"
        : "border-gold-300 bg-gold-100";

  return (
    <section className={`rounded-xl border p-6 ${tone}`}>
      <p className="text-sm font-semibold tracking-wide text-ink-muted uppercase">{t("label")}</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-navy-800">{t(`${status}.title`)}</h2>
      <p className="mt-2 text-ink">{t(`${status}.body`)}</p>
      {(status === "info_requested" || status === "rejected") && data.latestReview?.message ? (
        <p className="mt-3 rounded-(--radius-control) bg-surface px-4 py-3 text-sm whitespace-pre-line text-ink">
          <span className="font-semibold">{t("messageFromMeridia")}</span> {data.latestReview.message}
        </p>
      ) : null}
      {status === "not_started" || status === "registered" || status === "info_requested" ? (
        <ButtonLink href={href} className="mt-4">
          {t(`${status}.cta`)}
        </ButtonLink>
      ) : null}
    </section>
  );
}
