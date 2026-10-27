"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { adminApproveQuote, adminHideQuote } from "@/lib/quotes/actions";

// Revisión de Meridia: aprobar (el comprador recién ahí la ve), ocultar con motivo o restaurar.
export function QuoteModeration({ quoteId, status, hiddenReason }: { quoteId: string; status: string; hiddenReason: string | null }) {
  const t = useTranslations("Admin.quotes");
  const [state, action] = useActionState(adminHideQuote, initialFormState);
  const [approveState, approve] = useActionState(adminApproveQuote, initialFormState);
  if (status === "draft" || status === "accepted") return null;

  return (
    <>
      {status === "pending_approval" ? (
        <form action={approve} className="mt-3 space-y-2 rounded-(--radius-control) border border-gold-300 bg-gold-100 p-3">
          <input type="hidden" name="quoteId" value={quoteId} />
          <p className="text-sm text-ink">{t("pendingHelp")}</p>
          {approveState.formError ? <FormAlert>{t(`errors.${approveState.formError}`)}</FormAlert> : null}
          <button type="submit" className="min-h-10 rounded-(--radius-control) bg-navy-800 px-4 text-sm font-semibold text-white hover:bg-navy-900">
            {t("approve")}
          </button>
        </form>
      ) : null}
      {approveState.status === "success" ? (
        <div className="mt-3">
          <FormAlert tone="success">{t("approved")}</FormAlert>
        </div>
      ) : null}

      <form action={action} noValidate className="mt-3 space-y-2 border-t border-line pt-3">
        <input type="hidden" name="quoteId" value={quoteId} />
        {state.formError ? <FormAlert>{t(`errors.${state.formError}`)}</FormAlert> : null}
        {status === "hidden" ? (
          <>
            <p className="text-sm text-danger">{t("hiddenReason", { reason: hiddenReason ?? "" })}</p>
            <input type="hidden" name="hide" value="0" />
            <button type="submit" className="min-h-10 rounded-(--radius-control) border border-navy-800 px-3 text-sm font-semibold text-navy-800 hover:bg-navy-50">
              {t("restore")}
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="hide" value="1" />
            <Field name="reason" label={t("reason")} error={state.fieldErrors?.reason ? t("errors.reasonRequired") : undefined} />
            <button type="submit" className="min-h-10 rounded-(--radius-control) border border-danger px-3 text-sm font-semibold text-danger hover:bg-danger/5">
              {t("hide")}
            </button>
          </>
        )}
      </form>
    </>
  );
}
