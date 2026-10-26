"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, FormAlert, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState, MIN_PASSWORD_LENGTH } from "@/lib/forms";
import { signUp } from "../actions";

const accountRoles = ["buyer", "factory"] as const;

export function SignUpForm() {
  const t = useTranslations("SignUp");
  const tf = useTranslations("Forms");
  const fieldError = useFieldError();
  const [state, action] = useActionState(signUp, initialFormState);

  if (state.status === "success" && state.message === "checkEmail") {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">{t("checkEmail", { email: state.values?.email ?? "" })}</FormAlert>
        <Link href="/ingresar" className="block text-center text-sm font-semibold text-navy-800 hover:underline">
          {t("goToSignIn")}
        </Link>
      </div>
    );
  }

  const roleError = fieldError(state.fieldErrors?.accountRole, tf("fields.accountRole"));

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert>{tf(`formErrors.${state.formError}`)}</FormAlert> : null}

      <fieldset aria-describedby={roleError ? "accountRole-error" : undefined}>
        <legend className="text-sm font-medium text-ink">{tf("fields.accountRole")}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {accountRoles.map((role) => (
            <label
              key={role}
              className="flex cursor-pointer gap-3 rounded-(--radius-control) border border-line p-4 transition-colors has-checked:border-navy-800 has-checked:bg-navy-50"
            >
              <input
                type="radio"
                name="accountRole"
                value={role}
                defaultChecked={state.values?.accountRole === role}
                className="mt-1 accent-navy-800"
              />
              <span>
                <span className="block font-display font-semibold text-navy-800">{t(`roles.${role}.title`)}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{t(`roles.${role}.body`)}</span>
              </span>
            </label>
          ))}
        </div>
        {roleError ? (
          <p id="accountRole-error" className="mt-1.5 text-sm text-danger">
            {roleError}
          </p>
        ) : null}
      </fieldset>

      <Field
        name="fullName"
        autoComplete="name"
        label={tf("fields.fullName")}
        defaultValue={state.values?.fullName}
        error={fieldError(state.fieldErrors?.fullName, tf("fields.fullName"))}
      />
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

      <p className="text-center text-sm text-ink-muted">
        {t("haveAccount")}{" "}
        <Link href="/ingresar" className="font-semibold text-navy-800 underline-offset-4 hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
