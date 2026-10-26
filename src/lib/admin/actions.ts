"use server";

import { refresh } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { compact, hasErrors, readString, validateRequired, type FieldErrorCode, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ReviewAction = Database["public"]["Enums"]["company_review_action"];
type Tier = Database["public"]["Enums"]["factory_tier"];
type BillingPeriod = Database["public"]["Enums"]["billing_period"];

// Cada acción se autoriza sola; además RLS y las funciones de la base
// vuelven a comprobar que quien llama es administrador.
async function adminClient() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return createClient();
}

const reviewActions: ReviewAction[] = ["validate", "request_info", "reject", "suspend"];
const tiers: Tier[] = ["vip", "standard"];
const billingPeriods: BillingPeriod[] = ["monthly", "quarterly", "semiannual", "annual", "one_time"];

// ---------------------------------------------------------------------------
// Revisión de empresas
// ---------------------------------------------------------------------------
const reviewErrorMap: Record<string, string> = {
  tier_required: "tierRequired",
  license_required: "licenseRequired",
  message_required: "messageRequired",
  invalid_transition: "invalidTransition",
  not_found: "notFound",
  not_admin: "notAllowed",
};

export async function reviewCompany(
  _prev: FormState<"message" | "tier">,
  formData: FormData,
): Promise<FormState<"message" | "tier">> {
  const supabase = await adminClient();
  if (!supabase) return { status: "error", formError: "notAllowed" };

  const companyId = readString(formData, "companyId");
  const action = readString(formData, "action") as ReviewAction;
  const message = readString(formData, "message");
  const tier = readString(formData, "tier");
  if (!reviewActions.includes(action)) return { status: "error", formError: "invalidTransition" };

  const needsMessage = action !== "validate";
  const errors = {
    message: needsMessage ? validateRequired(message) : undefined,
    tier: tier && !tiers.includes(tier as Tier) ? ("invalidChoice" as const) : undefined,
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: { message, tier } };

  const { error } = await supabase.rpc("admin_review_company", {
    p_company: companyId,
    p_action: action,
    p_message: message || undefined,
    p_tier: (tier || undefined) as Tier | undefined,
  });
  if (error) {
    return { status: "error", formError: reviewErrorMap[error.message] ?? "saveFailed", values: { message, tier } };
  }
  refresh();
  return { status: "success", message: `done.${action}` };
}

// Marca como verificados (o no) el año de fundación y la capacidad/ventas.
export async function setFactoryVerification(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;
  await supabase
    .from("factory_details")
    .update({
      founded_year_verified: formData.get("foundedYearVerified") === "on",
      annual_figure_verified: formData.get("annualFigureVerified") === "on",
    })
    .eq("company_id", readString(formData, "companyId"));
  refresh();
}

// ---------------------------------------------------------------------------
// Datos comerciales de la fábrica: tipo, comisión (sin valor por defecto) y notas
// ---------------------------------------------------------------------------
type CommercialField = "tier" | "commissionRate";

export async function saveFactoryCommercial(
  _prev: FormState<CommercialField>,
  formData: FormData,
): Promise<FormState<CommercialField>> {
  const supabase = await adminClient();
  if (!supabase) return { status: "error", formError: "notAllowed" };

  const companyId = readString(formData, "companyId");
  const tier = readString(formData, "tier");
  const rateRaw = readString(formData, "commissionRate").replace(",", ".");
  const notes = readString(formData, "notes");
  const rate = rateRaw === "" ? null : Number(rateRaw);

  const errors: Record<CommercialField, FieldErrorCode | undefined> = {
    tier: tier && !tiers.includes(tier as Tier) ? "invalidChoice" : undefined,
    commissionRate: rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100) ? "invalidPercent" : undefined,
  };
  const values = { tier, commissionRate: rateRaw };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values };

  const profile = await getCurrentProfile();
  const { error } = await supabase.from("factory_admin").upsert({
    company_id: companyId,
    tier: (tier || null) as Tier | null,
    commission_rate: rate,
    notes: notes || null,
    updated_by: profile!.id,
  });
  if (error) return { status: "error", formError: error.message === "license_required" ? "licenseRequired" : "saveFailed", values };
  refresh();
  return { status: "success", message: "saved" };
}

// ---------------------------------------------------------------------------
// Membresías
// ---------------------------------------------------------------------------
type MembershipField = "planId" | "startsAt" | "endsAt";

export async function assignMembership(
  _prev: FormState<MembershipField>,
  formData: FormData,
): Promise<FormState<MembershipField>> {
  const supabase = await adminClient();
  if (!supabase) return { status: "error", formError: "notAllowed" };

  const v = {
    planId: readString(formData, "planId"),
    startsAt: readString(formData, "startsAt"),
    endsAt: readString(formData, "endsAt"),
  };
  const errors: Record<MembershipField, FieldErrorCode | undefined> = {
    planId: validateRequired(v.planId),
    startsAt: validateRequired(v.startsAt),
    endsAt: v.endsAt && v.startsAt && v.endsAt < v.startsAt ? "endBeforeStart" : undefined,
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: v };

  const profile = await getCurrentProfile();
  const { error } = await supabase.from("factory_memberships").insert({
    factory_company_id: readString(formData, "companyId"),
    plan_id: v.planId,
    starts_at: v.startsAt,
    ends_at: v.endsAt || null,
    created_by: profile!.id,
  });
  if (error) return { status: "error", formError: "saveFailed", values: v };
  refresh();
  return { status: "success", message: "saved" };
}

export async function endMembership(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("factory_memberships")
    .update({ ends_at: today })
    .eq("id", readString(formData, "membershipId"))
    .is("ends_at", null);
  refresh();
}

// ---------------------------------------------------------------------------
// Planes de membresía (sin valores precargados; nunca mencionan el showroom)
// ---------------------------------------------------------------------------
type PlanField = "name" | "price" | "currency" | "billingPeriod" | "description" | "benefits";
const SHOWROOM = /showroom/i;

export async function savePlan(_prev: FormState<PlanField>, formData: FormData): Promise<FormState<PlanField>> {
  const supabase = await adminClient();
  if (!supabase) return { status: "error", formError: "notAllowed" };

  const id = readString(formData, "id");
  const v = {
    name: readString(formData, "name"),
    description: readString(formData, "description"),
    benefits: readString(formData, "benefits"),
    price: readString(formData, "price").replace(",", "."),
    currency: readString(formData, "currency").toUpperCase(),
    billingPeriod: readString(formData, "billingPeriod"),
  };
  const price = Number(v.price);
  const benefits = v.benefits.split("\n").map((b) => b.trim()).filter(Boolean);
  const errors: Record<PlanField, FieldErrorCode | undefined> = {
    name: validateRequired(v.name) ?? (SHOWROOM.test(v.name) ? "noShowroom" : undefined),
    description: SHOWROOM.test(v.description) ? "noShowroom" : undefined,
    benefits: benefits.some((b) => SHOWROOM.test(b)) ? "noShowroom" : undefined,
    price: !v.price ? "required" : !Number.isFinite(price) || price < 0 ? "invalidAmount" : undefined,
    currency: !v.currency ? "required" : /^[A-Z]{3}$/.test(v.currency) ? undefined : "invalidCurrency",
    billingPeriod: !v.billingPeriod
      ? "required"
      : billingPeriods.includes(v.billingPeriod as BillingPeriod)
        ? undefined
        : "invalidChoice",
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: v };

  const row = {
    name: v.name,
    description: v.description || null,
    benefits,
    price,
    currency: v.currency,
    billing_period: v.billingPeriod as BillingPeriod,
    active: formData.get("active") === "on",
  };
  const { error } = id
    ? await supabase.from("membership_plans").update(row).eq("id", id)
    : await supabase.from("membership_plans").insert(row);
  if (error) return { status: "error", formError: "saveFailed", values: v };
  refresh();
  return { status: "success", message: id ? "updated" : "created" };
}

// ---------------------------------------------------------------------------
// Configuración de la plataforma
// ---------------------------------------------------------------------------
type SettingsField = "pendingCompanyAlertHours" | "unansweredRfqAlertHours";

export async function saveSettings(
  _prev: FormState<SettingsField>,
  formData: FormData,
): Promise<FormState<SettingsField>> {
  const supabase = await adminClient();
  if (!supabase) return { status: "error", formError: "notAllowed" };

  const hours = (name: SettingsField) => {
    const raw = readString(formData, name).replace(",", ".");
    if (!raw) return { value: null };
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? { value: n } : { value: null, error: "invalidHours" as FieldErrorCode };
  };
  const pending = hours("pendingCompanyAlertHours");
  const rfq = hours("unansweredRfqAlertHours");
  const values = {
    pendingCompanyAlertHours: readString(formData, "pendingCompanyAlertHours"),
    unansweredRfqAlertHours: readString(formData, "unansweredRfqAlertHours"),
  };
  const errors = { pendingCompanyAlertHours: pending.error, unansweredRfqAlertHours: rfq.error };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values };

  const profile = await getCurrentProfile();
  const updates: [string, unknown][] = [
    ["factory_sees_buyer_name", formData.get("factorySeesBuyerName") === "on"],
    ["buyer_sees_factory_tier", formData.get("buyerSeesFactoryTier") === "on"],
    ["allow_individual_buyers", formData.get("allowIndividualBuyers") === "on"],
    ["pending_company_alert_hours", pending.value],
    ["unanswered_rfq_alert_hours", rfq.value],
  ];
  for (const [key, value] of updates) {
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: value as never, updated_by: profile!.id })
      .eq("key", key);
    if (error) return { status: "error", formError: "saveFailed", values };
  }
  refresh();
  return { status: "success", message: "saved" };
}

// ---------------------------------------------------------------------------
// Listas editables: sectores y categorías
// ---------------------------------------------------------------------------
type OptionField = "nameEs" | "slug";

export async function saveOption(
  table: "sectors" | "categories" | "units",
  _prev: FormState<OptionField>,
  formData: FormData,
): Promise<FormState<OptionField>> {
  const supabase = await adminClient();
  if (!supabase) return { status: "error", formError: "notAllowed" };

  const id = readString(formData, "id");
  const nameEs = readString(formData, "nameEs");
  const slug =
    readString(formData, "slug") ||
    nameEs
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const errors = { nameEs: validateRequired(nameEs), slug: slug ? undefined : ("required" as const) };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: { nameEs, slug } };

  const sortOrder = Number(readString(formData, "sortOrder")) || 0;
  const active = formData.get("active") === "on";

  if (id) {
    const { data: current } = await supabase.from(table).select("names").eq("id", id).maybeSingle();
    const names = { ...((current?.names as Record<string, string>) ?? {}), es: nameEs };
    const { error } = await supabase.from(table).update({ names, active, sort_order: sortOrder }).eq("id", id);
    if (error) return { status: "error", formError: "saveFailed", values: { nameEs, slug } };
  } else {
    const { error } = await supabase.from(table).insert({ slug, names: { es: nameEs }, active, sort_order: sortOrder });
    if (error) {
      return { status: "error", formError: error.code === "23505" ? "slugTaken" : "saveFailed", values: { nameEs, slug } };
    }
  }
  refresh();
  return { status: "success", message: "saved" };
}

// ---------------------------------------------------------------------------
// Textos legales: cada cambio es una versión nueva (las aceptaciones guardan
// la versión que se aceptó).
// ---------------------------------------------------------------------------
type LegalField = "contentEs";

export async function publishLegalVersion(
  _prev: FormState<LegalField>,
  formData: FormData,
): Promise<FormState<LegalField>> {
  const supabase = await adminClient();
  if (!supabase) return { status: "error", formError: "notAllowed" };

  const kind = readString(formData, "kind") as "terms" | "non_circumvention";
  const contentEs = readString(formData, "contentEs");
  if (!["terms", "non_circumvention"].includes(kind)) return { status: "error", formError: "saveFailed" };
  const errors = { contentEs: validateRequired(contentEs) };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: { contentEs } };

  const { data: last } = await supabase
    .from("legal_documents")
    .select("version, content")
    .eq("kind", kind)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const isDraft = formData.get("isDraft") === "on";
  const profile = await getCurrentProfile();
  const { error } = await supabase.from("legal_documents").insert({
    kind,
    version: (last?.version ?? 0) + 1,
    content: { ...((last?.content as Record<string, string>) ?? {}), es: contentEs },
    is_draft: isDraft,
    published_at: isDraft ? null : new Date().toISOString(),
    created_by: profile!.id,
  });
  if (error) return { status: "error", formError: "saveFailed", values: { contentEs } };
  refresh();
  return { status: "success", message: "saved" };
}
