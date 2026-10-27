"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { createInvitation, saveVerifications } from "@/lib/admin/factory-actions";

type Check = { key: "identity" | "capacity" | "history"; on: boolean; detail: string | null };

// Tres verificaciones independientes. "Verificada" para el comprador = las tres.
export function VerificationsForm({ companyId, checks }: { companyId: string; checks: Check[] }) {
  const t = useTranslations("Admin.factories.verifications");
  const [state, action] = useActionState(saveVerifications, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "success" ? <FormAlert tone="success">{t("saved")}</FormAlert> : null}
      {state.formError ? <FormAlert>{t("error")}</FormAlert> : null}
      {checks.map((c) => (
        <label key={c.key} className="flex cursor-pointer items-start gap-3 rounded-(--radius-control) border border-line p-3 has-checked:border-success/40 has-checked:bg-success/5">
          <input type="checkbox" name={c.key} defaultChecked={c.on} className="mt-0.5 size-5 accent-navy-800" />
          <span>
            <span className="block font-semibold text-navy-800">{t(`${c.key}.title`)}</span>
            <span className="block text-sm text-ink-muted">{t(`${c.key}.body`)}</span>
            {c.on && c.detail ? <span className="mt-1 block text-xs text-success">{c.detail}</span> : null}
          </span>
        </label>
      ))}
      <p className="text-sm text-ink-muted">{t("rule")}</p>
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}

// Invitación privada: genera un enlace de un solo uso para enviarlo por WhatsApp o correo.
export function InvitationForm({ companyId, defaultEmail, hasPending }: { companyId: string; defaultEmail: string; hasPending: boolean }) {
  const t = useTranslations("Admin.factories.invitation");
  const fieldError = useFieldError();
  const [state, action] = useActionState(createInvitation, initialFormState);
  const [copied, setCopied] = useState(false);
  const link = state.status === "success" ? state.message : null;

  return (
    <div className="space-y-4">
      {link ? (
        <div className="space-y-2 rounded-(--radius-control) border border-success/30 bg-success/5 p-3">
          <p className="text-sm font-semibold text-navy-800">{t("created")}</p>
          <p className="text-sm text-ink">{t("createdBody")}</p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-(--radius-control) border border-line bg-surface px-3 py-2 text-sm" aria-label={t("linkLabel")} />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
            className="inline-flex min-h-10 items-center rounded-(--radius-control) bg-navy-800 px-4 text-sm font-semibold text-white hover:bg-navy-900"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      ) : null}
      <form action={action} noValidate className="space-y-3">
        <input type="hidden" name="companyId" value={companyId} />
        {state.formError ? <FormAlert>{t("error")}</FormAlert> : null}
        <Field
          name="email"
          type="email"
          inputMode="email"
          label={t("email")}
          hint={t("emailHint")}
          defaultValue={state.values?.email ?? defaultEmail}
          error={fieldError(state.fieldErrors?.email, t("email"))}
        />
        <SubmitButton>{hasPending || link ? t("regenerate") : t("invite")}</SubmitButton>
      </form>
    </div>
  );
}
