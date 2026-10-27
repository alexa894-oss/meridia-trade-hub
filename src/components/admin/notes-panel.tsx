"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormAlert, SubmitButton, TextareaField, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { addCompanyNote } from "@/lib/admin/actions";

// Observaciones internas del expediente: solo administradores.
export function NoteForm({ companyId }: { companyId: string }) {
  const t = useTranslations("Admin.notes");
  const fieldError = useFieldError();
  const [state, action] = useActionState(addCompanyNote, initialFormState);

  return (
    <form action={action} noValidate className="space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "success" ? <FormAlert tone="success">{t("saved")}</FormAlert> : null}
      {state.formError ? <FormAlert>{t("error")}</FormAlert> : null}
      <TextareaField
        name="body"
        label={t("label")}
        hint={t("hint")}
        defaultValue={state.values?.body ?? ""}
        error={fieldError(state.fieldErrors?.body, t("label"))}
      />
      <SubmitButton>{t("add")}</SubmitButton>
    </form>
  );
}
