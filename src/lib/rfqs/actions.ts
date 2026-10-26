"use server";

import { refresh } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { findContactInfo } from "@/lib/contact-detection";
import { isCountryCode } from "@/lib/countries";
import { compact, hasErrors, normalizeUrl, readString, validateRequired, type FieldErrorCode, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_UPLOAD_TYPES } from "@/lib/registration/steps";
import { incoterms, shippingModes, type Incoterm, type ShippingMode } from "./constants";

export type RfqField =
  | "product"
  | "categoryId"
  | "description"
  | "quantity"
  | "unitId"
  | "destinationCountry"
  | "technicalSpecs"
  | "deadline"
  | "reference"
  | "incoterms"
  | "destinationPort"
  | "shippingModes";

const TEXT_FIELDS = ["product", "description", "technicalSpecs", "destinationPort"] as const;

const submitErrorMap: Record<string, string> = {
  company_not_validated: "companyNotValidated",
  deadline_past: "deadlinePast",
  not_editable: "notEditable",
  not_found: "notFound",
  "missing:technical_specs": "missingFields",
  "missing:reference": "missingFields",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Guarda la solicitud (nueva o borrador) y, si intent = submit, la envía a Meridia.
// En borrador solo se exige el producto; al enviar se exige todo menos la modalidad de carga.
export async function saveRfq(_prev: FormState<RfqField>, formData: FormData): Promise<FormState<RfqField>> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer" || !profile.companyId) return { status: "error", formError: "notAllowed" };
  const supabase = await createClient();

  const id = readString(formData, "id");
  const submit = readString(formData, "intent") === "submit";
  const v = {
    product: readString(formData, "product"),
    categoryId: readString(formData, "categoryId"),
    description: readString(formData, "description"),
    quantity: readString(formData, "quantity").replace(",", "."),
    unitId: readString(formData, "unitId"),
    destinationCountry: readString(formData, "destinationCountry"),
    technicalSpecs: readString(formData, "technicalSpecs"),
    deadline: readString(formData, "deadline"),
    referenceUrl: readString(formData, "referenceUrl"),
    destinationPort: readString(formData, "destinationPort"),
  };
  const selectedIncoterms = formData.getAll("incoterms").filter((x): x is Incoterm => incoterms.includes(x as Incoterm));
  const selectedModes = formData.getAll("shippingModes").filter((x): x is ShippingMode => shippingModes.includes(x as ShippingMode));
  const hasFile = readString(formData, "hasReferenceFile") === "1";
  const url = normalizeUrl(v.referenceUrl);
  const quantity = v.quantity ? Number(v.quantity) : null;

  const required = (value: string) => (submit ? validateRequired(value) : undefined);
  const errors: Record<RfqField, FieldErrorCode | undefined> = {
    product: validateRequired(v.product),
    categoryId: required(v.categoryId),
    description: required(v.description),
    quantity: v.quantity ? (Number.isFinite(quantity) && quantity! > 0 ? undefined : "invalidQuantity") : required(v.quantity),
    unitId: required(v.unitId),
    destinationCountry: v.destinationCountry ? (isCountryCode(v.destinationCountry) ? undefined : "invalidChoice") : required(v.destinationCountry),
    technicalSpecs: required(v.technicalSpecs),
    deadline: v.deadline ? (v.deadline > today() ? undefined : "deadlineFuture") : required(v.deadline),
    reference: url.error ?? (submit && !url.value && !hasFile ? "referenceRequired" : undefined),
    incoterms: submit && selectedIncoterms.length === 0 ? "selectAtLeastOne" : undefined,
    destinationPort: selectedIncoterms.includes("CIF") && !v.destinationPort ? "portRequiredForCif" : undefined,
    shippingModes: undefined,
  };
  // Nunca datos de contacto en lo que verá la fábrica.
  for (const field of TEXT_FIELDS) {
    if (!errors[field] && findContactInfo(v[field])) errors[field] = "contactInfo";
  }

  const values: Partial<Record<RfqField | "referenceUrl", string>> = {
    ...v,
    incoterms: selectedIncoterms.join(","),
    shippingModes: selectedModes.join(","),
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values };

  const row = {
    product: v.product,
    category_id: v.categoryId || null,
    description: v.description || null,
    quantity,
    unit_id: v.unitId || null,
    destination_country: v.destinationCountry || null,
    technical_specs: v.technicalSpecs || null,
    deadline: v.deadline || null,
    reference_url: url.value,
    accepts_alternatives: formData.get("acceptsAlternatives") === "on",
    needs_sample: formData.get("needsSample") === "on",
    incoterms: selectedIncoterms,
    destination_port: v.destinationPort || null,
    shipping_modes: selectedModes,
  };

  let rfqId = id;
  if (rfqId) {
    const { data, error } = await supabase.from("rfqs").update(row).eq("id", rfqId).select("id");
    if (error || !data?.length) return { status: "error", formError: "notEditable", values };
  } else {
    const { data, error } = await supabase
      .from("rfqs")
      .insert({ ...row, buyer_company_id: profile.companyId, created_by: profile.id })
      .select("id")
      .single();
    if (error || !data) return { status: "error", formError: "saveFailed", values };
    rfqId = data.id;
  }

  if (submit) {
    const { error } = await supabase.rpc("submit_rfq", { p_rfq: rfqId });
    if (error) {
      const contact = error.message.startsWith("contact_info:");
      const formError = contact ? "contactInfo" : (submitErrorMap[error.message] ?? (error.code === "23514" ? "missingFields" : "saveFailed"));
      // El borrador quedó guardado: se muestra el error en su página.
      if (!id) redirect({ href: `/comprador/solicitudes/${rfqId}?error=${formError}`, locale: await getLocale() });
      return { status: "error", formError, values };
    }
  }

  redirect({ href: `/comprador/solicitudes/${rfqId}${submit ? "?enviada=1" : "?guardada=1"}`, locale: await getLocale() });
  return { status: "success" };
}

export async function deleteRfqDraft(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") return;
  const supabase = await createClient();
  const id = readString(formData, "id");
  const { data: rfq } = await supabase.from("rfqs").select("reference_image_path").eq("id", id).eq("status", "draft").maybeSingle();
  if (rfq?.reference_image_path) await supabase.storage.from("rfq-attachments").remove([rfq.reference_image_path]);
  await supabase.from("rfqs").delete().eq("id", id).eq("status", "draft");
  redirect({ href: "/comprador/solicitudes", locale: await getLocale() });
}

// Archivo de referencia: se sube desde el navegador a rfq-attachments/<rfq_id>/…
export async function setRfqReferenceFile(input: { rfqId: string; storagePath: string; mimeType: string }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") return { ok: false as const };
  if (!input.storagePath.startsWith(`${input.rfqId}/`) || input.storagePath.includes("..")) return { ok: false as const };
  if (!ALLOWED_UPLOAD_TYPES.includes(input.mimeType)) return { ok: false as const };
  const supabase = await createClient();

  const { data: current } = await supabase.from("rfqs").select("reference_image_path").eq("id", input.rfqId).maybeSingle();
  const { data, error } = await supabase
    .from("rfqs")
    .update({ reference_image_path: input.storagePath })
    .eq("id", input.rfqId)
    .select("id");
  if (error || !data?.length) return { ok: false as const };
  if (current?.reference_image_path && current.reference_image_path !== input.storagePath) {
    await supabase.storage.from("rfq-attachments").remove([current.reference_image_path]);
  }
  return { ok: true as const };
}

export async function removeRfqReferenceFile(rfqId: string) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") return { ok: false as const };
  const supabase = await createClient();
  const { data: rfq } = await supabase.from("rfqs").select("reference_image_path").eq("id", rfqId).maybeSingle();
  if (!rfq?.reference_image_path) return { ok: true as const };
  await supabase.storage.from("rfq-attachments").remove([rfq.reference_image_path]);
  const { error } = await supabase.from("rfqs").update({ reference_image_path: null }).eq("id", rfqId);
  return { ok: !error };
}

// ---------------------------------------------------------------------------
// Administrador
// ---------------------------------------------------------------------------
const adminErrorMap: Record<string, string> = {
  message_required: "messageRequired",
  invalid_transition: "invalidTransition",
  factories_required: "factoriesRequired",
  has_quote: "hasQuote",
  not_found: "notFound",
  not_admin: "notAllowed",
};

async function adminClient() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return createClient();
}

export async function adminRfqAction(_prev: FormState<"message">, formData: FormData): Promise<FormState<"message">> {
  const supabase = await adminClient();
  if (!supabase) return { status: "error", formError: "notAllowed" };
  const message = readString(formData, "message");
  const action = readString(formData, "action");
  if (!message) return { status: "error", fieldErrors: { message: "required" }, values: { message } };
  const { error } = await supabase.rpc("admin_rfq_action", { p_rfq: readString(formData, "rfqId"), p_action: action, p_message: message });
  if (error) return { status: "error", formError: adminErrorMap[error.message] ?? "saveFailed", values: { message } };
  refresh();
  return { status: "success", message: action === "close" ? "closed" : "infoRequested" };
}

export async function assignFactories(_prev: FormState<"factories">, formData: FormData): Promise<FormState<"factories">> {
  const supabase = await adminClient();
  if (!supabase) return { status: "error", formError: "notAllowed" };
  const factories = formData.getAll("factoryIds").filter((x): x is string => typeof x === "string" && !!x);
  if (!factories.length) return { status: "error", fieldErrors: { factories: "selectAtLeastOne" } };
  const { data, error } = await supabase.rpc("admin_assign_rfq", { p_rfq: readString(formData, "rfqId"), p_factories: factories });
  if (error) return { status: "error", formError: adminErrorMap[error.message] ?? "saveFailed" };
  refresh();
  return { status: "success", message: String(data ?? 0) };
}

export async function unassignFactory(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) return;
  await supabase.rpc("admin_unassign_rfq", {
    p_rfq: readString(formData, "rfqId"),
    p_factory: readString(formData, "factoryId"),
  });
  refresh();
}
