import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ConversationSummary = Awaited<ReturnType<typeof listConversations>>[number];

export async function listConversations() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_my_conversations");
  return data ?? [];
}

export type ThreadMessage = {
  id: string;
  body: string;
  senderId: string;
  senderKind: "buyer" | "factory" | "meridia";
  createdAt: string;
  attachments: { id: string; fileName: string; mimeType: string | null; url: string | null }[];
};

// Conversación + mensajes (RLS: solo participantes y Meridia). Al abrirla queda leída.
export async function loadConversation(id: string) {
  const supabase = await createClient();
  const { data: header } = await supabase.rpc("list_my_conversations", { p_conversation: id });
  if (!header?.length) return null;

  const { data: rows } = await supabase
    .from("messages")
    .select("id, body, sender_id, sender_kind, created_at, message_attachments(id, file_name, storage_path, mime_type)")
    .eq("conversation_id", id)
    .order("created_at");

  const messages: ThreadMessage[] = await Promise.all(
    (rows ?? []).map(async (m) => ({
      id: m.id,
      body: m.body,
      senderId: m.sender_id,
      senderKind: m.sender_kind,
      createdAt: m.created_at,
      attachments: await Promise.all(
        m.message_attachments.map(async (a) => {
          const { data } = await supabase.storage.from("message-attachments").createSignedUrl(a.storage_path, 600);
          return { id: a.id, fileName: a.file_name, mimeType: a.mime_type, url: data?.signedUrl ?? null };
        }),
      ),
    })),
  );

  await supabase.rpc("mark_conversation_read", { p_conversation: id });
  return { conversation: header[0], messages };
}

export async function unreadNotificationCount(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}

export async function listNotifications(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, payload, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
