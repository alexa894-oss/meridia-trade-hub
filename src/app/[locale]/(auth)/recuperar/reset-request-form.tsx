"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, FormAlert, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { requestPasswordReset } from "../actions";

export function ResetRequestForm() {
  const t = useTranslations("Recover");
  const tf = useTranslations("Forms");
  const fieldError = useFieldError();
  const [state, action] = useActionState(requestPasswordReset, initialFormState);

  return (
    <form action={action} noValidate className="space-y-5">
      {state.status === "success" ? (
        <FormAlert tone="success">{t("sent", { email: state.values?.email ?? "" })}</FormAlert>
      ) : state.formError ? (
        <FormAlert>{tf(`formErrors.${state.formError}`)}</FormAlert>
      ) : null}

      <Field
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        label={tf("fields.email")}
        defaultValue={state.values?.email}
        error={fieldError(state.fieldErrors?.email, tf("fields.email"))}
      />

      <SubmitButton>{t("submit")}</SubmitButton>

      <Link href="/ingresar" className="block text-center text-sm font-semibold text-navy-800 hover:underline">
        {t("back")}
      </Link>
    </form>
  );
}
