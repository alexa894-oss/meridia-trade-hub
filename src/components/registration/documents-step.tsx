"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FormAlert, SubmitButton } from "@/components/forms";
import { initialFormState, type FormState } from "@/lib/forms";
import { continueAfterDocuments } from "@/lib/registration/actions";
import type { DocumentKind } from "@/lib/registration/steps";
import { DocumentUpload } from "./document-upload";

type Slot = { kind: DocumentKind; label: string; hint?: string; required: boolean; documents: { id: string; fileName: string | null }[] };

export function DocumentsStep({
  role,
  companyId,
  slots,
}: {
  role: "buyer" | "factory";
  companyId: string;
  slots: Slot[];
}) {
  const t = useTranslations("Registration");
  const [state, action] = useActionState<FormState<"document">, FormData>(
    continueAfterDocuments.bind(null, role),
    initialFormState,
  );
  const requiredLabel = slots.find((s) => s.required)?.label ?? "";

  return (
    <div className="space-y-6">
      {state.formError ? <FormAlert>{t(`formErrors.${state.formError}`)}</FormAlert> : null}
      <p className="rounded-(--radius-control) bg-navy-50 px-4 py-3 text-sm text-ink">{t("documentsNote")}</p>
      {slots.map((slot) => (
        <DocumentUpload
          key={slot.kind}
          role={role}
          companyId={companyId}
          kind={slot.kind}
          label={slot.label}
          hint={slot.hint}
          required={slot.required}
          documents={slot.documents}
          error={slot.required && state.fieldErrors?.document ? t("fileRequired", { field: requiredLabel }) : undefined}
        />
      ))}
      <form action={action}>
        <SubmitButton>{t("saveAndContinue")}</SubmitButton>
      </form>
    </div>
  );
}
