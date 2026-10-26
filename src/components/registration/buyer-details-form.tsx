"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SelectField, SubmitButton, TextareaField, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { saveBuyerDetails } from "@/lib/registration/actions";

type Initial = {
  accountType: "company" | "individual" | null;
  country: string | null;
  legalName: string | null;
  taxId: string | null;
  sectorId: string | null;
  website: string | null;
  fullName: string | null;
  projectDescription: string | null;
};

export function BuyerDetailsForm({
  initial,
  countries,
  sectors,
  allowIndividual,
}: {
  initial: Initial;
  countries: { value: string; label: string }[];
  sectors: { value: string; label: string }[];
  allowIndividual: boolean;
}) {
  const t = useTranslations("Registration");
  const tf = useTranslations("Registration.fields");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveBuyerDetails, initialFormState);
  const v = { ...initial, ...state.values } as Record<string, string | null | undefined>;
  const [accountType, setAccountType] = useState<string>(v.accountType ?? (allowIndividual ? "" : "company"));
  const err = (name: keyof Initial, label: string, values?: Record<string, number>) =>
    fieldError(state.fieldErrors?.[name], label, values);

  const types = allowIndividual ? (["company", "individual"] as const) : (["company"] as const);
  const typeError = err("accountType", tf("accountType"));

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert>{t(`formErrors.${state.formError}`)}</FormAlert> : null}

      <fieldset aria-describedby={typeError ? "accountType-error" : undefined}>
        <legend className="text-sm font-medium text-ink">{tf("accountType")}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {types.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer gap-3 rounded-(--radius-control) border border-line p-4 has-checked:border-navy-800 has-checked:bg-navy-50"
            >
              <input
                type="radio"
                name="accountType"
                value={type}
                checked={accountType === type}
                onChange={() => setAccountType(type)}
                className="mt-1 accent-navy-800"
              />
              <span>
                <span className="block font-display font-semibold text-navy-800">{t(`accountTypes.${type}.title`)}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{t(`accountTypes.${type}.body`)}</span>
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

      <SelectField
        name="country"
        label={tf("country")}
        placeholder={t("choose")}
        options={countries}
        defaultValue={v.country ?? ""}
        error={err("country", tf("country"))}
      />

      {accountType === "company" ? (
        <>
          <Field
            name="legalName"
            label={tf("legalName")}
            autoComplete="organization"
            defaultValue={v.legalName ?? ""}
            error={err("legalName", tf("legalName"))}
          />
          <Field
            name="taxId"
            label={tf("taxId")}
            hint={t("hints.taxId")}
            defaultValue={v.taxId ?? ""}
            error={err("taxId", tf("taxId"))}
          />
          <SelectField
            name="sectorId"
            label={tf("sector")}
            placeholder={t("choose")}
            options={sectors}
            defaultValue={v.sectorId ?? ""}
            error={err("sectorId", tf("sector"))}
          />
          <Field
            name="website"
            label={`${tf("website")} · ${t("optional")}`}
            inputMode="url"
            placeholder="www.empresa.com"
            defaultValue={v.website ?? ""}
            error={err("website", tf("website"))}
          />
        </>
      ) : accountType === "individual" ? (
        <>
          <Field
            name="fullName"
            label={tf("fullName")}
            autoComplete="name"
            defaultValue={v.fullName ?? ""}
            error={err("fullName", tf("fullName"))}
          />
          <TextareaField
            name="projectDescription"
            label={tf("projectDescription")}
            hint={t("hints.projectDescription")}
            defaultValue={v.projectDescription ?? ""}
            error={err("projectDescription", tf("projectDescription"), { min: 50 })}
          />
        </>
      ) : null}

      <SubmitButton>{t("saveAndContinue")}</SubmitButton>
    </form>
  );
}
