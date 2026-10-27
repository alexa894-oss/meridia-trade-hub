"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, FormAlert, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { signIn } from "../actions";

export function SignInForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const t = useTranslations("SignIn");
  const tf = useTranslations("Forms");
  const fieldError = useFieldError();
  const [state, action] = useActionState(signIn, initialFormState);

  return (
    <form action={action} noValidate className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.formError ? (
        <FormAlert>{tf(`formErrors.${state.formError}`)}</FormAlert>
      ) : linkError ? (
        <FormAlert>{tf("formErrors.linkExpired")}</FormAlert>
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
      <Field
        name="password"
        type="password"
        autoComplete="current-password"
        label={tf("fields.password")}
        error={fieldError(state.fieldErrors?.password, tf("fields.password"))}
      />

      <div className="text-right">
        <Link href="/recuperar" className="text-sm font-medium text-navy-800 underline-offset-4 hover:underline">
          {t("forgot")}
        </Link>
      </div>

      <SubmitButton>{t("submit")}</SubmitButton>

      <p className="text-center text-sm text-ink-muted">
        {t("noAccount")}{" "}
        <Link href="/solicitar-acceso" className="font-semibold text-navy-800 underline-offset-4 hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </form>
  );
}
