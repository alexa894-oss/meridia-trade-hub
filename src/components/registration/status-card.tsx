import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/button-link";
import { formatDate } from "@/components/admin/ui";
import type { CurrentProfile } from "@/lib/auth/session";
import { loadRegistration, type CompanyStatus } from "@/lib/registration/load";
import { REQUEST_BASE } from "@/lib/registration/steps";
import { DocumentUpload } from "./document-upload";

type TrackerStatus = CompanyStatus | "not_started";

// Hitos visibles de la solicitud: recibida → en revisión → aprobada.
const milestones = ["in_review", "reviewing", "validated"] as const;

// Seguimiento de la solicitud de acceso. "Aprobada" solo aparece cuando Meridia la aprueba.
export async function RequestTracker({ profile, justSubmitted = false }: { profile: CurrentProfile; justSubmitted?: boolean }) {
  const [t, tr, tf, locale, data] = await Promise.all([
    getTranslations("RegistrationStatus"),
    getTranslations("Registration"),
    getTranslations("Registration.fields"),
    getLocale(),
    loadRegistration(profile),
  ]);
  const status = (data.company?.status ?? "not_started") as TrackerStatus;
  const editable = status === "not_started" || status === "registered" || status === "info_requested";
  // Documentos: se pueden subir mientras la solicitud no esté resuelta.
  const acceptsDocuments = !!data.company && ["registered", "info_requested", "in_review", "reviewing"].includes(status);
  const isIndividual = data.buyer?.accountType === "individual";
  const docsOf = (kind: string) => data.documents.filter((d) => d.kind === kind).map((d) => ({ id: d.id, fileName: d.fileName }));
  const slots = isIndividual
    ? [{ kind: "id_document" as const, label: tf("idDocument"), hint: tr("hints.idDocument") }]
    : [
        { kind: "tax_registration" as const, label: tf("commercialRegistration"), hint: tr("hints.commercialRegistration") },
        { kind: "representation" as const, label: tf("representationDocument"), hint: tr("hints.representationDocument") },
      ];
  const tone =
    status === "validated"
      ? "border-success/30 bg-success/5"
      : status === "rejected" || status === "suspended"
        ? "border-danger/30 bg-danger/5"
        : "border-gold-300 bg-gold-100";

  // Fecha más reciente en que se alcanzó cada hito.
  const reachedAt = (s: string) => [...data.history].reverse().find((h) => h.toStatus === s)?.createdAt ?? null;
  const order: Record<string, number> = { in_review: 0, reviewing: 1, info_requested: 1, validated: 2 };
  const position = order[status] ?? -1;

  return (
    <div className="space-y-5">
      {justSubmitted && status === "in_review" ? (
        <section role="status" className="rounded-xl border border-success/30 bg-success/5 p-6">
          <h2 className="font-display text-lg font-semibold text-navy-800">{t("received.title")}</h2>
          <p className="mt-2 text-ink">{t("received.body")}</p>
        </section>
      ) : null}

      <section className={`rounded-xl border p-6 ${tone}`}>
        <p className="text-sm font-semibold tracking-wide text-ink-muted uppercase">{t("label")}</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-navy-800">{t(`${status}.title`)}</h2>
        <p className="mt-2 text-ink">{t(`${status}.body`)}</p>
        {(status === "info_requested" || status === "rejected") && data.latestReview?.message ? (
          <p className="mt-3 rounded-(--radius-control) bg-surface px-4 py-3 text-sm whitespace-pre-line text-ink">
            <span className="font-semibold">{t("messageFromMeridia")}</span> {data.latestReview.message}
          </p>
        ) : null}
        {editable ? (
          <ButtonLink href={`${REQUEST_BASE}/datos`} className="mt-4">
            {t(`${status}.cta`)}
          </ButtonLink>
        ) : null}
      </section>

      {acceptsDocuments ? (
        <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
          <div>
            <h2 className="font-display text-base font-semibold text-navy-800">{t("documents.title")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("documents.body")}</p>
          </div>
          {slots.map((slot) => (
            <DocumentUpload
              key={slot.kind}
              companyId={data.company!.id}
              kind={slot.kind}
              label={`${slot.label} · ${tr("whenApplicable")}`}
              hint={slot.hint}
              documents={docsOf(slot.kind)}
            />
          ))}
        </section>
      ) : null}

      {position >= 0 && status !== "rejected" && status !== "suspended" ? (
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="font-display text-base font-semibold text-navy-800">{t("timeline")}</h2>
          <ol className="mt-4 space-y-0">
            {milestones.map((m, i) => {
              const at = reachedAt(m);
              const isInfo = m === "reviewing" && status === "info_requested";
              const reached = !isInfo && order[m] <= position;
              return (
                <li key={m} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < milestones.length - 1 ? (
                    <span aria-hidden className={`absolute top-6 left-[11px] h-[calc(100%-1rem)] w-0.5 ${reached ? "bg-gold-500" : "bg-line"}`} />
                  ) : null}
                  <span
                    aria-hidden
                    className={`relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isInfo ? "bg-gold-500 text-navy-900" : reached ? "bg-navy-800 text-white" : "border-2 border-line bg-surface text-ink-muted"
                    }`}
                  >
                    {isInfo ? "!" : reached ? "✓" : i + 1}
                  </span>
                  <div>
                    <p className={`font-semibold ${reached || isInfo ? "text-navy-800" : "text-ink-muted"}`}>
                      {isInfo ? t("info_requested.title") : t(`milestones.${m}`)}
                    </p>
                    <p className="text-sm text-ink-muted">{at && (reached || isInfo) ? formatDate(at, locale, true) : t("pending")}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
