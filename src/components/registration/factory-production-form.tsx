"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { saveFactoryProduction } from "@/lib/registration/actions";
import { DocumentUpload } from "./document-upload";

type Initial = {
  categoryIds: string[];
  capacity: string | null;
  departurePort: string | null;
  website: string | null;
  foundedYear: number | null;
  annualCapacityOrSales: string | null;
};

export function FactoryProductionForm({
  initial,
  categories,
  companyId,
  brochures,
}: {
  initial: Initial;
  categories: { value: string; label: string }[];
  companyId: string;
  brochures: { id: string; fileName: string | null }[];
}) {
  const t = useTranslations("Registration");
  const tf = useTranslations("Registration.fields");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveFactoryProduction, initialFormState);
  const values = state.values as Record<string, string> | undefined;
  const selected = new Set(values?.categoryIds ? values.categoryIds.split(",") : initial.categoryIds);
  const v = (name: Exclude<keyof Initial, "categoryIds">) =>
    values?.[name] ?? (initial[name] === null ? "" : String(initial[name]));
  const err = (name: keyof Initial, label: string) => fieldError(state.fieldErrors?.[name], label);
  const categoriesError = err("categoryIds", tf("categories"));
  const websiteError =
    state.fieldErrors?.website === "webOrBrochure" ? t("webOrBrochure") : err("website", tf("website"));

  return (
    <div className="space-y-5">
      {state.formError ? <FormAlert>{t(`formErrors.${state.formError}`)}</FormAlert> : null}

      <form id="production-form" action={action} noValidate className="space-y-5">
        <fieldset aria-describedby={categoriesError ? "categories-error" : undefined}>
          <legend className="text-sm font-medium text-ink">{tf("categories")}</legend>
          <p className="text-sm text-ink-muted">{t("hints.categories")}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {categories.map((c) => (
              <label
                key={c.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-control) border border-line px-3 has-checked:border-navy-800 has-checked:bg-navy-50"
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={c.value}
                  defaultChecked={selected.has(c.value)}
                  className="size-5 accent-navy-800"
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          {categoriesError ? (
            <p id="categories-error" className="mt-1.5 text-sm text-danger">
              {categoriesError}
            </p>
          ) : null}
        </fieldset>

        <Field
          name="capacity"
          label={tf("capacity")}
          hint={t("hints.capacity")}
          defaultValue={v("capacity")}
          error={err("capacity", tf("capacity"))}
        />
        <Field
          name="departurePort"
          label={tf("departurePort")}
          hint={t("hints.departurePort")}
          defaultValue={v("departurePort")}
          error={err("departurePort", tf("departurePort"))}
        />
        <Field
          name="website"
          label={tf("website")}
          inputMode="url"
          placeholder="www.fabrica.com"
          hint={t("webOrBrochure")}
          defaultValue={v("website")}
          error={websiteError}
        />
      </form>

      <DocumentUpload
        role="factory"
        companyId={companyId}
        kind="brochure"
        label={tf("brochure")}
        documents={brochures}
      />

      <div className="space-y-5 rounded-(--radius-control) border border-line p-4">
        <p className="text-sm text-ink-muted">{t("hints.verifiedOnly")}</p>
        <Field
          form="production-form"
          name="foundedYear"
          inputMode="numeric"
          label={`${tf("foundedYear")} · ${t("optional")}`}
          defaultValue={v("foundedYear")}
          error={err("foundedYear", tf("foundedYear"))}
        />
        <Field
          form="production-form"
          name="annualCapacityOrSales"
          label={`${tf("annualCapacityOrSales")} · ${t("optional")}`}
          defaultValue={v("annualCapacityOrSales")}
        />
      </div>

      <div>
        <button
          type="submit"
          form="production-form"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-(--radius-control) bg-navy-800 px-6 font-display text-base font-semibold text-white hover:bg-navy-900"
        >
          {t("saveAndContinue")}
        </button>
      </div>
    </div>
  );
}
