"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SelectField, SubmitButton, TextareaField, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { assignMembership, saveFactoryCommercial } from "@/lib/admin/actions";

// Tipo VIP/estándar y comisión pactada: campos separados de la membresía.
export function FactoryCommercialForm({
  companyId,
  tier,
  commissionRate,
  notes,
}: {
  companyId: string;
  tier: "vip" | "standard" | null;
  commissionRate: number | null;
  notes: string | null;
}) {
  const t = useTranslations("Admin.commercial");
  const tr = useTranslations("Admin.review");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveFactoryCommercial, initialFormState);

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "success" ? <FormAlert tone="success">{t("saved")}</FormAlert> : null}
      {state.formError ? <FormAlert>{tr(`errors.${state.formError}`)}</FormAlert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="tier"
          label={t("tier")}
          placeholder={t("noTier")}
          defaultValue={state.values?.tier ?? tier ?? ""}
          options={[
            { value: "vip", label: tr("tiers.vip") },
            { value: "standard", label: tr("tiers.standard") },
          ]}
          error={fieldError(state.fieldErrors?.tier, t("tier"))}
        />
        <Field
          name="commissionRate"
          inputMode="decimal"
          label={t("commissionRate")}
          hint={t("commissionHint")}
          defaultValue={state.values?.commissionRate ?? (commissionRate === null ? "" : String(commissionRate))}
          error={fieldError(state.fieldErrors?.commissionRate, t("commissionRate"))}
        />
      </div>
      <TextareaField name="notes" label={t("notes")} rows={2} defaultValue={notes ?? ""} />
      <div className="sm:w-48">
        <SubmitButton>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}

export function MembershipForm({ companyId, plans }: { companyId: string; plans: { id: string; name: string; active: boolean }[] }) {
  const t = useTranslations("Admin.membership");
  const tr = useTranslations("Admin.review");
  const fieldError = useFieldError();
  const [state, action] = useActionState(assignMembership, initialFormState);
  const active = plans.filter((p) => p.active);

  if (!active.length) return <p className="text-sm text-ink-muted">{t("noPlans")}</p>;

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "success" ? <FormAlert tone="success">{t("saved")}</FormAlert> : null}
      {state.formError ? <FormAlert>{tr(`errors.${state.formError}`)}</FormAlert> : null}
      <SelectField
        name="planId"
        label={t("plan")}
        placeholder={t("choosePlan")}
        options={active.map((p) => ({ value: p.id, label: p.name }))}
        defaultValue={state.values?.planId ?? ""}
        error={fieldError(state.fieldErrors?.planId, t("plan"))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="startsAt"
          type="date"
          label={t("startsAt")}
          defaultValue={state.values?.startsAt ?? ""}
          error={fieldError(state.fieldErrors?.startsAt, t("startsAt"))}
        />
        <Field
          name="endsAt"
          type="date"
          label={`${t("endsAt")} · ${t("optional")}`}
          defaultValue={state.values?.endsAt ?? ""}
          error={fieldError(state.fieldErrors?.endsAt, t("endsAt"))}
        />
      </div>
      <div className="sm:w-48">
        <SubmitButton>{t("assign")}</SubmitButton>
      </div>
    </form>
  );
}
