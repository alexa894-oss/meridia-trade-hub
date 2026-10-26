"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { findContactInfo } from "@/lib/contact-detection";
import { getMessageAttachments, markConversationRead, sendMessage } from "@/lib/messages/actions";
import type { ThreadMessage } from "@/lib/messages/load";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/registration/steps";

type PendingFile = { file: File; id: string };

// Conversación en tiempo real (Supabase Realtime respeta RLS) con adjuntos y
// aviso antes de enviar si el texto parece un teléfono, correo o WeChat.
export function ChatThread({
  conversationId,
  meId,
  isAdmin,
  labels,
  initialMessages,
}: {
  conversationId: string;
  meId: string;
  isAdmin: boolean;
  labels: { buyer: string; factory: string; meridia: string };
  initialMessages: ThreadMessage[];
}) {
  const t = useTranslations("Messages");
  const locale = useLocale();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const contactFound = isAdmin ? null : findContactInfo(body);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const row = payload.new as { id: string; body: string; sender_id: string; sender_kind: ThreadMessage["senderKind"]; created_at: string };
          if (messages.some((m) => m.id === row.id)) return;
          const attachments = await getMessageAttachments(row.id);
          setMessages((current) =>
            current.some((m) => m.id === row.id)
              ? current
              : [...current, { id: row.id, body: row.body, senderId: row.sender_id, senderKind: row.sender_kind, createdAt: row.created_at, attachments }],
          );
          if (row.sender_id !== meId) markConversationRead(conversationId);
          // Los adjuntos se guardan justo después del mensaje: se vuelven a leer en un momento.
          if (!attachments.length) {
            setTimeout(async () => {
              const later = await getMessageAttachments(row.id);
              if (later.length) setMessages((current) => current.map((m) => (m.id === row.id ? { ...m, attachments: later } : m)));
            }, 1500);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suscripción única por conversación
  }, [conversationId, meId, supabase]);

  function addFiles(list: FileList | null) {
    setError(null);
    // Copia ya: FileList es "viva" y se vacía al limpiar el campo.
    const picked = Array.from(list ?? []);
    for (const file of picked) {
      if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return setError(t("errors.invalidType"));
      if (file.size > MAX_UPLOAD_BYTES) return setError(t("errors.tooLarge"));
    }
    const added = picked.map((file) => ({ file, id: crypto.randomUUID() }));
    setFiles((current) => [...current, ...added].slice(0, 5));
  }

  function send() {
    if (contactFound || pending) return;
    startTransition(async () => {
      setError(null);
      const uploaded = [];
      for (const { file, id } of files) {
        const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${conversationId}/${id}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("message-attachments").upload(path, file, { contentType: file.type });
        if (uploadError) return setError(t("errors.uploadFailed"));
        uploaded.push({ storagePath: path, fileName: file.name, mimeType: file.type, size: file.size });
      }
      const result = await sendMessage({ conversationId, body, attachments: uploaded });
      if (!result.ok) {
        if (uploaded.length) await supabase.storage.from("message-attachments").remove(uploaded.map((u) => u.storagePath));
        return setError(result.error === "contactInfo" ? t("errors.contactInfo", { found: result.found ?? "" }) : t(`errors.${result.error}`));
      }
      setBody("");
      setFiles([]);
      // El mensaje propio llega también por tiempo real; si tarda, se agrega aquí.
      // El aviso en tiempo real puede llegar antes de que se guarden los adjuntos: se vuelven a leer.
      const attachments = uploaded.length ? await getMessageAttachments(result.id) : [];
      setMessages((current) =>
        current.some((m) => m.id === result.id)
          ? current.map((m) => (m.id === result.id ? { ...m, attachments } : m))
          : [...current, { id: result.id, body: body.trim() || "📎", senderId: meId, senderKind: isAdmin ? "meridia" : "buyer", createdAt: new Date().toISOString(), attachments }],
      );
    });
  }

  const time = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "America/Panama" });

  return (
    <div className="flex min-h-[60vh] flex-col rounded-2xl border border-line bg-surface">
      <ol className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5" aria-live="polite">
        {messages.length === 0 ? <li className="text-center text-sm text-ink-muted">{t("empty")}</li> : null}
        {messages.map((m) => {
          const mine = m.senderId === meId;
          const meridia = m.senderKind === "meridia";
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-[70%] ${
                  meridia ? "border border-gold-300 bg-gold-100" : mine ? "bg-navy-800 text-white" : "bg-navy-50"
                }`}
              >
                <p className={`text-xs font-semibold ${mine && !meridia ? "text-navy-100" : meridia ? "text-gold-700" : "text-navy-800"}`}>
                  {mine && !meridia ? t("you") : labels[m.senderKind]}
                </p>
                {m.body !== "📎" ? <p className="mt-0.5 whitespace-pre-line break-words">{m.body}</p> : null}
                {m.attachments.length ? (
                  <ul className="mt-2 space-y-1">
                    {m.attachments.map((a) => (
                      <li key={a.id}>
                        {a.url ? (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className={`text-sm underline ${mine && !meridia ? "text-white" : "text-navy-800"}`}>
                            📎 {a.fileName}
                          </a>
                        ) : (
                          <span className="text-sm">📎 {a.fileName}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className={`mt-1 text-[11px] ${mine && !meridia ? "text-navy-100" : "text-ink-muted"}`}>{time.format(new Date(m.createdAt))}</p>
              </div>
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ol>

      <div className="border-t border-line p-3 sm:p-4">
        {contactFound ? (
          <p role="alert" className="mb-2 rounded-(--radius-control) border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {t("errors.contactInfo", { found: contactFound })}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mb-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {files.length ? (
          <ul className="mb-2 flex flex-wrap gap-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1 text-sm">
                📎 <span className="max-w-40 truncate">{f.file.name}</span>
                <button type="button" onClick={() => setFiles((c) => c.filter((x) => x.id !== f.id))} className="text-danger" aria-label={t("removeFile")}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2"
        >
          <input ref={fileRef} type="file" multiple accept={ALLOWED_UPLOAD_TYPES.join(",")} className="sr-only" tabIndex={-1} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex size-12 shrink-0 items-center justify-center rounded-(--radius-control) border border-line text-lg hover:bg-navy-50" aria-label={t("attach")}>
            📎
          </button>
          <label htmlFor="message-body" className="sr-only">
            {t("placeholder")}
          </label>
          <textarea
            id="message-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={isAdmin ? t("placeholderMeridia") : t("placeholder")}
            aria-invalid={contactFound ? true : undefined}
            className={`max-h-40 min-h-12 flex-1 resize-y rounded-(--radius-control) border bg-surface px-3.5 py-3 text-base outline-none focus:border-navy-800 ${contactFound ? "border-danger" : "border-line"}`}
          />
          <button
            type="submit"
            disabled={pending || !!contactFound || (!body.trim() && !files.length)}
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-(--radius-control) bg-navy-800 px-5 font-display font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
          >
            {pending ? t("sending") : t("send")}
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">{isAdmin ? t("hintMeridia") : t("hint")}</p>
      </div>
    </div>
  );
}
