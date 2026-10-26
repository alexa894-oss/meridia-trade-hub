"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { findContactInfo } from "@/lib/contact-detection";
import { readString } from "@/lib/forms";
import { ALLOWED_UPLOAD_TYPES } from "@/lib/registration/steps";
import { createClient } from "@/lib/supabase/server";

const basePath = { buyer: "/comprador/mensajes", factory: "/fabrica/mensajes", admin: "/admin/mensajes" } as const;

// Abre (o recupera) la conversación de una solicitud con una fábrica y va a ella.
export async function openConversation(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const supabase = await createClient();
  const { data } = await supabase.rpc("open_conversation", {
    p_rfq: readString(formData, "rfqId"),
    p_factory: readString(formData, "factoryId"),
  });
  if (!data) return;
  redirect({ href: `${basePath[profile.role]}/${data}`, locale: await getLocale() });
}

type Attachment = { storagePath: string; fileName: string; mimeType: string; size: number };

// Envía un mensaje. Los adjuntos ya se subieron a message-attachments/<conversación>/….
// Teléfonos, correos y WeChat se rechazan aquí y en la base (salvo Meridia).
export async function sendMessage(input: { conversationId: string; body: string; attachments: Attachment[] }) {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "notAllowed" };
  const body = input.body.trim();
  if (!body && !input.attachments.length) return { ok: false as const, error: "empty" };
  if (body.length > 10000) return { ok: false as const, error: "tooLong" };
  if (profile.role !== "admin") {
    const found = findContactInfo(body);
    if (found) return { ok: false as const, error: "contactInfo", found };
  }
  for (const a of input.attachments) {
    if (!a.storagePath.startsWith(`${input.conversationId}/`) || a.storagePath.includes("..") || !ALLOWED_UPLOAD_TYPES.includes(a.mimeType)) {
      return { ok: false as const, error: "invalidAttachment" };
    }
  }

  const supabase = await createClient();
  const { data: message, error } = await supabase
    .from("messages")
    // sender_id y sender_kind los fija la base según la sesión.
    .insert({ conversation_id: input.conversationId, body: body || "📎", sender_id: profile.id, sender_kind: "buyer" })
    .select("id")
    .single();
  if (error || !message) {
    if (error?.message.startsWith("contact_info:")) return { ok: false as const, error: "contactInfo", found: error.message.slice(13) };
    return { ok: false as const, error: "sendFailed" };
  }

  if (input.attachments.length) {
    const { error: attachError } = await supabase.from("message_attachments").insert(
      input.attachments.map((a) => ({
        message_id: message.id,
        storage_path: a.storagePath,
        file_name: a.fileName.slice(0, 200),
        mime_type: a.mimeType,
        size_bytes: a.size,
      })),
    );
    if (attachError) return { ok: false as const, error: "sendFailed" };
  }
  return { ok: true as const, id: message.id };
}

export async function markConversationRead(conversationId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
}

// Adjuntos de un mensaje recibido en tiempo real (enlaces firmados).
export async function getMessageAttachments(messageId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("message_attachments").select("id, file_name, storage_path, mime_type").eq("message_id", messageId);
  return Promise.all(
    (data ?? []).map(async (a) => {
      const { data: signed } = await supabase.storage.from("message-attachments").createSignedUrl(a.storage_path, 600);
      return { id: a.id, fileName: a.file_name, mimeType: a.mime_type, url: signed?.signedUrl ?? null };
    }),
  );
}

export async function markAllNotificationsRead() {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const supabase = await createClient();
  // Filtro explícito por usuario: el administrador tiene acceso a todas las filas.
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", profile.id).is("read_at", null);
}
