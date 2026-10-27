"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentProfile, type CurrentProfile } from "@/lib/auth/session";
import { compact, hasErrors, normalizeUrl, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_UPLOAD_TYPES,
  applicantDocumentKinds,
  companyTypes,
  idTypes,
  nextStepPath,
  REQUEST_BASE,
  type DocumentKind,
  type RegistrationStep,
} from "./steps";
import {
  contactFields,
  detailsFields,
  profileFields,
  readFields,
  validateContact,
  validateDetails,
  validateProfile,
  type ContactField,
  type DetailsField,
  type ProfileField,
} from "./validate";

// Sesión de solicitante + solicitud editable. Cada acción se autoriza sola.
async function editableContext() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") return { error: "notAllowed" as const };
  const supabase = await createClient();

  if (profile.companyId) {
    const { data } = await supabase.from("companies").select("status").eq("id", profile.companyId).maybeSingle();
    if (!data || !["registered", "info_requested"].includes(data.status)) return { error: "notEditable" as const };
  }
  return { profile, supabase };
}

type Ctx = { profile: CurrentProfile; supabase: Awaited<ReturnType<typeof createClient>> };

async function goTo(step: RegistrationStep) {
  redirect({ href: nextStepPath(step), locale: await getLocale() });
}

async function ensureCompany(ctx: Ctx, country: string) {
  if (ctx.profile.companyId) return ctx.profile.companyId;
  const { data, error } = await ctx.supabase.rpc("register_company", { p_country: country });
  if (error || !data) throw new Error("register_company failed");
  return data;
}

async function currentAccountType(ctx: Ctx) {
  if (!ctx.profile.companyId) return null;
  const { data } = await ctx.supabase
    .from("buyer_details")
    .select("account_type")
    .eq("company_id", ctx.profile.companyId)
    .maybeSingle();
  return data?.account_type ?? null;
}

// ---------------------------------------------------------------------------
// Paso 1 · Empresa: información empresarial · Persona natural: datos personales
// ---------------------------------------------------------------------------
export async function saveBuyerDetails(_prev: FormState<DetailsField>, formData: FormData): Promise<FormState<DetailsField>> {
  const ctx = await editableContext();
  if ("error" in ctx) return { status: "error", formError: ctx.error };

  const v = readFields(formData, detailsFields);
  const { data: settings } = await ctx.supabase.rpc("get_public_settings");
  const allowIndividual = (settings as Record<string, unknown> | null)?.allow_individual_buyers !== false;
  const isCompany = v.accountType === "company";
  const url = normalizeUrl(v.website);
  const errors = validateDetails(v, allowIndividual);
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
    trade_name: isCompany ? v.tradeName : null,
    tax_id: isCompany ? v.taxId : null,
    website: isCompany ? url.value : null,
    economic_activity: v.economicActivity,
    full_name: isCompany ? null : v.fullName,
    id_type: isCompany ? null : (v.idType as (typeof idTypes)[number]),
    id_number: isCompany ? null : v.idNumber,
    // Un cambio de tipo deja sin efecto la confirmación de representación.
    ...(isCompany ? {} : { representative_authorized: false, company_type: null }),
  });
  if (companyError || detailsError) return { status: "error", formError: "saveFailed", values: v };

  await goTo("datos");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Paso 2 · Representante y contacto (privado: solo lo ve Meridia)
// ---------------------------------------------------------------------------
export async function saveContact(_prev: FormState<ContactField>, formData: FormData): Promise<FormState<ContactField>> {
  const ctx = await editableContext();
  if ("error" in ctx) return { status: "error", formError: ctx.error };
  const companyId = ctx.profile.companyId;
  const accountType = await currentAccountType(ctx);
  if (!companyId || !accountType) return { status: "error", formError: "previousStepMissing" };
  const isCompany = accountType === "company";

  const v = readFields(formData, contactFields);
  v.email = v.email.toLowerCase();
  const errors = validateContact(v, isCompany);
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: v };

  // Persona natural: el contacto es la propia persona.
  let name = v.contactName;
  if (!isCompany) {
    const { data } = await ctx.supabase.from("buyer_details").select("full_name").eq("company_id", companyId).maybeSingle();
    name = data?.full_name ?? ctx.profile.fullName ?? "";
  }

  const { error: contactError } = await ctx.supabase.from("company_contacts").upsert({
    company_id: companyId,
    contact_name: name,
    contact_title: isCompany ? v.contactTitle : null,
    email: v.email,
    phone: v.phone,
    whatsapp: v.whatsapp,
    country: isCompany ? v.contactCountry : null,
    city: isCompany ? v.city : null,
  });
  const { error: detailsError } = isCompany
    ? await ctx.supabase.from("buyer_details").update({ representative_authorized: true }).eq("company_id", companyId)
    : { error: null };
  if (contactError || detailsError) return { status: "error", formError: "saveFailed", values: v };

  await goTo("contacto");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Paso 3 · Perfil de compra
// ---------------------------------------------------------------------------
export async function saveBuyerProfile(_prev: FormState<ProfileField>, formData: FormData): Promise<FormState<ProfileField>> {
  const ctx = await editableContext();
  if ("error" in ctx) return { status: "error", formError: ctx.error };
  const companyId = ctx.profile.companyId;
  const accountType = await currentAccountType(ctx);
  if (!companyId || !accountType) return { status: "error", formError: "previousStepMissing" };
  const isCompany = accountType === "company";

  const v = readFields(formData, profileFields);
  const categoryIds = v.categoryIds.split(",").filter(Boolean);
  const errors = validateProfile(v, isCompany);
  const values = v;
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values };

  const { error: detailsError } = await ctx.supabase
    .from("buyer_details")
    .update({
      company_type: isCompany ? (v.companyType as (typeof companyTypes)[number]) : null,
      destination_country: v.destinationCountry,
      purchase_volume: v.purchaseVolume,
      purchase_frequency_id: v.purchaseFrequencyId || null,
      purchase_purpose: isCompany ? null : v.purchasePurpose,
      project_description: v.needsDescription || null,
      other_products: v.otherProducts || null,
    })
    .eq("company_id", companyId);

  // Reemplaza las categorías de interés.
  const { error: deleteError } = await ctx.supabase.from("buyer_categories").delete().eq("buyer_company_id", companyId);
  const { error: insertError } = await ctx.supabase
    .from("buyer_categories")
    .insert(categoryIds.map((category_id) => ({ buyer_company_id: companyId, category_id })));
  if (detailsError || deleteError || insertError) return { status: "error", formError: "saveFailed", values };

  await goTo("perfil");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Documentos: el archivo ya se subió desde el navegador a Storage (RLS por
// carpeta de la empresa); aquí solo se registra.
// ---------------------------------------------------------------------------
// Los documentos se pueden subir también con la solicitud ya enviada (desde el seguimiento).
async function documentsContext() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer" || !profile.companyId) return { error: "notAllowed" as const };
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("status").eq("id", profile.companyId).maybeSingle();
  if (!data || !["registered", "info_requested", "in_review", "reviewing"].includes(data.status)) return { error: "notEditable" as const };
  return { profile, supabase };
}

export async function registerDocument(input: { kind: string; storagePath: string; fileName: string; mimeType: string }) {
  const ctx = await documentsContext();
  if ("error" in ctx) return { ok: false as const, error: ctx.error };
  const companyId = ctx.profile.companyId;
  if (!companyId) return { ok: false as const, error: "previousStepMissing" };

  const kind = input.kind as DocumentKind;
  if (!applicantDocumentKinds.includes(kind)) return { ok: false as const, error: "invalidKind" };
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
  return error ? { ok: false as const, error: "saveFailed" } : { ok: true as const };
}

export async function removeDocument(documentId: string) {
  const ctx = await documentsContext();
  if ("error" in ctx) return { ok: false as const, error: ctx.error };

  const { data: doc } = await ctx.supabase.from("company_documents").select("id, storage_path").eq("id", documentId).maybeSingle();
  if (!doc) return { ok: false as const, error: "notFound" };

  await ctx.supabase.storage.from("company-docs").remove([doc.storage_path]);
  const { error } = await ctx.supabase.from("company_documents").delete().eq("id", doc.id);
  return error ? { ok: false as const, error: "saveFailed" } : { ok: true as const };
}

// ---------------------------------------------------------------------------
// Paso 4 · Aceptación de textos legales y envío de la solicitud
// ---------------------------------------------------------------------------
type SubmitField = "acceptTerms" | "acceptPrivacy" | "acceptNonCircumvention";

const submitErrorMap: Record<string, string> = {
  "missing:company": "missingDetails",
  "missing:details": "missingDetails",
  "missing:contact": "missingContact",
  "missing:profile": "missingProfile",
  "missing:legal": "missingLegal",
  individuals_not_allowed: "individualsNotAllowed",
  not_editable: "notEditable",
  not_allowed: "notAllowed",
};

export async function submitRegistration(_prev: FormState<SubmitField>, formData: FormData): Promise<FormState<SubmitField>> {
  const ctx = await editableContext();
  if ("error" in ctx) return { status: "error", formError: ctx.error };
  if (!ctx.profile.companyId) return { status: "error", formError: "missingDetails" };

  // Solo se exige lo que existe como texto vigente.
  const { data: docs } = await ctx.supabase.rpc("current_legal_documents");
  const kinds = new Set((docs ?? []).map((d) => d.kind));
  const accepted = (name: string) => formData.get(name) === "on";
  const errors = {
    acceptTerms: kinds.has("terms") && !accepted("acceptTerms") ? ("mustAccept" as const) : undefined,
    acceptPrivacy: kinds.has("privacy") && !accepted("acceptPrivacy") ? ("mustAccept" as const) : undefined,
    acceptNonCircumvention:
      kinds.has("non_circumvention") && !accepted("acceptNonCircumvention") ? ("mustAccept" as const) : undefined,
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors) };

  // Registra la aceptación de la versión vigente de cada texto (con fecha).
  const rows = (docs ?? []).map((d) => ({ user_id: ctx.profile.id, legal_document_id: d.id }));
  if (rows.length) {
    const { error } = await ctx.supabase
      .from("legal_acceptances")
      .upsert(rows, { onConflict: "user_id,legal_document_id", ignoreDuplicates: true });
    if (error) return { status: "error", formError: "saveFailed" };
  }

  const { error } = await ctx.supabase.rpc("submit_company_for_review");
  if (error) return { status: "error", formError: submitErrorMap[error.message] ?? "saveFailed" };

  redirect({ href: `${REQUEST_BASE}?enviada=1`, locale: await getLocale() });
  return { status: "success" };
}
