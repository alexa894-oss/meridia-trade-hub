"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckboxField, FormAlert, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { submitRegistration } from "@/lib/registration/actions";

type LegalKind = "terms" | "non_circumvention" | "privacy";
type LegalDoc = { id: string; kind: LegalKind; version: number; text: string; isDraft: boolean };

const fieldFor = { terms: "acceptTerms", privacy: "acceptPrivacy", non_circumvention: "acceptNonCircumvention" } as const;

// Paso 4: resumen, aceptación de textos legales y "Enviar solicitud de acceso".
export function SubmitStep({
  legalDocuments,
  acceptedIds,
  summary,
}: {
  legalDocuments: LegalDoc[];
  acceptedIds: string[];
  summary: { label: string; done: boolean }[];
}) {
  const t = useTranslations("Registration");
  const fieldError = useFieldError();
  const [state, action] = useActionState(submitRegistration, initialFormState);

  return (
    <form action={action} noValidate className="space-y-6">
      {state.formError ? <FormAlert>{t(`formErrors.${state.formError}`)}</FormAlert> : null}

      <section>
        <h2 className="font-display text-lg font-semibold text-navy-800">{t("summaryTitle")}</h2>
        <ul className="mt-3 space-y-2">
          {summary.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className={`inline-flex size-5 items-center justify-center rounded-full text-xs font-bold ${
                  item.done ? "bg-success text-white" : "bg-navy-100 text-ink-muted"
                }`}
              >
                {item.done ? "✓" : "·"}
              </span>
              <span className={item.done ? "text-ink" : "text-ink-muted"}>
                {item.label} · {item.done ? t("stepDone") : t("stepPending")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {legalDocuments.map((doc) => {
        const title = t(`legal.${doc.kind}`);
        const name = fieldFor[doc.kind];
        return (
          <section key={doc.id} className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-navy-800">
              {title} <span className="text-sm font-normal text-ink-muted">· v{doc.version}</span>
            </h2>
            {doc.isDraft ? (
              <p role="note" className="rounded-(--radius-control) border border-gold-300 bg-gold-100 px-4 py-3 text-sm text-ink">
                {t("legal.draftNotice")}
              </p>
            ) : null}
            <div className="max-h-56 overflow-y-auto rounded-(--radius-control) border border-line bg-surface-muted p-4 text-sm whitespace-pre-line text-ink">
              {doc.text}
            </div>
            <CheckboxField
              name={name}
              defaultChecked={acceptedIds.includes(doc.id)}
              label={t("legal.accept", { document: title })}
              error={fieldError(state.fieldErrors?.[name], title)}
            />
          </section>
        );
      })}

      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
