"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckboxField, Field, FormAlert, SelectField, SubmitButton, TextareaField, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { savePlan } from "@/lib/admin/actions";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  benefits: string[];
  price: number;
  currency: string;
  billing_period: string;
  active: boolean;
};

const periods = ["monthly", "quarterly", "semiannual", "annual", "one_time"] as const;

// Crear o editar un plan. Sin valores precargados: todo lo define el administrador.
export function PlanForm({ plan }: { plan?: Plan }) {
  const t = useTranslations("Admin.plans");
  const tr = useTranslations("Admin.review");
  const fieldError = useFieldError();
  const [state, action] = useActionState(savePlan, initialFormState);
  const v = state.values ?? {};
  const err = (name: "name" | "price" | "currency" | "billingPeriod" | "description" | "benefits") =>
    fieldError(state.fieldErrors?.[name], t(`fields.${name}`));

  return (
    <form action={action} noValidate className="space-y-4">
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      {state.status === "success" && state.message ? <FormAlert tone="success">{t(state.message)}</FormAlert> : null}
      {state.formError ? <FormAlert>{tr(`errors.${state.formError}`)}</FormAlert> : null}

      <Field name="name" label={t("fields.name")} defaultValue={v.name ?? plan?.name ?? ""} error={err("name")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          name="price"
          inputMode="decimal"
          label={t("fields.price")}
          defaultValue={v.price ?? (plan ? String(plan.price) : "")}
          error={err("price")}
        />
        <Field
          name="currency"
          label={t("fields.currency")}
          placeholder="USD"
          maxLength={3}
          defaultValue={v.currency ?? plan?.currency ?? ""}
          error={err("currency")}
        />
        <SelectField
          name="billingPeriod"
          label={t("fields.billingPeriod")}
          placeholder={t("choose")}
          options={periods.map((p) => ({ value: p, label: t(`periods.${p}`) }))}
          defaultValue={v.billingPeriod ?? plan?.billing_period ?? ""}
          error={err("billingPeriod")}
        />
      </div>
      <TextareaField
        name="description"
        rows={2}
        label={`${t("fields.description")} · ${t("optional")}`}
        defaultValue={v.description ?? plan?.description ?? ""}
        error={err("description")}
      />
      <TextareaField
        name="benefits"
        rows={3}
        label={`${t("fields.benefits")} · ${t("optional")}`}
        hint={t("benefitsHint")}
        defaultValue={v.benefits ?? plan?.benefits.join("\n") ?? ""}
        error={err("benefits")}
      />
      <CheckboxField name="active" label={t("fields.active")} defaultChecked={plan ? plan.active : true} />
      <div className="sm:w-56">
        <SubmitButton>{plan ? t("update") : t("create")}</SubmitButton>
      </div>
    </form>
  );
}
