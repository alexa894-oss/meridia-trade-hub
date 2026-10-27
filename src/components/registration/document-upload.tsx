"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { registerDocument, removeDocument } from "@/lib/registration/actions";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, type DocumentKind } from "@/lib/registration/steps";

type Doc = { id: string; fileName: string | null };
type Result = { ok: true } | { ok: false; error?: string };
type Register = (input: { kind: string; storagePath: string; fileName: string; mimeType: string }) => Promise<Result>;

// Sube el archivo directo al bucket privado (carpeta de la empresa, RLS) y
// luego lo registra en company_documents desde el servidor.
export function DocumentUpload({
  companyId,
  kind,
  label,
  hint,
  documents,
  error,
  required,
  onRegister = registerDocument,
  onRemove = removeDocument,
}: {
  companyId: string;
  kind: DocumentKind;
  label: string;
  hint?: string;
  documents: Doc[];
  error?: string;
  required?: boolean;
  /** Acciones de servidor para registrar/quitar (por defecto, las del solicitante). */
  onRegister?: Register;
  onRemove?: (documentId: string) => Promise<Result>;
}) {
  const t = useTranslations("Registration.upload");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shownError = message ?? error;

  async function upload(file: File) {
    setMessage(null);
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return setMessage(t("invalidType"));
    if (file.size > MAX_UPLOAD_BYTES) return setMessage(t("tooLarge"));

    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${companyId}/${kind}-${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("company-docs")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return setMessage(t("failed"));

    const result = await onRegister({ kind, storagePath: path, fileName: file.name, mimeType: file.type });
    if (!result.ok) {
      await supabase.storage.from("company-docs").remove([path]);
      return setMessage(t("failed"));
    }
    router.refresh();
  }

  return (
    <div>
      <p className="text-sm font-medium text-ink">
        {label}
        {required ? null : <span className="font-normal text-ink-muted"> · {t("optional")}</span>}
      </p>
      {hint ? <p className="mt-0.5 text-sm text-ink-muted">{hint}</p> : null}

      {documents.length ? (
        <ul className="mt-2 space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-(--radius-control) border border-line bg-surface-muted px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm">{doc.fileName ?? t("file")}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await onRemove(doc.id);
                    if (!r.ok) setMessage(t("failed"));
                    router.refresh();
                  })
                }
                className="shrink-0 text-sm font-semibold text-danger hover:underline disabled:opacity-60"
              >
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_UPLOAD_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) startTransition(() => upload(file));
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className={`mt-2 inline-flex min-h-11 items-center rounded-(--radius-control) border border-dashed px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50 disabled:opacity-60 ${
          shownError ? "border-danger" : "border-navy-600"
        }`}
      >
        {pending ? t("uploading") : documents.length ? t("addAnother") : t("choose")}
      </button>
      <p className="mt-1.5 text-xs text-ink-muted">{t("formats")}</p>
      {shownError ? (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
