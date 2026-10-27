"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Field, FormAlert, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState, MIN_PASSWORD_LENGTH } from "@/lib/forms";
import { signUp } from "../actions";

// Las fábricas no se registran aquí: las incorpora Meridia.
const accountTypes = ["company", "individual"] as const;

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

  const typeError = fieldError(state.fieldErrors?.accountType, t("typeQuestion"));

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert>{tf(`formErrors.${state.formError}`)}</FormAlert> : null}

      <fieldset aria-describedby={typeError ? "accountType-error" : undefined}>
        <legend className="font-display text-base font-semibold text-navy-800">{t("typeQuestion")}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {accountTypes.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer gap-3 rounded-(--radius-control) border border-line p-4 transition-colors has-checked:border-navy-800 has-checked:bg-navy-50"
            >
              <input
                type="radio"
                name="accountType"
                value={type}
                defaultChecked={state.values?.accountType === type}
                className="mt-1 accent-navy-800"
              />
              <span>
                <span className="block font-display font-semibold text-navy-800">{t(`types.${type}.title`)}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{t(`types.${type}.body`)}</span>
              </span>
            </label>
          ))}
        </div>
        {typeError ? (
          <p id="accountType-error" className="mt-1.5 text-sm text-danger">
            {typeError}
          </p>
        ) : null}
      </fieldset>
      <p className="text-sm text-ink-muted">{t("reviewNotice")}</p>

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
