"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field, FormAlert, SubmitButton, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { saveFactoryCompany } from "@/lib/registration/actions";

type Initial = { legalNameZh: string | null; legalNameEn: string | null; city: string | null; province: string | null };

export function FactoryCompanyForm({ initial }: { initial: Initial }) {
  const t = useTranslations("Registration");
  const tf = useTranslations("Registration.fields");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveFactoryCompany, initialFormState);
  const v = { ...initial, ...state.values } as Record<string, string | null | undefined>;
  const err = (name: keyof Initial, label: string) => fieldError(state.fieldErrors?.[name], label);

  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError ? <FormAlert>{t(`formErrors.${state.formError}`)}</FormAlert> : null}
      <Field
        name="legalNameZh"
        lang="zh-CN"
        label={tf("legalNameZh")}
        defaultValue={v.legalNameZh ?? ""}
        error={err("legalNameZh", tf("legalNameZh"))}
      />
      <Field
        name="legalNameEn"
        lang="en"
        label={tf("legalNameEn")}
        defaultValue={v.legalNameEn ?? ""}
        error={err("legalNameEn", tf("legalNameEn"))}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="city" label={tf("city")} defaultValue={v.city ?? ""} error={err("city", tf("city"))} />
        <Field
          name="province"
          label={tf("province")}
          defaultValue={v.province ?? ""}
          error={err("province", tf("province"))}
        />
      </div>
      <SubmitButton>{t("saveAndContinue")}</SubmitButton>
    </form>
  );
}
