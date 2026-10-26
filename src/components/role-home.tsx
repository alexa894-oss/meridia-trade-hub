import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import type { Role } from "@/lib/auth/roles";

// Inicio de cada rol: perfil con su rol y el siguiente paso.
// Va dentro del <Suspense> del layout del rol.
export async function RoleHome({ role }: { role: Role }) {
  const profile = await requireRole(role);
  const t = await getTranslations("App");

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-sm font-semibold tracking-widest text-gold-700 uppercase">
          {t(`roles.${role}`)}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-navy-800 sm:text-3xl">
          {t("greeting", { name: profile.fullName ?? "" })}
        </h1>
      </div>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold text-navy-800">{t("profile.title")}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-ink-muted">{t("profile.name")}</dt>
            <dd className="mt-0.5 font-medium break-words">{profile.fullName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t("profile.email")}</dt>
            <dd className="mt-0.5 font-medium break-words">{profile.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t("profile.role")}</dt>
            <dd className="mt-0.5 font-medium">{t(`roles.${role}`)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-gold-300 bg-gold-100 p-6">
        <h2 className="font-display text-lg font-semibold text-navy-800">{t("nextStep.title")}</h2>
        <p className="mt-2 text-ink">{t(`nextStep.${role}`)}</p>
      </section>
    </div>
  );
}
