"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { isCountryCode } from "@/lib/countries";
import {
  compact,
  hasErrors,
  normalizeUrl,
  readString,
  validateEmail,
  validatePhone,
  validateRequired,
  type FieldErrorCode,
  type FormState,
} from "@/lib/forms";
import { ALLOWED_UPLOAD_TYPES, type DocumentKind } from "@/lib/registration/steps";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

// Red de fabricantes: solo el administrador da de alta, edita, verifica e invita.
async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return { profile, supabase: await createClient() };
}

const optionalPhone = (v: string): FieldErrorCode | undefined => (v ? validatePhone(v) : undefined);

// ---------------------------------------------------------------------------
// Alta y edición de la ficha del fabricante
// ---------------------------------------------------------------------------
const factoryFields = [
  "legalName",
  "tradeName",
  "legalNameLocal",
  "country",
  "city",
  "address",
  "registrationNumber",
  "website",
  "contactName",
  "contactTitle",
  "email",
  "phone",
  "whatsapp",
  "wechat",
  "categoryIds",
  "products",
  "capacity",
  "moq",
  "departurePort",
  "exportMarkets",
  "certifications",
  "commercialTerms",
  "notes",
] as const;
type FactoryField = (typeof factoryFields)[number];

export async function saveFactory(_prev: FormState<FactoryField>, formData: FormData): Promise<FormState<FactoryField>> {
  const ctx = await admin();
  if (!ctx) return { status: "error", formError: "notAllowed" };
  const companyId = readString(formData, "companyId");
  const categoryIds = formData.getAll("categoryIds").filter((x): x is string => typeof x === "string" && !!x);
  const v = Object.fromEntries(factoryFields.map((f) => [f, f === "categoryIds" ? categoryIds.join(",") : readString(formData, f)])) as Record<
    FactoryField,
    string
  >;
  v.email = v.email.toLowerCase();
  const url = normalizeUrl(v.website);

  const errors: Record<FactoryField, FieldErrorCode | undefined> = {
    legalName: validateRequired(v.legalName),
    tradeName: undefined,
    legalNameLocal: undefined,
    country: !v.country ? "required" : isCountryCode(v.country) ? undefined : "invalidChoice",
    city: undefined,
    address: undefined,
    registrationNumber: undefined,
    website: url.error,
    contactName: validateRequired(v.contactName),
    contactTitle: undefined,
    email: validateEmail(v.email),
    phone: optionalPhone(v.phone),
    whatsapp: optionalPhone(v.whatsapp),
    wechat: undefined,
    categoryIds: categoryIds.length ? undefined : "selectAtLeastOne",
    products: validateRequired(v.products),
    capacity: undefined,
    moq: undefined,
    departurePort: undefined,
    exportMarkets: undefined,
    certifications: undefined,
    commercialTerms: undefined,
    notes: undefined,
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: v };

  const { supabase, profile } = ctx;
  const orNull = (x: string) => x || null;
  let id = companyId;
  if (!id) {
    const { data, error } = await supabase
      .from("companies")
      .insert({ kind: "factory", status: "registered", country: v.country })
      .select("id")
      .single();
    if (error || !data) return { status: "error", formError: "saveFailed", values: v };
    id = data.id;
  } else {
    const { error } = await supabase.from("companies").update({ country: v.country }).eq("id", id).eq("kind", "factory");
    if (error) return { status: "error", formError: "saveFailed", values: v };
  }

  const results = await Promise.all([
    supabase.from("factory_details").upsert({
      company_id: id,
      legal_name_en: v.legalName,
      trade_name: orNull(v.tradeName),
      legal_name_zh: orNull(v.legalNameLocal),
      city: orNull(v.city),
      address: orNull(v.address),
      registration_number: orNull(v.registrationNumber),
      website: url.value,
      products: v.products,
      capacity: orNull(v.capacity),
      moq: orNull(v.moq),
      departure_port: orNull(v.departurePort),
      export_markets: orNull(v.exportMarkets),
      certifications: orNull(v.certifications),
      commercial_terms: orNull(v.commercialTerms),
    }),
    supabase.from("company_contacts").upsert({
      company_id: id,
      contact_name: v.contactName,
      contact_title: orNull(v.contactTitle),
      email: v.email,
      phone: orNull(v.phone),
      whatsapp: orNull(v.whatsapp),
      wechat: orNull(v.wechat),
      country: v.country,
      city: orNull(v.city),
    }),
    supabase.from("factory_admin").upsert({ company_id: id, updated_by: profile.id }, { onConflict: "company_id", ignoreDuplicates: true }),
  ]);
  if (results.some((r) => r.error)) return { status: "error", formError: "saveFailed", values: v };

  const { error: deleteError } = await supabase.from("factory_categories").delete().eq("factory_company_id", id);
  const { error: insertError } = await supabase
    .from("factory_categories")
    .insert(categoryIds.map((category_id) => ({ factory_company_id: id, category_id })));
  if (deleteError || insertError) return { status: "error", formError: "saveFailed", values: v };

  if (!companyId && v.notes) {
    await supabase.from("company_notes").insert({ company_id: id, body: v.notes.slice(0, 5000), author_id: profile.id });
  }

  if (!companyId) redirect({ href: `/admin/fabricantes/${id}?creada=1`, locale: await getLocale() });
  refresh();
  return { status: "success", message: "saved" };
}

// ---------------------------------------------------------------------------
// Tres verificaciones independientes (quién y cuándo)
// ---------------------------------------------------------------------------
export async function saveVerifications(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { status: "error", formError: "notAllowed" };
  const companyId = readString(formData, "companyId");
  const { data: current } = await ctx.supabase.from("factory_admin").select("*").eq("company_id", companyId).maybeSingle();
  const now = new Date().toISOString();
  type AdminRow = Database["public"]["Tables"]["factory_admin"]["Insert"];
  const update: AdminRow = { company_id: companyId, updated_by: ctx.profile.id };
  for (const key of ["identity", "capacity", "history"] as const) {
    const on = formData.get(key) === "on";
    const was = !!current?.[`${key}_verified`];
    Object.assign(update, { [`${key}_verified`]: on });
    if (on !== was) {
      Object.assign(update, { [`${key}_verified_at`]: on ? now : null, [`${key}_verified_by`]: on ? ctx.profile.id : null });
    }
  }
  const { error } = await ctx.supabase.from("factory_admin").upsert(update);
  if (error) return { status: "error", formError: "saveFailed" };
  refresh();
  return { status: "success", message: "verificationsSaved" };
}

// ---------------------------------------------------------------------------
// Invitación privada: el enlace se muestra una vez; se guarda solo su hash.
// ---------------------------------------------------------------------------
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function createInvitation(_prev: FormState<"email">, formData: FormData): Promise<FormState<"email">> {
  const ctx = await admin();
  if (!ctx) return { status: "error", formError: "notAllowed" };
  const companyId = readString(formData, "companyId");
  const email = readString(formData, "email").toLowerCase();
  const errors = { email: validateEmail(email) };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: { email } };

  // Una invitación vigente por fábrica: la anterior queda sin efecto.
  await ctx.supabase
    .from("factory_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const { error } = await ctx.supabase
    .from("factory_invitations")
    .insert({ company_id: companyId, email, token_hash: tokenHash, created_by: ctx.profile.id });
  if (error) return { status: "error", formError: "saveFailed", values: { email } };
  refresh();
  return { status: "success", message: `${await siteOrigin()}/invitacion/${token}`, values: { email } };
}

export async function revokeInvitation(formData: FormData) {
  const ctx = await admin();
  if (!ctx) return;
  await ctx.supabase
    .from("factory_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", readString(formData, "invitationId"))
    .is("accepted_at", null);
  refresh();
}

// ---------------------------------------------------------------------------
// Documentación de respaldo (la sube Meridia a la carpeta privada de la fábrica)
// ---------------------------------------------------------------------------
const factoryDocumentKinds: DocumentKind[] = ["cn_business_license", "brochure", "other"];

export async function registerFactoryDocument(input: { kind: string; storagePath: string; fileName: string; mimeType: string }) {
  const ctx = await admin();
  if (!ctx) return { ok: false as const, error: "notAllowed" };
  const companyId = input.storagePath.split("/")[0];
  const { data: company } = await ctx.supabase.from("companies").select("id").eq("id", companyId).eq("kind", "factory").maybeSingle();
  const kind = input.kind as DocumentKind;
  if (!company || !factoryDocumentKinds.includes(kind) || input.storagePath.includes("..") || !ALLOWED_UPLOAD_TYPES.includes(input.mimeType)) {
    return { ok: false as const, error: "invalid" };
  }
  const { error } = await ctx.supabase.from("company_documents").insert({
    company_id: companyId,
    kind,
    storage_path: input.storagePath,
    file_name: input.fileName.slice(0, 200),
    uploaded_by: ctx.profile.id,
  });
  return error ? { ok: false as const, error: "saveFailed" } : { ok: true as const };
}

export async function removeFactoryDocument(documentId: string) {
  const ctx = await admin();
  if (!ctx) return { ok: false as const, error: "notAllowed" };
  const { data: doc } = await ctx.supabase.from("company_documents").select("id, storage_path").eq("id", documentId).maybeSingle();
  if (!doc) return { ok: false as const, error: "notFound" };
  await ctx.supabase.storage.from("company-docs").remove([doc.storage_path]);
  const { error } = await ctx.supabase.from("company_documents").delete().eq("id", doc.id);
  return error ? { ok: false as const, error: "saveFailed" } : { ok: true as const };
}
