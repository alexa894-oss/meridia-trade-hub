"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SelectField, SubmitButton, TextareaField, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { saveBuyerProfile } from "@/lib/registration/actions";
import { companyTypes } from "@/lib/registration/steps";
import { CategoryPicker } from "./category-picker";

type Initial = {
  companyType: string | null;
  categoryIds: string[];
  destinationCountry: string | null;
  purchaseVolume: string | null;
  purchaseFrequencyId: string | null;
  purchasePurpose: string | null;
  needsDescription: string | null;
};

type Option = { value: string; label: string };

// Paso 3: perfil de compra.
export function BuyerProfileForm({
  initial,
  isIndividual,
  categories,
  countries,
  frequencies,
}: {
  initial: Initial;
  isIndividual: boolean;
  categories: Option[];
  countries: Option[];
  frequencies: Option[];
}) {
  const t = useTranslations("Registration");
  const tf = useTranslations("Registration.fields");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveBuyerProfile, initialFormState);
  const values = state.values as Record<string, string> | undefined;
  const selected = new Set(values?.categoryIds ? values.categoryIds.split(",") : initial.categoryIds);
  const v = (name: Exclude<keyof Initial, "categoryIds">) => values?.[name] ?? initial[name] ?? "";
  const err = (name: keyof Initial, label: string) => fieldError(state.fieldErrors?.[name], label);

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert>{t(`formErrors.${state.formError}`)}</FormAlert> : null}

      {isIndividual ? (
        <TextareaField
          name="purchasePurpose"
          label={tf("purchasePurpose")}
          hint={t("hints.purchasePurpose")}
          defaultValue={v("purchasePurpose")}
          error={err("purchasePurpose", tf("purchasePurpose"))}
        />
      ) : (
        <SelectField
          name="companyType"
          label={tf("companyType")}
          placeholder={t("choose")}
          options={companyTypes.map((x) => ({ value: x, label: t(`companyTypes.${x}`) }))}
          defaultValue={v("companyType")}
          error={err("companyType", tf("companyType"))}
        />
      )}

      <CategoryPicker
        label={tf("interestCategories")}
        hint={t("hints.interestCategories")}
        options={categories}
        selected={selected}
        error={err("categoryIds", tf("interestCategories"))}
      />

      <SelectField
        name="destinationCountry"
        label={tf("destinationCountry")}
        placeholder={t("choose")}
        options={countries}
        defaultValue={v("destinationCountry")}
        error={err("destinationCountry", tf("destinationCountry"))}
      />
      <Field
        name="purchaseVolume"
        label={tf("purchaseVolume")}
        hint={t("hints.purchaseVolume")}
        defaultValue={v("purchaseVolume")}
        error={err("purchaseVolume", tf("purchaseVolume"))}
      />
      {isIndividual ? null : (
        <SelectField
          name="purchaseFrequencyId"
          label={tf("purchaseFrequency")}
          placeholder={t("choose")}
          options={frequencies}
          defaultValue={v("purchaseFrequencyId")}
          error={err("purchaseFrequencyId", tf("purchaseFrequency"))}
        />
      )}
      {isIndividual ? null : (
        <TextareaField
          name="needsDescription"
          label={`${tf("needsDescription")} · ${t("optional")}`}
          defaultValue={v("needsDescription")}
        />
      )}

      <SubmitButton>{t("saveAndContinue")}</SubmitButton>
    </form>
  );
}
