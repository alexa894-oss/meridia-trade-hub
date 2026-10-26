"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { adminHideQuote } from "@/lib/quotes/actions";

// Ocultar una cotización que incumple reglas (con motivo) o restaurarla.
export function QuoteModeration({ quoteId, status, hiddenReason }: { quoteId: string; status: string; hiddenReason: string | null }) {
  const t = useTranslations("Admin.quotes");
  const [state, action] = useActionState(adminHideQuote, initialFormState);
  if (status === "draft" || status === "accepted") return null;

  return (
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
  );
}
