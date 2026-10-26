"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { removeRfqReferenceFile, setRfqReferenceFile } from "@/lib/rfqs/actions";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/registration/steps";

// Imagen o PDF de referencia: rfq-attachments/<rfq_id>/… (privado; lo ven
// el comprador, las fábricas asignadas y Meridia).
export function RfqReferenceUpload({
  rfqId,
  fileName,
  onChange,
}: {
  rfqId: string;
  fileName: string | null;
  onChange: (hasFile: boolean) => void;
}) {
  const t = useTranslations("Registration.upload");
  const tr = useTranslations("Rfq");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(fileName);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setMessage(null);
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return setMessage(t("invalidType"));
    if (file.size > MAX_UPLOAD_BYTES) return setMessage(t("tooLarge"));
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${rfqId}/reference-${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("rfq-attachments").upload(path, file, { contentType: file.type });
    if (error) return setMessage(t("failed"));
    const result = await setRfqReferenceFile({ rfqId, storagePath: path, mimeType: file.type });
    if (!result.ok) {
      await supabase.storage.from("rfq-attachments").remove([path]);
      return setMessage(t("failed"));
    }
    setCurrent(file.name);
    onChange(true);
    router.refresh();
  }

  return (
    <div>
      <p className="text-sm font-medium text-ink">{tr("fields.referenceFile")}</p>
      {current ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-(--radius-control) border border-line bg-surface-muted px-3 py-2">
          <span className="min-w-0 truncate text-sm">{current}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await removeRfqReferenceFile(rfqId);
                if (!r.ok) return setMessage(t("failed"));
                setCurrent(null);
                onChange(false);
                router.refresh();
              })
            }
            className="shrink-0 text-sm font-semibold text-danger hover:underline disabled:opacity-60"
          >
            {t("remove")}
          </button>
        </div>
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
        className="mt-2 inline-flex min-h-11 items-center rounded-(--radius-control) border border-dashed border-navy-600 px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50 disabled:opacity-60"
      >
        {pending ? t("uploading") : current ? tr("replaceFile") : t("choose")}
      </button>
      <p className="mt-1.5 text-xs text-ink-muted">{t("formats")}</p>
      {message ? (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
