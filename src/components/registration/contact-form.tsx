"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState, type FormState } from "@/lib/forms";
import { saveContact } from "@/lib/registration/actions";

type Initial = {
  contactName: string | null;
  contactTitle: string | null;
  phone: string | null;
  email: string | null;
  wechat: string | null;
};
type ContactField = keyof Initial;

export function ContactForm({
  role,
  initial,
  isIndividual,
}: {
  role: "buyer" | "factory";
  initial: Initial;
  isIndividual: boolean;
}) {
  const t = useTranslations("Registration");
  const tf = useTranslations("Registration.fields");
  const fieldError = useFieldError();
  const [state, action] = useActionState<FormState<ContactField>, FormData>(
    saveContact.bind(null, role),
    initialFormState,
  );
  const v = { ...initial, ...state.values } as Record<string, string | null | undefined>;
  const err = (name: ContactField, label: string) => fieldError(state.fieldErrors?.[name], label);

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert>{t(`formErrors.${state.formError}`)}</FormAlert> : null}
      <p className="rounded-(--radius-control) bg-navy-50 px-4 py-3 text-sm text-ink">{t("privacyNote")}</p>

      {isIndividual ? null : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="contactName"
            label={tf("contactName")}
            autoComplete="name"
            defaultValue={v.contactName ?? ""}
            error={err("contactName", tf("contactName"))}
          />
          <Field
            name="contactTitle"
            label={tf("contactTitle")}
            autoComplete="organization-title"
            defaultValue={v.contactTitle ?? ""}
            error={err("contactTitle", tf("contactTitle"))}
          />
        </div>
      )}
      <Field
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        label={tf("phone")}
        hint={t("hints.phone")}
        defaultValue={v.phone ?? ""}
        error={err("phone", tf("phone"))}
      />
      <Field
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        label={tf("email")}
        defaultValue={v.email ?? ""}
        error={err("email", tf("email"))}
      />
      {role === "factory" ? (
        <Field name="wechat" label={tf("wechat")} defaultValue={v.wechat ?? ""} error={err("wechat", tf("wechat"))} />
      ) : null}

      <SubmitButton>{t("saveAndContinue")}</SubmitButton>
    </form>
  );
}
