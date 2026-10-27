"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, FormAlert, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState, MIN_PASSWORD_LENGTH } from "@/lib/forms";
import { acceptInvitation } from "@/lib/registration/invitation-actions";

export function InvitationForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("Invitation");
  const tf = useTranslations("Forms");
  const fieldError = useFieldError();
  const [state, action] = useActionState(acceptInvitation.bind(null, token), initialFormState);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">{t("checkEmail", { email: state.message ?? email })}</FormAlert>
        <Link href="/ingresar" className="block text-center text-sm font-semibold text-navy-800 hover:underline">
          {t("goToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert>{t(`errors.${state.formError}`)}</FormAlert> : null}
      <p className="rounded-(--radius-control) bg-navy-50 px-4 py-3 text-sm text-ink">{t("emailFixed", { email })}</p>
      <Field name="fullName" autoComplete="name" label={tf("fields.fullName")} defaultValue={state.values?.fullName} error={fieldError(state.fieldErrors?.fullName, tf("fields.fullName"))} />
      <Field
        name="password"
        type="password"
        autoComplete="new-password"
        label={tf("fields.password")}
        hint={tf("passwordHint", { min: MIN_PASSWORD_LENGTH })}
        error={fieldError(state.fieldErrors?.password, tf("fields.password"))}
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
