"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState, MIN_PASSWORD_LENGTH } from "@/lib/forms";
import { updatePassword } from "../actions";

export function NewPasswordForm() {
  const t = useTranslations("NewPassword");
  const tf = useTranslations("Forms");
  const fieldError = useFieldError();
  const [state, action] = useActionState(updatePassword, initialFormState);

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert>{tf(`formErrors.${state.formError}`)}</FormAlert> : null}

      <Field
        name="password"
        type="password"
        autoComplete="new-password"
        label={tf("fields.newPassword")}
        hint={tf("passwordHint", { min: MIN_PASSWORD_LENGTH })}
        error={fieldError(state.fieldErrors?.password, tf("fields.newPassword"))}
      />
      <Field
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        label={tf("fields.passwordConfirm")}
        error={fieldError(state.fieldErrors?.passwordConfirm, tf("fields.passwordConfirm"))}
      />

      <SubmitButton>{t("submit")}</SubmitButton>
    </form>
  );
}
