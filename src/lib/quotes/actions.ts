"use server";

import { refresh } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { findContactInfo } from "@/lib/contact-detection";
import { compact, hasErrors, readString, validateRequired, type FieldErrorCode, type FormState } from "@/lib/forms";
import type { Incoterm } from "@/lib/rfqs/constants";
import { createClient } from "@/lib/supabase/server";

export type QuoteField =
  | "offerType"
  | "alternativeDifferences"
  | "currency"
  | "prices"
  | "moq"
  | "productionTimeDays"
  | "departurePort"
  | "validUntil"
  | "depositPct"
  | "depositTiming"
  | "balancePct"
  | "balanceTiming"
  | "sampleAvailable"
  | "sampleCost"
  | "sampleShipping"
  | "sampleShippingCost";

const submitErrorMap: Record<string, string> = {
  alternative_not_accepted: "alternativeNotAccepted",
  prices_mismatch: "pricesMismatch",
  validity_past: "validityPast",
  rfq_closed: "rfqClosed",
  not_editable: "notEditable",
  not_found: "notFound",
};

const number = (raw: string) => (raw === "" ? null : Number(raw.replace(",", ".")));
const isAmount = (n: number | null) => n !== null && Number.isFinite(n) && n >= 0;
const isPositive = (n: number | null) => n !== null && Number.isFinite(n) && n > 0;

// Guarda la cotización de la fábrica (borrador) y, con intent = submit, la envía.
// En borrador no se exige nada; al enviar, todos los campos y un precio por término pedido.
export async function saveQuote(_prev: FormState<QuoteField>, formData: FormData): Promise<FormState<QuoteField>> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "factory" || !profile.companyId) return { status: "error", formError: "notAllowed" };
  const supabase = await createClient();

  const rfqId = readString(formData, "rfqId");
  const submit = readString(formData, "intent") === "submit";
  const { data: rfq } = await supabase.from("rfqs").select("id, incoterms, accepts_alternatives").eq("id", rfqId).maybeSingle();
  if (!rfq) return { status: "error", formError: "notFound" };

  const v = {
    offerType: readString(formData, "offerType") || "exact",
    alternativeDifferences: readString(formData, "alternativeDifferences"),
    currency: readString(formData, "currency").toUpperCase(),
    moq: readString(formData, "moq"),
    productionTimeDays: readString(formData, "productionTimeDays"),
    departurePort: readString(formData, "departurePort"),
    validUntil: readString(formData, "validUntil"),
    depositPct: readString(formData, "depositPct"),
    depositTiming: readString(formData, "depositTiming"),
    balancePct: readString(formData, "balancePct"),
    balanceTiming: readString(formData, "balanceTiming"),
    sampleAvailable: readString(formData, "sampleAvailable"),
    sampleCost: readString(formData, "sampleCost"),
    sampleShipping: readString(formData, "sampleShipping"),
    sampleShippingCost: readString(formData, "sampleShippingCost"),
  };
  const requested = rfq.incoterms as Incoterm[];
  const prices = Object.fromEntries(requested.map((term) => [term, readString(formData, `price_${term}`)]));

  const n = {
    moq: number(v.moq),
    days: number(v.productionTimeDays),
    deposit: number(v.depositPct),
    balance: number(v.balancePct),
    sampleCost: number(v.sampleCost),
    shippingCost: number(v.sampleShippingCost),
  };
  const req = (value: string) => (submit ? validateRequired(value) : undefined);
  const alternative = v.offerType === "alternative";
  const sample = v.sampleAvailable === "yes";
  const paidShipping = v.sampleShipping === "paid";
  const pct = (raw: string, value: number | null): FieldErrorCode | undefined =>
    raw ? (value !== null && value >= 0 && value <= 100 ? undefined : "invalidPercent") : req(raw);

  const errors: Record<QuoteField, FieldErrorCode | undefined> = {
    offerType: !["exact", "alternative"].includes(v.offerType) ? "invalidChoice" : alternative && !rfq.accepts_alternatives ? "alternativeNotAccepted" : undefined,
    alternativeDifferences: alternative ? (submit ? validateRequired(v.alternativeDifferences) : undefined) : undefined,
    currency: v.currency ? (/^[A-Z]{3}$/.test(v.currency) ? undefined : "invalidCurrency") : req(v.currency),
    prices: requested.some((term) => (prices[term] ? !isAmount(number(prices[term])) : submit)) ? "pricePerTerm" : undefined,
    moq: v.moq ? (isPositive(n.moq) ? undefined : "invalidQuantity") : req(v.moq),
    productionTimeDays: v.productionTimeDays ? (isPositive(n.days) && Number.isInteger(n.days) ? undefined : "invalidDays") : req(v.productionTimeDays),
    departurePort: req(v.departurePort),
    validUntil: v.validUntil ? (v.validUntil >= new Date().toISOString().slice(0, 10) ? undefined : "validityFuture") : req(v.validUntil),
    depositPct: pct(v.depositPct, n.deposit),
    depositTiming: req(v.depositTiming),
    balancePct: pct(v.balancePct, n.balance) ?? (n.deposit !== null && n.balance !== null && n.deposit + n.balance !== 100 ? "sumTo100" : undefined),
    balanceTiming: n.balance === 0 ? undefined : req(v.balanceTiming),
    sampleAvailable: submit && !["yes", "no"].includes(v.sampleAvailable) ? "required" : undefined,
    sampleCost: sample ? (v.sampleCost ? (isAmount(n.sampleCost) ? undefined : "invalidAmount") : req(v.sampleCost)) : undefined,
    sampleShipping: sample && submit && !["free", "paid"].includes(v.sampleShipping) ? "required" : undefined,
    sampleShippingCost: sample && paidShipping ? (v.sampleShippingCost ? (isAmount(n.shippingCost) ? undefined : "invalidAmount") : req(v.sampleShippingCost)) : undefined,
  };
  for (const field of ["alternativeDifferences", "departurePort", "depositTiming", "balanceTiming"] as const) {
    if (!errors[field] && findContactInfo(v[field])) errors[field] = "contactInfo";
  }
  const values: Record<string, string> = { ...v, ...Object.fromEntries(requested.map((t) => [`price_${t}`, prices[t]])) };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values };

  const row = {
    offer_type: (alternative ? "alternative" : "exact") as "alternative" | "exact",
    alternative_differences: alternative ? v.alternativeDifferences || null : null,
    currency: v.currency || null,
    moq: n.moq,
    production_time_days: n.days,
    departure_port: v.departurePort || null,
    valid_until: v.validUntil || null,
    deposit_pct: n.deposit,
    deposit_timing: v.depositTiming || null,
    balance_pct: n.balance,
    balance_timing: v.balanceTiming || null,
    sample_available: v.sampleAvailable === "yes" ? true : v.sampleAvailable === "no" ? false : null,
    sample_cost: sample ? n.sampleCost : null,
    sample_shipping_free: sample ? (v.sampleShipping === "free" ? true : paidShipping ? false : null) : null,
    sample_shipping_cost: sample && paidShipping ? n.shippingCost : null,
  };

  const { data: existing } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("rfq_id", rfqId)
    .eq("factory_company_id", profile.companyId)
    .maybeSingle();
  if (existing && existing.status !== "draft") return { status: "error", formError: "notEditable", values };

  let quoteId = existing?.id;
  if (quoteId) {
    const { error } = await supabase.from("quotes").update(row).eq("id", quoteId);
    if (error) return { status: "error", formError: "saveFailed", values };
  } else {
    const { data, error } = await supabase
      .from("quotes")
      .insert({ ...row, rfq_id: rfqId, factory_company_id: profile.companyId, created_by: profile.id })
      .select("id")
      .single();
    if (error || !data) return { status: "error", formError: "saveFailed", values };
    quoteId = data.id;
  }

  // Precios: uno por término pedido.
  await supabase.from("quote_prices").delete().eq("quote_id", quoteId);
  const priceRows = requested
    .filter((term) => prices[term] !== "")
    .map((term) => ({ quote_id: quoteId!, incoterm: term, unit_price: number(prices[term])! }));
  if (priceRows.length) {
    const { error } = await supabase.from("quote_prices").insert(priceRows);
    if (error) return { status: "error", formError: "saveFailed", values };
  }

  if (submit) {
    const { error } = await supabase.rpc("submit_quote", { p_quote: quoteId });
    if (error) {
      const formError = error.message.startsWith("contact_info:") ? "contactInfo" : (submitErrorMap[error.message] ?? (error.code === "23514" ? "missingFields" : "saveFailed"));
      refresh();
      return { status: "error", formError, values };
    }
  }
  refresh();
  return { status: "success", message: submit ? "submitted" : "saved" };
}

// Comprador: marcar preferida, quitar preferencia o descartar.
export async function buyerQuoteAction(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") return;
  const action = readString(formData, "action");
  if (!["prefer", "unprefer", "discard"].includes(action)) return;
  const supabase = await createClient();
  await supabase.rpc("buyer_quote_action", { p_quote: readString(formData, "quoteId"), p_action: action });
  refresh();
}

// Administrador: ocultar (con motivo) o restaurar una cotización.
export async function adminHideQuote(_prev: FormState<"reason">, formData: FormData): Promise<FormState<"reason">> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { status: "error", formError: "notAllowed" };
  const supabase = await createClient();
  const hide = readString(formData, "hide") === "1";
  const reason = readString(formData, "reason");
  if (hide && !reason) return { status: "error", fieldErrors: { reason: "required" } };
  const { error } = await supabase.rpc("admin_hide_quote", { p_quote: readString(formData, "quoteId"), p_hide: hide, p_reason: reason });
  if (error) return { status: "error", formError: error.message === "invalid_transition" ? "invalidTransition" : "saveFailed" };
  refresh();
  return { status: "success" };
}

