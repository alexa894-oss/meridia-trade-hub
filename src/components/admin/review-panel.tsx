"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { FormAlert, SelectField, TextareaField, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { reviewCompany } from "@/lib/admin/actions";

type Status = "registered" | "in_review" | "reviewing" | "validated" | "info_requested" | "rejected" | "suspended";

function ActionButton({ action, tone, children }: { action: string; tone: "primary" | "neutral" | "danger"; children: string }) {
  const { pending } = useFormStatus();
  const classes = {
    primary: "bg-navy-800 text-white hover:bg-navy-900",
    neutral: "border border-navy-800 text-navy-800 hover:bg-navy-50",
    danger: "border border-danger text-danger hover:bg-danger/5",
  }[tone];
  return (
    <button
      type="submit"
      name="action"
      value={action}
      disabled={pending}
      className={`inline-flex min-h-11 items-center justify-center rounded-(--radius-control) px-4 text-sm font-semibold disabled:opacity-60 ${classes}`}
    >
      {children}
    </button>
  );
}

// Acciones de revisión según el estado actual de la empresa.
export function ReviewPanel({
  companyId,
  kind,
  status,
  currentTier,
  hasLicense,
}: {
  companyId: string;
  kind: "buyer" | "factory";
  status: Status;
  currentTier: "vip" | "standard" | null;
  hasLicense: boolean;
}) {
  const t = useTranslations("Admin.review");
  const fieldError = useFieldError();
  const [state, action] = useActionState(reviewCompany, initialFormState);

  const pending = status === "in_review" || status === "reviewing";
  const can = {
    startReview: status === "in_review",
    validate: pending || status === "suspended" || (kind === "factory" && status === "registered"),
    requestInfo: pending,
    reject: pending || status === "info_requested",
    suspend: status === "validated",
  };
  const anything = Object.values(can).some(Boolean);

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      {state.status === "success" && state.message ? <FormAlert tone="success">{t(state.message)}</FormAlert> : null}
      {state.formError ? <FormAlert>{t(`errors.${state.formError}`)}</FormAlert> : null}

      {!anything ? (
        <p className="text-sm text-ink-muted">{t(`noActions.${status}`)}</p>
      ) : (
        <>
          {kind === "factory" && can.validate ? (
            <SelectField
              name="tier"
              label={t("tier")}
              hint={hasLicense ? t("tierHint") : t("tierHintNoLicense")}
              placeholder={t("chooseTier")}
              defaultValue={state.values?.tier ?? currentTier ?? ""}
              options={[
                { value: "vip", label: t("tiers.vip") },
                { value: "standard", label: t("tiers.standard") },
              ]}
            />
          ) : null}
          {can.requestInfo || can.reject || can.suspend ? (
            <TextareaField
              name="message"
              label={t("message")}
              hint={t("messageHint")}
              defaultValue={state.values?.message ?? ""}
              error={fieldError(state.fieldErrors?.message, t("message"))}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {can.startReview ? (
              <ActionButton action="start_review" tone="neutral">
                {t("actions.startReview")}
              </ActionButton>
            ) : null}
            {can.validate ? (
              <ActionButton action="validate" tone="primary">
                {status === "suspended" ? t("actions.reactivate") : kind === "buyer" ? t("actions.approve") : t("actions.validate")}
              </ActionButton>
            ) : null}
            {can.requestInfo ? (
              <ActionButton action="request_info" tone="neutral">
                {t("actions.requestInfo")}
              </ActionButton>
            ) : null}
            {can.reject ? (
              <ActionButton action="reject" tone="danger">
                {t("actions.reject")}
              </ActionButton>
            ) : null}
            {can.suspend ? (
              <ActionButton action="suspend" tone="danger">
                {t("actions.suspend")}
              </ActionButton>
            ) : null}
          </div>
        </>
      )}
    </form>
  );
}
