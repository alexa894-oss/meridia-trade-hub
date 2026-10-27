"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckboxField, Field, FormAlert, SelectField, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { saveContact } from "@/lib/registration/actions";

type Initial = {
  contactName: string | null;
  contactTitle: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  contactCountry: string | null;
  city: string | null;
  authorized: boolean;
};
type ContactField = keyof Initial;

// Paso 2: representante y contacto (empresa) o contacto (persona natural).
export function ContactForm({
  initial,
  isIndividual,
  countries,
}: {
  initial: Initial;
  isIndividual: boolean;
  countries: { value: string; label: string }[];
}) {
  const t = useTranslations("Registration");
  const tf = useTranslations("Registration.fields");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveContact, initialFormState);
  const v = { ...initial, ...state.values } as Record<string, string | boolean | null | undefined>;
  const text = (name: ContactField) => (typeof v[name] === "string" ? (v[name] as string) : "");
  const err = (name: ContactField, label: string) => fieldError(state.fieldErrors?.[name], label);
  const authorizedDefault = state.values ? state.values.authorized === "on" : initial.authorized;

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert>{t(`formErrors.${state.formError}`)}</FormAlert> : null}
      <p className="rounded-(--radius-control) bg-navy-50 px-4 py-3 text-sm text-ink">{t("privacyNote")}</p>

      {isIndividual ? null : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="contactName" label={tf("representativeName")} autoComplete="name" defaultValue={text("contactName")} error={err("contactName", tf("representativeName"))} />
          <Field name="contactTitle" label={tf("contactTitle")} autoComplete="organization-title" defaultValue={text("contactTitle")} error={err("contactTitle", tf("contactTitle"))} />
        </div>
      )}
      <Field
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        label={isIndividual ? tf("email") : tf("corporateEmail")}
        defaultValue={text("email")}
        error={err("email", isIndividual ? tf("email") : tf("corporateEmail"))}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="phone" type="tel" autoComplete="tel" inputMode="tel" label={tf("phone")} hint={t("hints.phone")} defaultValue={text("phone")} error={err("phone", tf("phone"))} />
        <Field name="whatsapp" type="tel" inputMode="tel" label={tf("whatsapp")} hint={t("hints.whatsapp")} defaultValue={text("whatsapp")} error={err("whatsapp", tf("whatsapp"))} />
      </div>
      {isIndividual ? null : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              name="contactCountry"
              label={tf("contactCountry")}
              placeholder={t("choose")}
              options={countries}
              defaultValue={text("contactCountry")}
              error={err("contactCountry", tf("contactCountry"))}
            />
            <Field name="city" label={tf("city")} autoComplete="address-level2" defaultValue={text("city")} error={err("city", tf("city"))} />
          </div>
          <CheckboxField
            name="authorized"
            defaultChecked={authorizedDefault}
            label={t("authorizedRepresentative")}
            error={err("authorized", t("authorizedRepresentativeShort"))}
          />
        </>
      )}

      <SubmitButton>{t("saveAndContinue")}</SubmitButton>
    </form>
  );
}
