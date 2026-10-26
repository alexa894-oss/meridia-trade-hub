"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckboxField, Field, FormAlert, SubmitButton, TextareaField, useFieldError } from "@/components/forms";
import { initialFormState, type FormState } from "@/lib/forms";
import { publishLegalVersion, saveOption, saveSettings } from "@/lib/admin/actions";

export function SettingsForm({
  settings,
}: {
  settings: {
    factorySeesBuyerName: boolean;
    buyerSeesFactoryTier: boolean;
    allowIndividualBuyers: boolean;
    pendingCompanyAlertHours: number | null;
    unansweredRfqAlertHours: number | null;
  };
}) {
  const t = useTranslations("Admin.settings");
  const tr = useTranslations("Admin.review");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveSettings, initialFormState);
  const v = state.values ?? {};

  return (
    <form action={action} noValidate className="space-y-5">
      {state.status === "success" ? <FormAlert tone="success">{t("saved")}</FormAlert> : null}
      {state.formError ? <FormAlert>{tr(`errors.${state.formError}`)}</FormAlert> : null}

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-navy-800">{t("decisions")}</legend>
        <CheckboxField name="factorySeesBuyerName" defaultChecked={settings.factorySeesBuyerName} label={t("factorySeesBuyerName")} />
        <CheckboxField name="buyerSeesFactoryTier" defaultChecked={settings.buyerSeesFactoryTier} label={t("buyerSeesFactoryTier")} />
        <CheckboxField name="allowIndividualBuyers" defaultChecked={settings.allowIndividualBuyers} label={t("allowIndividualBuyers")} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 font-semibold text-navy-800">{t("thresholds")}</legend>
        <p className="text-sm text-ink-muted">{t("thresholdsHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="pendingCompanyAlertHours"
            inputMode="decimal"
            label={t("pendingCompanyAlertHours")}
            defaultValue={v.pendingCompanyAlertHours ?? settings.pendingCompanyAlertHours?.toString() ?? ""}
            error={fieldError(state.fieldErrors?.pendingCompanyAlertHours, t("pendingCompanyAlertHours"))}
          />
          <Field
            name="unansweredRfqAlertHours"
            inputMode="decimal"
            label={t("unansweredRfqAlertHours")}
            defaultValue={v.unansweredRfqAlertHours ?? settings.unansweredRfqAlertHours?.toString() ?? ""}
            error={fieldError(state.fieldErrors?.unansweredRfqAlertHours, t("unansweredRfqAlertHours"))}
          />
        </div>
      </fieldset>

      <div className="sm:w-48">
        <SubmitButton>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}

type OptionRow = { id: string; slug: string; names: Record<string, string>; active: boolean; sort_order: number };

function OptionRowForm({ table, row }: { table: "sectors" | "categories" | "units"; row?: OptionRow }) {
  const t = useTranslations("Admin.settings");
  const tr = useTranslations("Admin.review");
  const fieldError = useFieldError();
  const [state, action] = useActionState<FormState<"nameEs" | "slug">, FormData>(saveOption.bind(null, table), initialFormState);

  return (
    <form action={action} noValidate className="grid gap-3 rounded-(--radius-control) border border-line p-3 sm:grid-cols-[1fr_90px_auto_auto] sm:items-end">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <Field
        name="nameEs"
        label={row ? t("optionName") : t("newOption")}
        defaultValue={state.values?.nameEs ?? row?.names.es ?? ""}
        error={fieldError(state.fieldErrors?.nameEs, t("optionName")) ?? (state.formError ? tr(`errors.${state.formError}`) : undefined)}
      />
      <Field name="sortOrder" inputMode="numeric" label={t("order")} defaultValue={row?.sort_order?.toString() ?? ""} />
      <CheckboxField name="active" label={t("activeOption")} defaultChecked={row ? row.active : true} className="sm:pb-3" />
      <button type="submit" className="min-h-12 rounded-(--radius-control) border border-navy-800 px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50">
        {row ? t("saveOption") : t("addOption")}
      </button>
    </form>
  );
}

export function OptionsEditor({ table, rows }: { table: "sectors" | "categories" | "units"; rows: OptionRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <OptionRowForm key={row.id} table={table} row={row} />
      ))}
      <OptionRowForm table={table} />
    </div>
  );
}

export function LegalVersionForm({ kind, current }: { kind: "terms" | "non_circumvention"; current: string }) {
  const t = useTranslations("Admin.settings");
  const tr = useTranslations("Admin.review");
  const fieldError = useFieldError();
  const [state, action] = useActionState(publishLegalVersion, initialFormState);

  return (
    <form action={action} noValidate className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      {state.status === "success" ? <FormAlert tone="success">{t("legalSaved")}</FormAlert> : null}
      {state.formError ? <FormAlert>{tr(`errors.${state.formError}`)}</FormAlert> : null}
      <TextareaField
        name="contentEs"
        rows={8}
        label={t("legalContent")}
        defaultValue={state.values?.contentEs ?? current}
        error={fieldError(state.fieldErrors?.contentEs, t("legalContent"))}
      />
      <CheckboxField name="isDraft" label={t("keepDraft")} defaultChecked />
      <div className="sm:w-64">
        <SubmitButton>{t("publishVersion")}</SubmitButton>
      </div>
    </form>
  );
}
