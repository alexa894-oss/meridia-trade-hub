"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SelectField, SubmitButton, useFieldError } from "@/components/forms";
import { ActivityField } from "./activity-field";
import { initialFormState } from "@/lib/forms";
import { saveBuyerDetails } from "@/lib/registration/actions";
import { idTypes } from "@/lib/registration/steps";

type Initial = {
  accountType: "company" | "individual" | null;
  country: string | null;
  legalName: string | null;
  tradeName: string | null;
  taxId: string | null;
  economicActivity: string | null;
  sectorId: string | null;
  website: string | null;
  fullName: string | null;
  idType: string | null;
  idNumber: string | null;
};

// Paso 1: "¿Cómo deseas registrarte?" y el formulario se adapta a la opción.
export function BuyerDetailsForm({
  initial,
  countries,
  sectors,
  otherSectorId,
  allowIndividual,
}: {
  initial: Initial;
  countries: { value: string; label: string }[];
  sectors: { value: string; label: string }[];
  otherSectorId?: string;
  allowIndividual: boolean;
}) {
  const t = useTranslations("Registration");
  const tf = useTranslations("Registration.fields");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveBuyerDetails, initialFormState);
  const v = { ...initial, ...state.values } as Record<string, string | null | undefined>;
  const [accountType, setAccountType] = useState<string>(v.accountType ?? (allowIndividual ? "" : "company"));
  const err = (name: keyof Initial, label: string) => fieldError(state.fieldErrors?.[name], label);
  const activity = (
    <ActivityField
      sectors={sectors}
      otherId={otherSectorId}
      defaultSector={v.sectorId ?? ""}
      defaultActivity={v.economicActivity ?? ""}
      sectorError={err("sectorId", tf("economicActivity"))}
      activityError={err("economicActivity", tf("economicActivityOther"))}
    />
  );

  const types = allowIndividual ? (["company", "individual"] as const) : (["company"] as const);
  const typeError = err("accountType", t("accountTypeQuestion"));
  const isCompany = accountType === "company";

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert>{t(`formErrors.${state.formError}`)}</FormAlert> : null}

      <fieldset aria-describedby={typeError ? "accountType-error" : undefined}>
        <legend className="font-display text-base font-semibold text-navy-800">{t("accountTypeQuestion")}</legend>
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

      {accountType === "individual" ? (
        <p role="note" className="rounded-(--radius-control) border border-gold-300 bg-gold-100 px-4 py-3 text-sm text-ink">
          {t("individualNotice")}
        </p>
      ) : null}

      {isCompany ? (
        <>
          <Field name="legalName" label={tf("legalName")} autoComplete="organization" defaultValue={v.legalName ?? ""} error={err("legalName", tf("legalName"))} />
          <Field name="tradeName" label={tf("tradeName")} defaultValue={v.tradeName ?? ""} error={err("tradeName", tf("tradeName"))} />
          <SelectField
            name="country"
            label={tf("incorporationCountry")}
            placeholder={t("choose")}
            options={countries}
            defaultValue={v.country ?? ""}
            error={err("country", tf("incorporationCountry"))}
          />
          <Field name="taxId" label={tf("taxId")} hint={t("hints.taxId")} defaultValue={v.taxId ?? ""} error={err("taxId", tf("taxId"))} />
          {activity}
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
          <Field name="fullName" label={tf("fullName")} autoComplete="name" defaultValue={v.fullName ?? ""} error={err("fullName", tf("fullName"))} />
          <SelectField
            name="country"
            label={tf("residenceCountry")}
            placeholder={t("choose")}
            options={countries}
            defaultValue={v.country ?? ""}
            error={err("country", tf("residenceCountry"))}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              name="idType"
              label={tf("idType")}
              placeholder={t("choose")}
              options={idTypes.map((x) => ({ value: x, label: t(`idTypes.${x}`) }))}
              defaultValue={v.idType ?? ""}
              error={err("idType", tf("idType"))}
            />
            <Field name="idNumber" label={tf("idNumber")} defaultValue={v.idNumber ?? ""} error={err("idNumber", tf("idNumber"))} />
          </div>
          {activity}
        </>
      ) : null}

      <SubmitButton>{t("saveAndContinue")}</SubmitButton>
    </form>
  );
}
