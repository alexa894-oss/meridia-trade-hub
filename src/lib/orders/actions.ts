"use server";

import { refresh } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { readString, type FormState } from "@/lib/forms";
import { ALLOWED_UPLOAD_TYPES } from "@/lib/registration/steps";
import { incoterms, type Incoterm } from "@/lib/rfqs/constants";
import { createClient } from "@/lib/supabase/server";

const errorMap: Record<string, string> = {
  below_moq: "belowMoq",
  incoterm_not_quoted: "incotermNotQuoted",
  invalid_quantity: "invalidQuantity",
  quote_expired: "quoteExpired",
  quote_not_available: "quoteNotAvailable",
  rfq_not_open: "rfqNotOpen",
  order_exists: "orderExists",
  commission_not_configured: "commissionNotConfigured",
  reason_required: "reasonRequired",
  documents_required: "documentsRequired",
  invalid_transition: "invalidTransition",
  not_found: "notFound",
  not_admin: "notAllowed",
};
const mapError = (message: string) => errorMap[message] ?? "saveFailed";

async function client(role: "buyer" | "factory" | "admin") {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== role) return null;
  return { profile, supabase: await createClient() };
}

// Comprador: genera la orden desde la cotización elegida (precio de la cotización).
export async function createOrder(_prev: FormState<"incoterm" | "quantity">, formData: FormData): Promise<FormState<"incoterm" | "quantity">> {
  const ctx = await client("buyer");
  if (!ctx) return { status: "error", formError: "notAllowed" };
  const incoterm = readString(formData, "incoterm") as Incoterm;
  const quantityRaw = readString(formData, "quantity").replace(",", ".");
  const quantity = Number(quantityRaw);
  const values = { incoterm, quantity: quantityRaw };
  if (!incoterms.includes(incoterm)) return { status: "error", fieldErrors: { incoterm: "required" }, values };
  if (!quantityRaw) return { status: "error", fieldErrors: { quantity: "required" }, values };
  if (!Number.isFinite(quantity) || quantity <= 0) return { status: "error", fieldErrors: { quantity: "invalidQuantity" }, values };

  const { data, error } = await ctx.supabase.rpc("buyer_create_order", { p_quote: readString(formData, "quoteId"), p_incoterm: incoterm, p_quantity: quantity });
  if (error || !data) return { status: "error", formError: mapError(error?.message ?? ""), values };
  redirect({ href: `/comprador/pedidos/${data}?generada=1`, locale: await getLocale() });
  return { status: "success" };
}

// Fábrica: aceptar, rechazar (con motivo) y avanzar hitos.
export async function factoryOrderAction(_prev: FormState<"reason">, formData: FormData): Promise<FormState<"reason">> {
  const ctx = await client("factory");
  if (!ctx) return { status: "error", formError: "notAllowed" };
  const action = readString(formData, "action");
  const reason = readString(formData, "reason");
  if (action === "reject" && !reason) return { status: "error", fieldErrors: { reason: "required" } };
  const { data, error } = await ctx.supabase.rpc("factory_order_action", { p_order: readString(formData, "orderId"), p_action: action, p_reason: reason || undefined });
  if (error) return { status: "error", formError: mapError(error.message), values: { reason } };
  // Sin comisión configurada la base no lanza error (para no perder el aviso a Meridia): devuelve un código.
  if (data && data !== "ok") return { status: "error", formError: mapError(data), values: { reason } };
  refresh();
  return { status: "success", message: action };
}

export async function confirmReceipt(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await client("buyer");
  if (!ctx) return { status: "error", formError: "notAllowed" };
  const { error } = await ctx.supabase.rpc("buyer_confirm_receipt", { p_order: readString(formData, "orderId") });
  if (error) return { status: "error", formError: mapError(error.message) };
  refresh();
  return { status: "success", message: "delivered" };
}

export async function adminCloseOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await client("admin");
  if (!ctx) return { status: "error", formError: "notAllowed" };
  const { error } = await ctx.supabase.rpc("admin_close_order", { p_order: readString(formData, "orderId"), p_note: readString(formData, "note") || undefined });
  if (error) return { status: "error", formError: mapError(error.message) };
  refresh();
  return { status: "success", message: "closed" };
}

// Documentos de embarque: subidos desde el navegador a shipping-docs/<pedido>/…
export async function registerOrderDocument(input: { orderId: string; kind: string; storagePath: string; fileName: string; mimeType: string }) {
  const ctx = await client("factory");
  if (!ctx) return { ok: false as const };
  if (!["commercial_invoice", "bill_of_lading", "other"].includes(input.kind)) return { ok: false as const };
  if (!input.storagePath.startsWith(`${input.orderId}/`) || input.storagePath.includes("..") || !ALLOWED_UPLOAD_TYPES.includes(input.mimeType)) {
    return { ok: false as const };
  }
  const { error } = await ctx.supabase.from("order_documents").insert({
    order_id: input.orderId,
    kind: input.kind as "commercial_invoice" | "bill_of_lading" | "other",
    storage_path: input.storagePath,
    file_name: input.fileName.slice(0, 200),
    uploaded_by: ctx.profile.id,
  });
  return { ok: !error };
}

export async function removeOrderDocument(documentId: string) {
  const ctx = await client("factory");
  if (!ctx) return { ok: false as const };
  const { data: doc } = await ctx.supabase.from("order_documents").select("id, storage_path").eq("id", documentId).maybeSingle();
  if (!doc) return { ok: false as const };
  const { data, error } = await ctx.supabase.from("order_documents").delete().eq("id", doc.id).select("id");
  if (error || !data?.length) return { ok: false as const };
  await ctx.supabase.storage.from("shipping-docs").remove([doc.storage_path]);
  return { ok: true as const };
}

// Administrador: facturada (con fechas), cobrada (a mano) o vencida.
export async function commissionAction(_prev: FormState<"dueDate">, formData: FormData): Promise<FormState<"dueDate">> {
  const ctx = await client("admin");
  if (!ctx) return { status: "error", formError: "notAllowed" };
  const action = readString(formData, "action");
  const invoicedOn = readString(formData, "invoicedOn");
  const dueDate = readString(formData, "dueDate");
  if (action === "invoice" && dueDate && invoicedOn && dueDate < invoicedOn) return { status: "error", fieldErrors: { dueDate: "endBeforeStart" } };
  const { error } = await ctx.supabase.rpc("admin_commission_action", {
    p_commission: readString(formData, "commissionId"),
    p_action: action,
    p_invoiced_on: invoicedOn || undefined,
    p_due_date: dueDate || undefined,
  });
  if (error) return { status: "error", formError: mapError(error.message) };
  refresh();
  return { status: "success", message: action };
}
