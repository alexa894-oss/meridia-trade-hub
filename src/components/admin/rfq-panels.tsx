"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { FormAlert, TextareaField, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { adminRfqAction, assignFactories, unassignFactory } from "@/lib/rfqs/actions";

type Candidate = {
  id: string;
  name: string;
  location: string;
  tier: "vip" | "standard" | null;
  sameCategory: boolean;
  assignedAt: string | null;
  hasQuote: boolean;
};

function Submit({ children, tone = "primary", name, value }: { children: string; tone?: "primary" | "neutral" | "danger"; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  const cls = {
    primary: "bg-navy-800 text-white hover:bg-navy-900",
    neutral: "border border-navy-800 text-navy-800 hover:bg-navy-50",
    danger: "border border-danger text-danger hover:bg-danger/5",
  }[tone];
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`inline-flex min-h-11 items-center justify-center rounded-(--radius-control) px-4 text-sm font-semibold disabled:opacity-60 ${cls}`}>
      {children}
    </button>
  );
}

// Asignación: por defecto se proponen las fábricas validadas de la misma categoría.
export function AssignPanel({ rfqId, candidates, canAssign }: { rfqId: string; candidates: Candidate[]; canAssign: boolean }) {
  const t = useTranslations("Admin.rfq");
  const [state, action] = useActionState(assignFactories, initialFormState);
  const assigned = candidates.filter((c) => c.assignedAt);
  const available = candidates.filter((c) => !c.assignedAt);
  const preselect = assigned.length === 0;

  return (
    <div className="space-y-5">
      {assigned.length ? (
        <div>
          <p className="text-sm font-semibold text-navy-800">{t("assigned")}</p>
          <ul className="mt-2 space-y-2">
            {assigned.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) border border-line px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block font-semibold text-navy-800">{c.name}</span>
                  <span className="text-ink-muted">{c.hasQuote ? t("quoted") : t("waitingQuote")}</span>
                </span>
                {!c.hasQuote ? (
                  <form action={unassignFactory}>
                    <input type="hidden" name="rfqId" value={rfqId} />
                    <input type="hidden" name="factoryId" value={c.id} />
                    <button type="submit" className="text-sm font-semibold text-danger hover:underline">
                      {t("unassign")}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canAssign ? (
        available.length ? (
          <form action={action} className="space-y-3">
            <input type="hidden" name="rfqId" value={rfqId} />
            {state.status === "success" ? <FormAlert tone="success">{t("assignedOk", { count: Number(state.message) })}</FormAlert> : null}
            {state.formError ? <FormAlert>{t(`errors.${state.formError}`)}</FormAlert> : null}
            <p className="text-sm text-ink-muted">{t("assignHint")}</p>
            <ul className="space-y-2">
              {available.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-(--radius-control) border border-line p-3 has-checked:border-navy-800 has-checked:bg-navy-50">
                    <input type="checkbox" name="factoryIds" value={c.id} defaultChecked={preselect && c.sameCategory} className="mt-0.5 size-5 accent-navy-800" />
                    <span className="min-w-0 text-sm">
                      <span className="block font-semibold text-navy-800">{c.name}</span>
                      <span className="text-ink-muted">
                        {c.location}
                        {c.tier ? ` · ${t(`tiers.${c.tier}`)}` : ""}
                        {c.sameCategory ? ` · ${t("sameCategory")}` : ` · ${t("otherCategory")}`}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {state.fieldErrors?.factories ? <p className="text-sm text-danger">{t("errors.factoriesRequired")}</p> : null}
            <Submit>{t("assign")}</Submit>
          </form>
        ) : (
          <p className="text-sm text-ink-muted">{t("noMoreFactories")}</p>
        )
      ) : (
        <p className="text-sm text-ink-muted">{t("cannotAssign")}</p>
      )}
    </div>
  );
}

export function RfqActionPanel({ rfqId, canRequestInfo, canClose }: { rfqId: string; canRequestInfo: boolean; canClose: boolean }) {
  const t = useTranslations("Admin.rfq");
  const fieldError = useFieldError();
  const [state, action] = useActionState(adminRfqAction, initialFormState);
  if (!canRequestInfo && !canClose) return <p className="text-sm text-ink-muted">{t("noActions")}</p>;

  return (
    <form action={action} noValidate className="space-y-3">
      <input type="hidden" name="rfqId" value={rfqId} />
      {state.status === "success" && state.message ? <FormAlert tone="success">{t(`done.${state.message}`)}</FormAlert> : null}
      {state.formError ? <FormAlert>{t(`errors.${state.formError}`)}</FormAlert> : null}
      <TextareaField
        name="message"
        label={t("message")}
        hint={t("messageHint")}
        defaultValue={state.values?.message ?? ""}
        error={fieldError(state.fieldErrors?.message, t("message"))}
      />
      <div className="flex flex-wrap gap-2">
        {canRequestInfo ? (
          <Submit tone="neutral" name="action" value="request_info">
            {t("requestInfo")}
          </Submit>
        ) : null}
        {canClose ? (
          <Submit tone="danger" name="action" value="close">
            {t("close")}
          </Submit>
        ) : null}
      </div>
    </form>
  );
}
