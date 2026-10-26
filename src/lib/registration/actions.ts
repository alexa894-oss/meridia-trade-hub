"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentProfile, type CurrentProfile } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/roles";
import { isCountryCode } from "@/lib/countries";
import {
  compact,
  hasErrors,
  normalizeUrl,
  readString,
  validateEmail,
  validatePhone,
  validateRequired,
  validateYear,
  type FieldErrorCode,
  type FormState,
} from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_UPLOAD_TYPES, documentKinds, nextStepPath, type DocumentKind, type RegistrationStep } from "./steps";

const MIN_PROJECT_DESCRIPTION = 50;
type Party = Extract<CurrentProfile["role"], "buyer" | "factory">;

// Sesión + rol + empresa editable. Cada acción se autoriza sola.
async function editableContext(role: Party) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== role) return { error: "notAllowed" as const };
  const supabase = await createClient();

  if (profile.companyId) {
    const { data } = await supabase.from("companies").select("status").eq("id", profile.companyId).maybeSingle();
    if (!data || !["registered", "info_requested"].includes(data.status)) return { error: "notEditable" as const };
  }
  return { profile, supabase };
}

async function goTo(role: Party, step: RegistrationStep) {
  redirect({ href: nextStepPath(role, step), locale: await getLocale() });
}

async function ensureCompany(ctx: { profile: CurrentProfile; supabase: Awaited<ReturnType<typeof createClient>> }, country: string) {
  if (ctx.profile.companyId) return ctx.profile.companyId;
  const { data, error } = await ctx.supabase.rpc("register_company", { p_country: country });
  if (error || !data) throw new Error("register_company failed");
  return data;
}

// ---------------------------------------------------------------------------
// Comprador · Paso "datos": tipo de cuenta, país y datos de empresa o persona
// ---------------------------------------------------------------------------
type BuyerDetailsField =
  | "accountType"
  | "country"
  | "legalName"
  | "taxId"
  | "sectorId"
  | "website"
  | "fullName"
  | "projectDescription";

export async function saveBuyerDetails(
  _prev: FormState<BuyerDetailsField>,
  formData: FormData,
): Promise<FormState<BuyerDetailsField>> {
  const ctx = await editableContext("buyer");
  if ("error" in ctx) return { status: "error", formError: ctx.error };

  const v = {
    accountType: readString(formData, "accountType"),
    country: readString(formData, "country"),
    legalName: readString(formData, "legalName"),
    taxId: readString(formData, "taxId"),
    sectorId: readString(formData, "sectorId"),
    website: readString(formData, "website"),
    fullName: readString(formData, "fullName"),
    projectDescription: readString(formData, "projectDescription"),
  };

  const { data: settings } = await ctx.supabase.rpc("get_public_settings");
  const allowIndividual = (settings as Record<string, unknown> | null)?.allow_individual_buyers !== false;
  const isCompany = v.accountType === "company";
  const url = normalizeUrl(v.website);

  const errors: Record<BuyerDetailsField, FieldErrorCode | undefined> = {
    accountType: !v.accountType
      ? "required"
      : isCompany || (v.accountType === "individual" && allowIndividual)
        ? undefined
        : "invalidChoice",
    country: !v.country ? "required" : isCountryCode(v.country) ? undefined : "invalidChoice",
    legalName: isCompany ? validateRequired(v.legalName) : undefined,
    taxId: isCompany ? validateRequired(v.taxId) : undefined,
    sectorId: isCompany ? validateRequired(v.sectorId) : undefined,
    website: isCompany ? url.error : undefined,
    fullName: !isCompany ? validateRequired(v.fullName) : undefined,
    projectDescription: !isCompany
      ? !v.projectDescription
        ? "required"
        : v.projectDescription.length < MIN_PROJECT_DESCRIPTION
          ? "tooShort"
          : undefined
      : undefined,
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: v };

  const companyId = await ensureCompany(ctx, v.country);
  const { error: companyError } = await ctx.supabase
    .from("companies")
    .update({ country: v.country, sector_id: isCompany ? v.sectorId : null })
    .eq("id", companyId);
  const { error: detailsError } = await ctx.supabase.from("buyer_details").upsert({
    company_id: companyId,
    account_type: isCompany ? "company" : "individual",
    legal_name: isCompany ? v.legalName : null,
    tax_id: isCompany ? v.taxId : null,
    website: isCompany ? url.value : null,
    full_name: isCompany ? null : v.fullName,
    project_description: isCompany ? null : v.projectDescription,
  });
  if (companyError || detailsError) return { status: "error", formError: "saveFailed", values: v };

  await goTo("buyer", "datos");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Fábrica · Paso "empresa": nombres legales y ubicación
// ---------------------------------------------------------------------------
type FactoryCompanyField = "legalNameZh" | "legalNameEn" | "city" | "province";

export async function saveFactoryCompany(
  _prev: FormState<FactoryCompanyField>,
  formData: FormData,
): Promise<FormState<FactoryCompanyField>> {
  const ctx = await editableContext("factory");
  if ("error" in ctx) return { status: "error", formError: ctx.error };

  const v = {
    legalNameZh: readString(formData, "legalNameZh"),
    legalNameEn: readString(formData, "legalNameEn"),
    city: readString(formData, "city"),
    province: readString(formData, "province"),
  };
  const errors = {
    legalNameZh: validateRequired(v.legalNameZh),
    legalNameEn: validateRequired(v.legalNameEn),
    city: validateRequired(v.city),
    province: validateRequired(v.province),
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: v };

  // Fase 1: fábricas chinas.
  const companyId = await ensureCompany(ctx, "CN");
  const { error } = await ctx.supabase.from("factory_details").upsert({
    company_id: companyId,
    legal_name_zh: v.legalNameZh,
    legal_name_en: v.legalNameEn,
    city: v.city,
    province: v.province,
  });
  if (error) return { status: "error", formError: "saveFailed", values: v };

  await goTo("factory", "empresa");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Contacto (privado: solo lo ve la propia empresa y el administrador)
// ---------------------------------------------------------------------------
type ContactField = "contactName" | "contactTitle" | "phone" | "email" | "wechat";

export async function saveContact(
  role: Party,
  _prev: FormState<ContactField>,
  formData: FormData,
): Promise<FormState<ContactField>> {
  const ctx = await editableContext(role);
  if ("error" in ctx) return { status: "error", formError: ctx.error };
  if (!ctx.profile.companyId) return { status: "error", formError: "previousStepMissing" };

  // Persona natural: el contacto es la propia persona; no hay cargo.
  let individualName: string | null = null;
  if (role === "buyer") {
    const { data } = await ctx.supabase
      .from("buyer_details")
      .select("account_type, full_name")
      .eq("company_id", ctx.profile.companyId)
      .maybeSingle();
    if (!data) return { status: "error", formError: "previousStepMissing" };
    if (data.account_type === "individual") individualName = data.full_name;
  }
  const isIndividual = individualName !== null;

  const v = {
    contactName: readString(formData, "contactName"),
    contactTitle: readString(formData, "contactTitle"),
    phone: readString(formData, "phone"),
    email: readString(formData, "email").toLowerCase(),
    wechat: readString(formData, "wechat"),
  };
  const errors = {
    contactName: isIndividual ? undefined : validateRequired(v.contactName),
    contactTitle: isIndividual ? undefined : validateRequired(v.contactTitle),
    phone: validatePhone(v.phone),
    email: validateEmail(v.email),
    wechat: role === "factory" ? validateRequired(v.wechat) : undefined,
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: v };

  const { error } = await ctx.supabase.from("company_contacts").upsert({
    company_id: ctx.profile.companyId,
    contact_name: isIndividual ? individualName! : v.contactName,
    contact_title: isIndividual ? null : v.contactTitle,
    phone: v.phone,
    email: v.email,
    wechat: role === "factory" ? v.wechat : null,
  });
  if (error) return { status: "error", formError: "saveFailed", values: v };

  await goTo(role, "contacto");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Fábrica · Paso "producción": categorías, capacidad, puerto, web o brochure
// ---------------------------------------------------------------------------
type ProductionField =
  | "categoryIds"
  | "capacity"
  | "departurePort"
  | "website"
  | "foundedYear"
  | "annualCapacityOrSales";

export async function saveFactoryProduction(
  _prev: FormState<ProductionField>,
  formData: FormData,
): Promise<FormState<ProductionField>> {
  const ctx = await editableContext("factory");
  if ("error" in ctx) return { status: "error", formError: ctx.error };
  const companyId = ctx.profile.companyId;
  if (!companyId) return { status: "error", formError: "previousStepMissing" };

  const categoryIds = formData.getAll("categoryIds").filter((x): x is string => typeof x === "string" && !!x);
  const v = {
    capacity: readString(formData, "capacity"),
    departurePort: readString(formData, "departurePort"),
    website: readString(formData, "website"),
    foundedYear: readString(formData, "foundedYear"),
    annualCapacityOrSales: readString(formData, "annualCapacityOrSales"),
  };
  const url = normalizeUrl(v.website);

  const { count: brochures } = await ctx.supabase
    .from("company_documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("kind", "brochure");

  const errors: Record<ProductionField, FieldErrorCode | undefined> = {
    categoryIds: categoryIds.length ? undefined : "selectAtLeastOne",
    capacity: validateRequired(v.capacity),
    departurePort: validateRequired(v.departurePort),
    // Web o brochure: al menos uno.
    website: url.error ?? (!url.value && !brochures ? "webOrBrochure" as FieldErrorCode : undefined),
    foundedYear: validateYear(v.foundedYear),
    annualCapacityOrSales: undefined,
  };
  const values = { ...v, categoryIds: categoryIds.join(",") };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values };

  const { error: detailsError } = await ctx.supabase
    .from("factory_details")
    .update({
      capacity: v.capacity,
      departure_port: v.departurePort,
      website: url.value,
      founded_year: v.foundedYear ? Number(v.foundedYear) : null,
      annual_capacity_or_sales: v.annualCapacityOrSales || null,
    })
    .eq("company_id", companyId);

  // Reemplaza las categorías elegidas.
  const { error: deleteError } = await ctx.supabase
    .from("factory_categories")
    .delete()
    .eq("factory_company_id", companyId);
  const { error: insertError } = await ctx.supabase
    .from("factory_categories")
    .insert(categoryIds.map((category_id) => ({ factory_company_id: companyId, category_id })));

  if (detailsError || deleteError || insertError) return { status: "error", formError: "saveFailed", values };

  await goTo("factory", "produccion");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Documentos: el archivo ya se subió desde el navegador a Storage (RLS por
// carpeta de la empresa); aquí solo se registra.
// ---------------------------------------------------------------------------
const allowedKinds: Record<Party, DocumentKind[]> = {
  buyer: ["tax_registration", "id_document", "other"],
  factory: ["cn_business_license", "brochure", "other"],
};

export async function registerDocument(role: Party, input: { kind: string; storagePath: string; fileName: string; mimeType: string }) {
  const ctx = await editableContext(role);
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  const companyId = ctx.profile.companyId;
  if (!companyId) return { ok: false as const, error: "previousStepMissing" };

  const kind = input.kind as DocumentKind;
  if (!documentKinds.includes(kind) || !allowedKinds[role].includes(kind)) return { ok: false as const, error: "invalidKind" };
  if (!input.storagePath.startsWith(`${companyId}/`) || input.storagePath.includes("..")) {
    return { ok: false as const, error: "invalidPath" };
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(input.mimeType)) return { ok: false as const, error: "invalidType" };

  const { error } = await ctx.supabase.from("company_documents").insert({
    company_id: companyId,
    kind,
    storage_path: input.storagePath,
    file_name: input.fileName.slice(0, 200),
    uploaded_by: ctx.profile.id,
  });
  if (error) return { ok: false as const, error: "saveFailed" };

  if (kind === "brochure") {
    await ctx.supabase.from("factory_details").update({ brochure_path: input.storagePath }).eq("company_id", companyId);
  }
  return { ok: true as const };
}

export async function removeDocument(role: Party, documentId: string) {
  const ctx = await editableContext(role);
  if ("error" in ctx) return { ok: false as const, error: ctx.error };

  const { data: doc } = await ctx.supabase
    .from("company_documents")
    .select("id, kind, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { ok: false as const, error: "notFound" };

  await ctx.supabase.storage.from("company-docs").remove([doc.storage_path]);
  const { error } = await ctx.supabase.from("company_documents").delete().eq("id", doc.id);
  if (error) return { ok: false as const, error: "saveFailed" };

  if (doc.kind === "brochure" && ctx.profile.companyId) {
    const { data: rest } = await ctx.supabase
      .from("company_documents")
      .select("storage_path")
      .eq("company_id", ctx.profile.companyId)
      .eq("kind", "brochure")
      .limit(1);
    await ctx.supabase
      .from("factory_details")
      .update({ brochure_path: rest?.[0]?.storage_path ?? null })
      .eq("company_id", ctx.profile.companyId);
  }
  return { ok: true as const };
}

// Paso de documentos: comprueba lo obligatorio antes de avanzar.
export async function continueAfterDocuments(role: Party): Promise<FormState<"document">> {
  const ctx = await editableContext(role);
  if ("error" in ctx) return { status: "error", formError: ctx.error };
  const companyId = ctx.profile.companyId;
  if (!companyId) return { status: "error", formError: "previousStepMissing" };

  if (role === "buyer") {
    const { data: details } = await ctx.supabase
      .from("buyer_details")
      .select("account_type")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!details) return { status: "error", formError: "previousStepMissing" };
    const kind = details.account_type === "company" ? "tax_registration" : "id_document";
    const { count } = await ctx.supabase
      .from("company_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("kind", kind);
    if (!count) return { status: "error", fieldErrors: { document: "fileRequired" } };
    await goTo("buyer", "documento");
  } else {
    // El registro empresarial chino es opcional al registrarse (se exige al validar como estándar).
    await goTo("factory", "documentos");
  }
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Aceptación de textos legales y envío a revisión
// ---------------------------------------------------------------------------
type SubmitField = "acceptTerms" | "acceptNonCircumvention";

const submitErrorMap: Record<string, string> = {
  "missing:company": "missingDetails",
  "missing:details": "missingDetails",
  "missing:sector": "missingDetails",
  "missing:contact": "missingContact",
  "missing:wechat": "missingContact",
  "missing:document": "missingDocument",
  "missing:production": "missingProduction",
  "missing:categories": "missingProduction",
  "missing:web_or_brochure": "missingProduction",
  "missing:legal": "missingLegal",
  individuals_not_allowed: "individualsNotAllowed",
  not_editable: "notEditable",
};

export async function submitRegistration(
  role: Party,
  _prev: FormState<SubmitField>,
  formData: FormData,
): Promise<FormState<SubmitField>> {
  const ctx = await editableContext(role);
  if ("error" in ctx) return { status: "error", formError: ctx.error };
  if (!ctx.profile.companyId) return { status: "error", formError: "missingDetails" };

  const errors = {
    acceptTerms: formData.get("acceptTerms") === "on" ? undefined : ("mustAccept" as const),
    acceptNonCircumvention: formData.get("acceptNonCircumvention") === "on" ? undefined : ("mustAccept" as const),
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors) };

  // Registra la aceptación de la versión vigente de cada texto (con fecha).
  const { data: docs } = await ctx.supabase.rpc("current_legal_documents");
  const rows = (docs ?? []).map((d) => ({ user_id: ctx.profile.id, legal_document_id: d.id }));
  if (rows.length) {
    const { error } = await ctx.supabase
      .from("legal_acceptances")
      .upsert(rows, { onConflict: "user_id,legal_document_id", ignoreDuplicates: true });
    if (error) return { status: "error", formError: "saveFailed" };
  }

  const { error } = await ctx.supabase.rpc("submit_company_for_review");
  if (error) return { status: "error", formError: submitErrorMap[error.message] ?? "saveFailed" };

  redirect({ href: roleHome[role], locale: await getLocale() });
  return { status: "success" };
}
