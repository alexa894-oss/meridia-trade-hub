"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { CheckboxField, Field, FormAlert, SelectField, TextareaField, useFieldError } from "@/components/forms";
import { findContactInfo } from "@/lib/contact-detection";
import { initialFormState } from "@/lib/forms";
import { saveRfq, type RfqField } from "@/lib/rfqs/actions";
import { incoterms, shippingModes } from "@/lib/rfqs/constants";
import { RfqReferenceUpload } from "./rfq-reference-upload";

export type RfqFormInitial = {
  id: string | null;
  product: string;
  categoryId: string;
  description: string;
  quantity: string;
  unitId: string;
  destinationCountry: string;
  technicalSpecs: string;
  deadline: string;
  referenceUrl: string;
  referenceFileName: string | null;
  acceptsAlternatives: boolean;
  needsSample: boolean;
  incoterms: string[];
  destinationPort: string;
  shippingModes: string[];
};

type Option = { value: string; label: string };

function Buttons({ canSubmit }: { canSubmit: boolean }) {
  const t = useTranslations("Rfq.form");
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="submit"
        name="intent"
        value="submit"
        disabled={pending || !canSubmit}
        className="inline-flex min-h-12 flex-1 items-center justify-center rounded-(--radius-control) bg-navy-800 px-6 font-display font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
      >
        {pending ? t("sending") : t("submit")}
      </button>
      <button
        type="submit"
        name="intent"
        value="draft"
        disabled={pending}
        className="inline-flex min-h-12 flex-1 items-center justify-center rounded-(--radius-control) border border-navy-800 px-6 font-display font-semibold text-navy-800 hover:bg-navy-50 disabled:opacity-50"
      >
        {t("saveDraft")}
      </button>
    </div>
  );
}

export function RfqForm({
  initial,
  categories,
  units,
  countries,
  canSubmit,
  initialError,
}: {
  initial: RfqFormInitial;
  categories: Option[];
  units: Option[];
  countries: Option[];
  canSubmit: boolean;
  initialError?: string;
}) {
  const t = useTranslations("Rfq");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveRfq, initialFormState);
  const v = state.values as Partial<Record<RfqField | "referenceUrl", string>> | undefined;
  const val = (name: Exclude<keyof RfqFormInitial, "id" | "incoterms" | "shippingModes" | "acceptsAlternatives" | "needsSample" | "referenceFileName">) =>
    v?.[name as RfqField] ?? initial[name];
  const selectedIncoterms = v?.incoterms !== undefined ? v.incoterms.split(",").filter(Boolean) : initial.incoterms;
  const selectedModes = v?.shippingModes !== undefined ? v.shippingModes.split(",").filter(Boolean) : initial.shippingModes;
  const [cif, setCif] = useState(selectedIncoterms.includes("CIF"));
  const [hasFile, setHasFile] = useState(!!initial.referenceFileName);
  const [contactWarnings, setContactWarnings] = useState<Partial<Record<string, string>>>({});

  const fieldKey: Partial<Record<string, string>> = { categoryId: "category", unitId: "unit" };
  const label = (name: string) => t(`fields.${fieldKey[name] ?? name}`);
  const err = (name: RfqField) => {
    const code = state.fieldErrors?.[name];
    if (!code) return undefined;
    if (code === "contactInfo") return t("errors.contactInfo", { field: label(name) });
    if (code === "portRequiredForCif") return t("errors.portRequiredForCif");
    if (code === "referenceRequired") return t("errors.referenceRequired");
    if (code === "deadlineFuture") return t("errors.deadlineFuture");
    if (code === "invalidQuantity") return t("errors.invalidQuantity");
    return fieldError(code, label(name));
  };
  // Aviso inmediato si el texto parece contener un teléfono, correo o WeChat.
  const watchContact = (name: string) => ({
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const found = findContactInfo(e.target.value);
      setContactWarnings((w) => ({ ...w, [name]: found ? t("errors.contactInfoLive", { found }) : undefined }));
    },
  });
  const formError = state.formError ?? initialError;

  return (
    <form action={action} noValidate className="space-y-6">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="hasReferenceFile" value={hasFile ? "1" : "0"} />
      {formError ? <FormAlert>{t(`formErrors.${formError}`)}</FormAlert> : null}
      {!canSubmit ? <FormAlert>{t("formErrors.companyNotValidated")}</FormAlert> : null}

      <fieldset className="space-y-4">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.product")}</legend>
        <Field name="product" label={label("product")} defaultValue={val("product")} error={err("product") ?? contactWarnings.product} {...watchContact("product")} />
        <SelectField name="categoryId" label={label("category")} placeholder={t("choose")} options={categories} defaultValue={val("categoryId")} error={err("categoryId")} />
        <TextareaField name="description" label={label("description")} defaultValue={val("description")} error={err("description") ?? contactWarnings.description} {...watchContact("description")} />
        <TextareaField
          name="technicalSpecs"
          label={label("technicalSpecs")}
          hint={t("hints.technicalSpecs")}
          defaultValue={val("technicalSpecs")}
          error={err("technicalSpecs") ?? contactWarnings.technicalSpecs}
          {...watchContact("technicalSpecs")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="quantity" inputMode="decimal" label={label("quantity")} defaultValue={val("quantity")} error={err("quantity")} />
          <SelectField name="unitId" label={label("unit")} placeholder={t("choose")} options={units} defaultValue={val("unitId")} error={err("unitId")} />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.reference")}</legend>
        <p className="text-sm text-ink-muted">{t("hints.reference")}</p>
        <Field
          name="referenceUrl"
          inputMode="url"
          label={t("fields.referenceUrl")}
          placeholder="https://"
          defaultValue={v?.referenceUrl ?? initial.referenceUrl}
          error={err("reference")}
        />
        {initial.id ? (
          <RfqReferenceUpload rfqId={initial.id} fileName={initial.referenceFileName} onChange={setHasFile} />
        ) : (
          <p className="rounded-(--radius-control) bg-navy-50 px-3 py-2 text-sm text-ink">{t("hints.saveToUpload")}</p>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.terms")}</legend>
        <div>
          <p className="text-sm font-medium text-ink">{label("incoterms")}</p>
          <p className="text-sm text-ink-muted">{t("hints.incoterms")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {incoterms.map((term) => (
              <label key={term} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-control) border border-line px-4 has-checked:border-navy-800 has-checked:bg-navy-50">
                <input
                  type="checkbox"
                  name="incoterms"
                  value={term}
                  defaultChecked={selectedIncoterms.includes(term)}
                  onChange={(e) => term === "CIF" && setCif(e.target.checked)}
                  className="size-5 accent-navy-800"
                />
                <span className="font-semibold">{term}</span>
              </label>
            ))}
          </div>
          {err("incoterms") ? <p className="mt-1.5 text-sm text-danger">{err("incoterms")}</p> : null}
        </div>
        <Field
          name="destinationPort"
          label={`${label("destinationPort")}${cif ? "" : ` · ${t("hints.portIfCif")}`}`}
          defaultValue={val("destinationPort")}
          error={err("destinationPort") ?? contactWarnings.destinationPort}
          {...watchContact("destinationPort")}
        />
        <SelectField name="destinationCountry" label={label("destinationCountry")} placeholder={t("choose")} options={countries} defaultValue={val("destinationCountry")} error={err("destinationCountry")} />
        <Field name="deadline" type="date" label={label("deadline")} hint={t("hints.deadline")} defaultValue={val("deadline")} error={err("deadline")} />
        <div>
          <p className="text-sm font-medium text-ink">
            {label("shippingModes")} <span className="font-normal text-ink-muted">· {t("optional")}</span>
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {shippingModes.map((mode) => (
              <label key={mode} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-control) border border-line px-3 has-checked:border-navy-800 has-checked:bg-navy-50">
                <input type="checkbox" name="shippingModes" value={mode} defaultChecked={selectedModes.includes(mode)} className="size-5 accent-navy-800" />
                <span>{t(`shippingModes.${mode}`)}</span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.options")}</legend>
        <CheckboxField name="acceptsAlternatives" defaultChecked={initial.acceptsAlternatives} label={t("fields.acceptsAlternativesLong")} />
        <CheckboxField name="needsSample" defaultChecked={initial.needsSample} label={t("fields.needsSampleLong")} />
      </fieldset>

      <p className="text-sm text-ink-muted">{t("hints.noContact")}</p>
      <Buttons canSubmit={canSubmit} />
    </form>
  );
}
