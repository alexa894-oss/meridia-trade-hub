"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckboxField, FormAlert, SubmitButton } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { acceptPendingLegal } from "@/lib/legal/actions";

export function LegalAcceptForm({ documents }: { documents: { id: string; kind: string; version: number; text: string; isDraft: boolean }[] }) {
  const t = useTranslations("LegalUpdate");
  const tr = useTranslations("Registration.legal");
  const [state, action] = useActionState(acceptPendingLegal, initialFormState);
  return (
    <form action={action} className="space-y-6">
      {state.formError ? <FormAlert>{t(`errors.${state.formError}`)}</FormAlert> : null}
      {documents.map((d) => (
        <section key={d.id} className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-navy-800">
            {tr(d.kind)} <span className="text-sm font-normal text-ink-muted">· v{d.version}</span>
          </h2>
          {d.isDraft ? <p className="rounded-(--radius-control) border border-gold-300 bg-gold-100 px-4 py-3 text-sm">{tr("draftNotice")}</p> : null}
          <div className="max-h-72 overflow-y-auto rounded-(--radius-control) border border-line bg-surface-muted p-4 text-sm whitespace-pre-line">{d.text}</div>
          <CheckboxField name={`accept_${d.id}`} label={tr("accept", { document: tr(d.kind) })} />
        </section>
      ))}
      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
