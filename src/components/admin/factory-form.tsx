"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SelectField, SubmitButton, TextareaField, useFieldError } from "@/components/forms";
import { CategoryPicker } from "@/components/registration/category-picker";
import { initialFormState } from "@/lib/forms";
import { saveFactory } from "@/lib/admin/factory-actions";

type Option = { value: string; label: string };
export type FactoryFormInitial = { categoryIds?: string[]; [field: string]: string | string[] | undefined };

// Formulario interno de Meridia: alta o edición de un fabricante de la red.
export function FactoryForm({
  companyId,
  initial,
  countries,
  categories,
}: {
  companyId?: string;
  initial: FactoryFormInitial;
  countries: Option[];
  categories: Option[];
}) {
  const t = useTranslations("Admin.factories.form");
  const tr = useTranslations("Registration");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveFactory, initialFormState);
  const values = state.values as Record<string, string> | undefined;
  const v = (name: string) => values?.[name] ?? (typeof initial[name] === "string" ? (initial[name] as string) : "");
  const selected = new Set(values?.categoryIds ? values.categoryIds.split(",") : (initial.categoryIds ?? []));
  const err = (name: string) => fieldError(state.fieldErrors?.[name as never], t(`fields.${name}`));
  const opt = ` · ${tr("optional")}`;
  const field = (name: string, extra: { required?: boolean; hint?: string; type?: string; inputMode?: "url" | "tel" | "email" } = {}) => (
    <Field
      name={name}
      type={extra.type}
      inputMode={extra.inputMode}
      label={`${t(`fields.${name}`)}${extra.required ? "" : opt}`}
      hint={extra.hint}
      defaultValue={v(name)}
      error={err(name)}
    />
  );
  const area = (name: string, required = false) => (
    <TextareaField name={name} label={`${t(`fields.${name}`)}${required ? "" : opt}`} defaultValue={v(name)} error={err(name)} />
  );

  return (
    <form action={action} noValidate className="space-y-8">
      {companyId ? <input type="hidden" name="companyId" value={companyId} /> : null}
      {state.status === "success" ? <FormAlert tone="success">{t("saved")}</FormAlert> : null}
      {state.formError ? <FormAlert>{t(`errors.${state.formError}`)}</FormAlert> : null}

      <fieldset className="space-y-5">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.company")}</legend>
        {field("legalName", { required: true })}
        <div className="grid gap-5 sm:grid-cols-2">
          {field("tradeName")}
          {field("legalNameLocal", { hint: t("hints.legalNameLocal") })}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField name="country" label={t("fields.country")} placeholder={tr("choose")} options={countries} defaultValue={v("country")} error={err("country")} />
          {field("city")}
        </div>
        {field("address")}
        <div className="grid gap-5 sm:grid-cols-2">
          {field("registrationNumber")}
          {field("website", { inputMode: "url" })}
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.contact")}</legend>
        <p className="rounded-(--radius-control) bg-gold-100 px-3 py-2 text-sm text-ink">{t("contactPrivate")}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {field("contactName", { required: true })}
          {field("contactTitle")}
        </div>
        {field("email", { required: true, type: "email", inputMode: "email", hint: t("hints.email") })}
        <div className="grid gap-5 sm:grid-cols-3">
          {field("phone", { type: "tel", inputMode: "tel" })}
          {field("whatsapp", { type: "tel", inputMode: "tel" })}
          {field("wechat")}
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.production")}</legend>
        <CategoryPicker label={t("fields.categoryIds")} hint={t("hints.categoryIds")} options={categories} selected={selected} error={err("categoryIds")} />
        {area("products", true)}
        <div className="grid gap-5 sm:grid-cols-2">
          {field("capacity", { hint: t("hints.capacity") })}
          {field("moq", { hint: t("hints.moq") })}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {field("departurePort")}
          {field("exportMarkets", { hint: t("hints.exportMarkets") })}
        </div>
        {area("certifications")}
        {area("commercialTerms")}
      </fieldset>

      {companyId ? null : (
        <fieldset className="space-y-3">
          <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.notes")}</legend>
          {area("notes")}
        </fieldset>
      )}

      <SubmitButton>{companyId ? t("saveChanges") : t("create")}</SubmitButton>
    </form>
  );
}
