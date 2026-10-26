"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Field, FormAlert, TextareaField, useFieldError } from "@/components/forms";
import { findContactInfo } from "@/lib/contact-detection";
import { initialFormState } from "@/lib/forms";
import { saveQuote, type QuoteField } from "@/lib/quotes/actions";

export type QuoteFormInitial = {
  offerType: "exact" | "alternative";
  alternativeDifferences: string;
  currency: string;
  prices: Record<string, string>;
  moq: string;
  productionTimeDays: string;
  departurePort: string;
  validUntil: string;
  depositPct: string;
  depositTiming: string;
  balancePct: string;
  balanceTiming: string;
  sampleAvailable: "" | "yes" | "no";
  sampleCost: string;
  sampleShipping: "" | "free" | "paid";
  sampleShippingCost: string;
};

function Buttons() {
  const t = useTranslations("Quote.form");
  const { pending } = useFormStatus();
  const base = "inline-flex min-h-12 flex-1 items-center justify-center rounded-(--radius-control) px-6 font-display font-semibold disabled:opacity-50";
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button type="submit" name="intent" value="submit" disabled={pending} className={`${base} bg-navy-800 text-white hover:bg-navy-900`}>
        {pending ? t("sending") : t("submit")}
      </button>
      <button type="submit" name="intent" value="draft" disabled={pending} className={`${base} border border-navy-800 text-navy-800 hover:bg-navy-50`}>
        {t("saveDraft")}
      </button>
    </div>
  );
}

function Choice({ name, value, checked, onChange, children }: { name: string; value: string; checked: boolean; onChange: () => void; children: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-control) border border-line px-4 has-checked:border-navy-800 has-checked:bg-navy-50 has-disabled:cursor-not-allowed has-disabled:opacity-50">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="size-5 accent-navy-800" />
      <span>{children}</span>
    </label>
  );
}

export function QuoteForm({
  rfqId,
  incoterms,
  acceptsAlternatives,
  unitLabel,
  initial,
}: {
  rfqId: string;
  incoterms: string[];
  acceptsAlternatives: boolean;
  unitLabel: string;
  initial: QuoteFormInitial;
}) {
  const t = useTranslations("Quote");
  const fieldError = useFieldError();
  const [state, action] = useActionState(saveQuote, initialFormState);
  const v = state.values as Record<string, string> | undefined;
  const val = (name: keyof QuoteFormInitial) => (v?.[name] ?? initial[name]) as string;
  const [offerType, setOfferType] = useState(val("offerType") || "exact");
  const [sample, setSample] = useState(val("sampleAvailable"));
  const [shipping, setShipping] = useState(val("sampleShipping"));
  const [deposit, setDeposit] = useState(val("depositPct"));
  const [warnings, setWarnings] = useState<Record<string, string | undefined>>({});

  const label = (name: string) => t(`fields.${name}`);
  const err = (name: QuoteField) => {
    const code = state.fieldErrors?.[name];
    if (!code) return warnings[name];
    if (code === "contactInfo") return t("errors.contactInfo", { field: label(name) });
    if (["alternativeNotAccepted", "pricePerTerm", "invalidDays", "validityFuture", "sumTo100"].includes(code)) return t(`errors.${code}`);
    return fieldError(code, label(name));
  };
  const watch = (name: string) => ({
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const found = findContactInfo(e.target.value);
      setWarnings((w) => ({ ...w, [name]: found ? t("errors.contactInfoLive", { found }) : undefined }));
    },
  });
  const depositNumber = Number(deposit.replace(",", "."));
  const balanceSuggestion = deposit && Number.isFinite(depositNumber) && depositNumber >= 0 && depositNumber <= 100 ? String(100 - depositNumber) : "";

  return (
    <form action={action} noValidate className="space-y-6">
      <input type="hidden" name="rfqId" value={rfqId} />
      {state.status === "success" && state.message === "saved" ? <FormAlert tone="success">{t("form.saved")}</FormAlert> : null}
      {state.formError ? <FormAlert>{t(`formErrors.${state.formError}`)}</FormAlert> : null}

      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.offer")}</legend>
        <div className="flex flex-wrap gap-2">
          <Choice name="offerType" value="exact" checked={offerType === "exact"} onChange={() => setOfferType("exact")}>
            {t("offerTypes.exact")}
          </Choice>
          {acceptsAlternatives ? (
            <Choice name="offerType" value="alternative" checked={offerType === "alternative"} onChange={() => setOfferType("alternative")}>
              {t("offerTypes.alternative")}
            </Choice>
          ) : null}
        </div>
        {!acceptsAlternatives ? <p className="text-sm text-ink-muted">{t("hints.noAlternatives")}</p> : null}
        {err("offerType") ? <p className="text-sm text-danger">{err("offerType")}</p> : null}
        {offerType === "alternative" ? (
          <TextareaField
            name="alternativeDifferences"
            label={label("alternativeDifferences")}
            hint={t("hints.alternativeDifferences")}
            defaultValue={val("alternativeDifferences")}
            error={err("alternativeDifferences")}
            {...watch("alternativeDifferences")}
          />
        ) : null}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.prices")}</legend>
        <Field name="currency" label={label("currency")} placeholder="USD" maxLength={3} hint={t("hints.currency")} defaultValue={val("currency")} error={err("currency")} className="sm:w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {incoterms.map((term) => (
            <Field
              key={term}
              name={`price_${term}`}
              inputMode="decimal"
              label={t("fields.unitPrice", { term, unit: unitLabel })}
              defaultValue={v?.[`price_${term}`] ?? initial.prices[term] ?? ""}
            />
          ))}
        </div>
        {err("prices") ? <p className="text-sm text-danger">{err("prices")}</p> : null}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.terms")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="moq" inputMode="decimal" label={t("fields.moqWithUnit", { unit: unitLabel })} defaultValue={val("moq")} error={err("moq")} />
          <Field name="productionTimeDays" inputMode="numeric" label={label("productionTimeDays")} defaultValue={val("productionTimeDays")} error={err("productionTimeDays")} />
          <Field name="departurePort" label={label("departurePort")} defaultValue={val("departurePort")} error={err("departurePort")} {...watch("departurePort")} />
          <Field name="validUntil" type="date" label={label("validUntil")} defaultValue={val("validUntil")} error={err("validUntil")} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.payment")}</legend>
        <p className="text-sm text-ink-muted">{t("hints.payment")}</p>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field name="depositPct" inputMode="decimal" label={label("depositPct")} defaultValue={val("depositPct")} onChange={(e) => setDeposit(e.target.value)} error={err("depositPct")} />
          <Field name="depositTiming" label={label("depositTiming")} placeholder={t("hints.depositTimingExample")} defaultValue={val("depositTiming")} error={err("depositTiming")} {...watch("depositTiming")} />
          <Field name="balancePct" inputMode="decimal" label={label("balancePct")} hint={balanceSuggestion ? t("hints.balanceSuggestion", { value: balanceSuggestion }) : undefined} defaultValue={val("balancePct")} error={err("balancePct")} />
          <Field name="balanceTiming" label={label("balanceTiming")} placeholder={t("hints.balanceTimingExample")} defaultValue={val("balanceTiming")} error={err("balanceTiming")} {...watch("balanceTiming")} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-lg font-semibold text-navy-800">{t("sections.sample")}</legend>
        <div className="flex flex-wrap gap-2">
          <Choice name="sampleAvailable" value="yes" checked={sample === "yes"} onChange={() => setSample("yes")}>
            {t("sampleAvailable.yes")}
          </Choice>
          <Choice name="sampleAvailable" value="no" checked={sample === "no"} onChange={() => setSample("no")}>
            {t("sampleAvailable.no")}
          </Choice>
        </div>
        {err("sampleAvailable") ? <p className="text-sm text-danger">{err("sampleAvailable")}</p> : null}
        {sample === "yes" ? (
          <div className="space-y-4">
            <Field name="sampleCost" inputMode="decimal" label={label("sampleCost")} hint={t("hints.sampleCost")} defaultValue={val("sampleCost")} error={err("sampleCost")} className="sm:w-60" />
            <div>
              <p className="text-sm font-medium text-ink">{label("sampleShipping")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Choice name="sampleShipping" value="free" checked={shipping === "free"} onChange={() => setShipping("free")}>
                  {t("sampleShipping.free")}
                </Choice>
                <Choice name="sampleShipping" value="paid" checked={shipping === "paid"} onChange={() => setShipping("paid")}>
                  {t("sampleShipping.paid")}
                </Choice>
              </div>
              {err("sampleShipping") ? <p className="mt-1.5 text-sm text-danger">{err("sampleShipping")}</p> : null}
            </div>
            {shipping === "paid" ? (
              <Field name="sampleShippingCost" inputMode="decimal" label={label("sampleShippingCost")} defaultValue={val("sampleShippingCost")} error={err("sampleShippingCost")} className="sm:w-60" />
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <p className="text-sm text-ink-muted">{t("hints.noContact")}</p>
      <Buttons />
    </form>
  );
}
