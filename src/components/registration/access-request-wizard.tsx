"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckboxField, Field, FormAlert, SelectField, TextareaField, useFieldError } from "@/components/forms";
import { MIN_PASSWORD_LENGTH, type FieldErrorCode } from "@/lib/forms";
import { submitAccessRequest, validateAccessStep, type PublicStep } from "@/lib/registration/public-actions";
import { companyTypes, idTypes, REQUEST_BASE } from "@/lib/registration/steps";
import { CategoryPicker } from "./category-picker";

type Option = { value: string; label: string };
type LegalDoc = { id: string; kind: "terms" | "non_circumvention" | "privacy"; version: number; text: string; isDraft: boolean };
const steps: PublicStep[] = ["datos", "contacto", "perfil", "enviar"];
const legalField = { terms: "acceptTerms", privacy: "acceptPrivacy", non_circumvention: "acceptNonCircumvention" } as const;

// Formulario público de solicitud de acceso: todo se llena antes de crear la cuenta.
export function AccessRequestWizard({
  countries,
  sectors,
  categories,
  frequencies,
  legalDocuments,
  allowIndividual,
  demo = false,
}: {
  countries: Option[];
  sectors: Option[];
  categories: Option[];
  frequencies: Option[];
  legalDocuments: LegalDoc[];
  allowIndividual: boolean;
  /** Solo en desarrollo: botón para rellenar con una empresa ficticia. */
  demo?: boolean;
}) {
  const t = useTranslations("Registration");
  const tf = useTranslations("Registration.fields");
  const ta = useTranslations("AccessRequest");
  const tforms = useTranslations("Forms");
  const fieldError = useFieldError();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({ accountType: allowIndividual ? "" : "company" });
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<string, FieldErrorCode>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fillCount, setFillCount] = useState(0);

  const step = steps[stepIndex];
  const accountType = values.accountType;
  const isCompany = accountType === "company";
  const kind = isCompany || !accountType ? "company" : "individual";
  const v = (name: string) => values[name] ?? "";
  const err = (name: string, label: string) => fieldError(errors[name], label);

  function collect(form: HTMLFormElement) {
    const data = new FormData(form);
    const next = { ...values };
    const seen = new Set<string>();
    for (const [key, value] of data.entries()) {
      if (typeof value !== "string") continue;
      next[key] = key === "categoryIds" && seen.has(key) ? `${next[key]},${value}` : value;
      seen.add(key);
    }
    // Casillas sin marcar no aparecen en el FormData.
    for (const box of form.querySelectorAll<HTMLInputElement>("input[type=checkbox]")) {
      if (box.name === "categoryIds") {
        if (!seen.has("categoryIds")) next.categoryIds = "";
      } else if (!box.checked) next[box.name] = "";
    }
    return next;
  }

  // Guarda lo escrito en el paso actual antes de cambiar de paso.
  function saveCurrent() {
    const form = document.getElementById("access-form");
    if (form instanceof HTMLFormElement) setValues(collect(form));
  }

  function goTo(index: number) {
    setErrors({});
    setFormError(null);
    setStepIndex(index);
    window.scrollTo({ top: 0 });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = collect(event.currentTarget);
    setValues(next);
    startTransition(async () => {
      const result =
        step === "enviar"
          ? await submitAccessRequest(next, legalDocuments.map((d) => d.kind))
          : await validateAccessStep(step, next);
      if (result.status === "ok") return goTo(stepIndex + 1);
      if (result.status === "submitted") {
        if (result.loggedIn) return router.push(`${REQUEST_BASE}?enviada=1`);
        return setSubmittedEmail(result.email);
      }
      setStepIndex(steps.indexOf(result.step));
      setErrors(result.fieldErrors ?? {});
      setFormError(result.formError ?? null);
    });
  }

  // Datos ficticios para recorrer el formulario rápido (nunca en producción).
  function fillDemo() {
    const pickBy = (opts: Option[], text: string) => opts.find((o) => o.label.toLowerCase().includes(text))?.value ?? opts[0]?.value ?? "";
    setValues((prev) => ({
      ...prev,
      accountType: "company",
      legalName: "Constructora Demo del Pacífico S.A.",
      tradeName: "Demo Pacífico",
      country: "PA",
      taxId: "RUC 0000-DEMO-01",
      economicActivity: "Construcción de vivienda y oficinas",
      sectorId: pickBy(sectors, "constru"),
      website: "",
      contactName: "Representante Demo",
      contactTitle: "Gerente de compras",
      phone: "+507 6000-0000",
      whatsapp: "+507 6000-0000",
      contactCountry: "PA",
      city: "Ciudad de Panamá",
      authorized: "on",
      companyType: "construction",
      categoryIds: [pickBy(categories, "piso"), pickBy(categories, "puerta")].filter(Boolean).join(","),
      destinationCountry: "PA",
      purchaseVolume: "2 contenedores al año",
      purchaseFrequencyId: pickBy(frequencies, "trimes"),
      needsDescription: "Pisos y puertas para un edificio de 40 apartamentos.",
    }));
    setFillCount((n) => n + 1);
    goTo(stepIndex);
  }

  if (submittedEmail) {
    return (
      <section role="status" className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-navy-800">{ta("received.title")}</h2>
        <p className="text-ink">{ta("received.body")}</p>
        <p className="rounded-(--radius-control) border border-gold-300 bg-gold-100 px-4 py-3 text-sm text-ink">
          {ta("received.confirmEmail", { email: submittedEmail })}
        </p>
        <Link href="/ingresar" className="inline-block text-sm font-semibold text-navy-800 hover:underline">
          {ta("received.signIn")}
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {demo ? (
        <button
          type="button"
          onClick={fillDemo}
          className="w-full rounded-(--radius-control) border border-dashed border-gold-500 bg-gold-100 px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-gold-300/40"
        >
          {ta("demoFill")}
        </button>
      ) : null}
      <nav aria-label={t("stepsLabel")}>
        <ol className="flex gap-1.5">
          {steps.map((s, i) => {
            const current = i === stepIndex;
            const label = t(`steps.${kind}.${s === "enviar" ? "verificacion" : s}`);
            return (
              <li key={s} className={current ? "min-w-0 flex-[2]" : "min-w-9 flex-1"}>
                <button
                  type="button"
                  disabled={i > stepIndex || pending}
                  onClick={() => {
                    saveCurrent();
                    goTo(i);
                  }}
                  aria-current={current ? "step" : undefined}
                  className={`block w-full truncate rounded-(--radius-control) border px-2 py-2 text-center text-xs font-semibold sm:text-sm ${
                    current
                      ? "border-navy-800 bg-navy-800 text-white"
                      : i < stepIndex
                        ? "border-gold-300 bg-gold-100 text-navy-800"
                        : "border-line bg-surface text-ink-muted"
                  }`}
                >
                  {i + 1}
                  <span className={current ? "" : "sr-only sm:not-sr-only"}>. {label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <h2 className="font-display text-lg font-semibold text-navy-800">{t(`stepTitles.${kind}.${step === "enviar" ? "verificacion" : step}`)}</h2>

      <form id="access-form" key={`${step}-${fillCount}`} onSubmit={onSubmit} noValidate className="space-y-5">
        {formError ? <FormAlert>{ta(`errors.${formError}`)}</FormAlert> : null}

        {step === "datos" ? (
          <>
            <fieldset aria-describedby={errors.accountType ? "accountType-error" : undefined}>
              <legend className="font-display text-base font-semibold text-navy-800">{t("accountTypeQuestion")}</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(allowIndividual ? (["company", "individual"] as const) : (["company"] as const)).map((type) => (
                  <label
                    key={type}
                    className="flex cursor-pointer gap-3 rounded-(--radius-control) border border-line p-4 has-checked:border-navy-800 has-checked:bg-navy-50"
                  >
                    <input
                      type="radio"
                      name="accountType"
                      value={type}
                      checked={accountType === type}
                      onChange={() => setValues((prev) => ({ ...prev, accountType: type }))}
                      className="mt-1 accent-navy-800"
                    />
                    <span>
                      <span className="block font-display font-semibold text-navy-800">{t(`accountTypes.${type}.title`)}</span>
                      <span className="mt-0.5 block text-sm text-ink-muted">{t(`accountTypes.${type}.body`)}</span>
                    </span>
                  </label>
                ))}
              </div>
              {errors.accountType ? (
                <p id="accountType-error" className="mt-1.5 text-sm text-danger">
                  {err("accountType", t("accountTypeQuestion"))}
                </p>
              ) : null}
            </fieldset>

            {accountType === "individual" ? (
              <p role="note" className="rounded-(--radius-control) border border-gold-300 bg-gold-100 px-4 py-3 text-sm text-ink">
                {t("individualNotice")}
              </p>
            ) : null}

            {isCompany ? (
              <>
                <Field name="legalName" label={tf("legalName")} autoComplete="organization" defaultValue={v("legalName")} error={err("legalName", tf("legalName"))} />
                <Field name="tradeName" label={tf("tradeName")} defaultValue={v("tradeName")} error={err("tradeName", tf("tradeName"))} />
                <SelectField name="country" label={tf("incorporationCountry")} placeholder={t("choose")} options={countries} defaultValue={v("country")} error={err("country", tf("incorporationCountry"))} />
                <Field name="taxId" label={tf("taxId")} hint={t("hints.taxId")} defaultValue={v("taxId")} error={err("taxId", tf("taxId"))} />
                <Field name="economicActivity" label={tf("economicActivity")} hint={t("hints.economicActivity")} defaultValue={v("economicActivity")} error={err("economicActivity", tf("economicActivity"))} />
                <SelectField name="sectorId" label={tf("sector")} placeholder={t("choose")} options={sectors} defaultValue={v("sectorId")} error={err("sectorId", tf("sector"))} />
                <Field name="website" label={`${tf("website")} · ${t("optional")}`} inputMode="url" placeholder="www.empresa.com" defaultValue={v("website")} error={err("website", tf("website"))} />
              </>
            ) : accountType === "individual" ? (
              <>
                <Field name="fullName" label={tf("fullName")} autoComplete="name" defaultValue={v("fullName")} error={err("fullName", tf("fullName"))} />
                <SelectField name="country" label={tf("residenceCountry")} placeholder={t("choose")} options={countries} defaultValue={v("country")} error={err("country", tf("residenceCountry"))} />
                <div className="grid gap-5 sm:grid-cols-2">
                  <SelectField
                    name="idType"
                    label={tf("idType")}
                    placeholder={t("choose")}
                    options={idTypes.map((x) => ({ value: x, label: t(`idTypes.${x}`) }))}
                    defaultValue={v("idType")}
                    error={err("idType", tf("idType"))}
                  />
                  <Field name="idNumber" label={tf("idNumber")} defaultValue={v("idNumber")} error={err("idNumber", tf("idNumber"))} />
                </div>
                <Field name="economicActivity" label={tf("economicActivity")} hint={t("hints.economicActivityIndividual")} defaultValue={v("economicActivity")} error={err("economicActivity", tf("economicActivity"))} />
              </>
            ) : null}
          </>
        ) : null}

        {step === "contacto" ? (
          <>
            <p className="rounded-(--radius-control) bg-navy-50 px-4 py-3 text-sm text-ink">{t("privacyNote")}</p>
            {isCompany ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field name="contactName" label={tf("representativeName")} autoComplete="name" defaultValue={v("contactName")} error={err("contactName", tf("representativeName"))} />
                <Field name="contactTitle" label={tf("contactTitle")} autoComplete="organization-title" defaultValue={v("contactTitle")} error={err("contactTitle", tf("contactTitle"))} />
              </div>
            ) : null}
            <Field
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              label={isCompany ? tf("corporateEmail") : tf("email")}
              hint={ta("emailHint")}
              defaultValue={v("email")}
              error={err("email", isCompany ? tf("corporateEmail") : tf("email"))}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field name="phone" type="tel" autoComplete="tel" inputMode="tel" label={tf("phone")} hint={t("hints.phone")} defaultValue={v("phone")} error={err("phone", tf("phone"))} />
              <Field name="whatsapp" type="tel" inputMode="tel" label={tf("whatsapp")} hint={t("hints.whatsapp")} defaultValue={v("whatsapp")} error={err("whatsapp", tf("whatsapp"))} />
            </div>
            {isCompany ? (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <SelectField name="contactCountry" label={tf("contactCountry")} placeholder={t("choose")} options={countries} defaultValue={v("contactCountry") || v("country")} error={err("contactCountry", tf("contactCountry"))} />
                  <Field name="city" label={tf("city")} autoComplete="address-level2" defaultValue={v("city")} error={err("city", tf("city"))} />
                </div>
                <CheckboxField
                  name="authorized"
                  defaultChecked={v("authorized") === "on"}
                  label={t("authorizedRepresentative")}
                  error={err("authorized", t("authorizedRepresentativeShort"))}
                />
              </>
            ) : null}
          </>
        ) : null}

        {step === "perfil" ? (
          <>
            {isCompany ? (
              <SelectField
                name="companyType"
                label={tf("companyType")}
                placeholder={t("choose")}
                options={companyTypes.map((x) => ({ value: x, label: t(`companyTypes.${x}`) }))}
                defaultValue={v("companyType")}
                error={err("companyType", tf("companyType"))}
              />
            ) : (
              <TextareaField name="purchasePurpose" label={tf("purchasePurpose")} hint={t("hints.purchasePurpose")} defaultValue={v("purchasePurpose")} error={err("purchasePurpose", tf("purchasePurpose"))} />
            )}
            <CategoryPicker
              label={tf("interestCategories")}
              hint={t("hints.interestCategories")}
              options={categories}
              selected={new Set(v("categoryIds").split(",").filter(Boolean))}
              error={err("categoryIds", tf("interestCategories"))}
            />
            <SelectField name="destinationCountry" label={tf("destinationCountry")} placeholder={t("choose")} options={countries} defaultValue={v("destinationCountry")} error={err("destinationCountry", tf("destinationCountry"))} />
            <Field name="purchaseVolume" label={tf("purchaseVolume")} hint={t("hints.purchaseVolume")} defaultValue={v("purchaseVolume")} error={err("purchaseVolume", tf("purchaseVolume"))} />
            {isCompany ? (
              <>
                <SelectField name="purchaseFrequencyId" label={tf("purchaseFrequency")} placeholder={t("choose")} options={frequencies} defaultValue={v("purchaseFrequencyId")} error={err("purchaseFrequencyId", tf("purchaseFrequency"))} />
                <TextareaField name="needsDescription" label={`${tf("needsDescription")} · ${t("optional")}`} defaultValue={v("needsDescription")} />
              </>
            ) : null}
          </>
        ) : null}

        {step === "enviar" ? (
          <>
            {!isCompany ? (
              <p role="note" className="rounded-(--radius-control) border border-gold-300 bg-gold-100 px-4 py-3 text-sm text-ink">
                {t("individualNotice")}
              </p>
            ) : null}
            <section className="space-y-4 rounded-(--radius-control) border border-line p-4">
              <h3 className="font-display text-base font-semibold text-navy-800">{ta("accountTitle")}</h3>
              <p className="text-sm text-ink">{ta("accountBody", { email: v("email") })}</p>
              <Field
                name="password"
                type="password"
                autoComplete="new-password"
                label={tforms("fields.password")}
                hint={tforms("passwordHint", { min: MIN_PASSWORD_LENGTH })}
                error={err("password", tforms("fields.password"))}
              />
              <Field
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                label={tforms("fields.passwordConfirm")}
                error={err("passwordConfirm", tforms("fields.passwordConfirm"))}
              />
            </section>
            <p className="rounded-(--radius-control) bg-navy-50 px-4 py-3 text-sm text-ink">{ta("documentsLater")}</p>
            {legalDocuments.map((doc) => {
              const title = t(`legal.${doc.kind}`);
              const name = legalField[doc.kind];
              return (
                <section key={doc.id} className="space-y-3">
                  <h3 className="font-display text-base font-semibold text-navy-800">
                    {title} <span className="text-sm font-normal text-ink-muted">· v{doc.version}</span>
                  </h3>
                  {doc.isDraft ? (
                    <p role="note" className="rounded-(--radius-control) border border-gold-300 bg-gold-100 px-4 py-3 text-sm text-ink">
                      {t("legal.draftNotice")}
                    </p>
                  ) : null}
                  <div className="max-h-48 overflow-y-auto rounded-(--radius-control) border border-line bg-surface-muted p-4 text-sm whitespace-pre-line text-ink">
                    {doc.text}
                  </div>
                  <CheckboxField name={name} defaultChecked={v(name) === "on"} label={t("legal.accept", { document: title })} error={err(name, title)} />
                </section>
              );
            })}
          </>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={() => {
                saveCurrent();
                goTo(stepIndex - 1);
              }}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-(--radius-control) border border-line px-5 font-semibold text-navy-800 hover:bg-navy-50"
            >
              {ta("back")}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-(--radius-control) bg-navy-800 px-5 font-semibold text-white hover:bg-navy-900 disabled:opacity-60"
          >
            {pending ? tforms("sending") : step === "enviar" ? t("submit") : ta("continue")}
          </button>
        </div>
      </form>
    </div>
  );
}
