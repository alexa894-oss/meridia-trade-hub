"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Field, FormAlert, SelectField, TextareaField, useFieldError } from "@/components/forms";
import { initialFormState } from "@/lib/forms";
import { adminCloseOrder, commissionAction, confirmReceipt, createOrder, factoryOrderAction, registerOrderDocument, removeOrderDocument } from "@/lib/orders/actions";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/registration/steps";

function Button({ children, tone = "primary", name, value }: { children: string; tone?: "primary" | "neutral" | "danger"; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  const cls = {
    primary: "bg-navy-800 text-white hover:bg-navy-900",
    neutral: "border border-navy-800 text-navy-800 hover:bg-navy-50",
    danger: "border border-danger text-danger hover:bg-danger/5",
  }[tone];
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`inline-flex min-h-11 items-center justify-center rounded-(--radius-control) px-4 text-sm font-semibold disabled:opacity-60 ${cls}`}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Comprador: generar la orden desde la cotización elegida
// ---------------------------------------------------------------------------
export function CreateOrderForm({
  quoteId,
  prices,
  currency,
  moq,
  defaultQuantity,
  unitLabel,
}: {
  quoteId: string;
  prices: { incoterm: string; unitPrice: number }[];
  currency: string;
  moq: number | null;
  defaultQuantity: string;
  unitLabel: string;
}) {
  const t = useTranslations("Orders");
  const locale = useLocale();
  const fieldError = useFieldError();
  const [state, action] = useActionState(createOrder, initialFormState);
  const [incoterm, setIncoterm] = useState(state.values?.incoterm ?? (prices.length === 1 ? prices[0].incoterm : ""));
  const [quantity, setQuantity] = useState(state.values?.quantity ?? defaultQuantity);
  const price = prices.find((p) => p.incoterm === incoterm)?.unitPrice;
  const qty = Number(quantity.replace(",", "."));
  const total = price !== undefined && Number.isFinite(qty) && qty > 0 ? qty * price : null;
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n);
    } catch {
      return `${n} ${currency}`;
    }
  };

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="quoteId" value={quoteId} />
      {state.formError ? <FormAlert>{t(`errors.${state.formError}`, { moq: moq ?? 0 })}</FormAlert> : null}
      <SelectField
        name="incoterm"
        label={t("incoterm")}
        placeholder={t("chooseIncoterm")}
        value={incoterm}
        onChange={(e) => setIncoterm(e.target.value)}
        options={prices.map((p) => ({ value: p.incoterm, label: `${p.incoterm} · ${fmt(p.unitPrice)}` }))}
        error={fieldError(state.fieldErrors?.incoterm, t("incoterm"))}
      />
      <Field
        name="quantity"
        inputMode="decimal"
        label={`${t("quantity")} (${unitLabel})`}
        hint={moq ? t("moqHint", { moq }) : undefined}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        error={state.fieldErrors?.quantity === "invalidQuantity" ? t("errors.invalidQuantity") : fieldError(state.fieldErrors?.quantity, t("quantity"))}
      />
      <p className="rounded-(--radius-control) bg-navy-50 px-4 py-3 text-ink">
        {t("total")}: <strong>{total !== null ? fmt(total) : "—"}</strong>
      </p>
      <p className="text-sm text-ink-muted">{t("createHint")}</p>
      <Button>{t("create")}</Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Fábrica: aceptar / rechazar / avanzar hitos
// ---------------------------------------------------------------------------
const nextStep: Record<string, string> = { confirmed: "in_production", in_production: "ready_to_ship", ready_to_ship: "shipped" };

export function FactoryOrderPanel({ orderId, status }: { orderId: string; status: string }) {
  const t = useTranslations("Orders");
  const fieldError = useFieldError();
  const [state, action] = useActionState(factoryOrderAction, initialFormState);
  const next = nextStep[status];

  if (status !== "sent" && !next) return <p className="text-sm text-ink-muted">{t(`factoryHelp.${status}`)}</p>;

  return (
    <form action={action} noValidate className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {state.status === "success" && state.message ? <FormAlert tone="success">{t(`done.${state.message}`)}</FormAlert> : null}
      {state.formError ? <FormAlert>{t(`errors.${state.formError}`, { moq: 0 })}</FormAlert> : null}
      {status === "sent" ? (
        <>
          <p className="text-sm text-ink">{t("acceptHelp")}</p>
          <TextareaField name="reason" rows={2} label={t("rejectReason")} hint={t("rejectReasonHint")} defaultValue={state.values?.reason ?? ""} error={fieldError(state.fieldErrors?.reason, t("rejectReason"))} />
          <div className="flex flex-wrap gap-2">
            <Button name="action" value="accept">
              {t("accept")}
            </Button>
            <Button name="action" value="reject" tone="danger">
              {t("reject")}
            </Button>
          </div>
        </>
      ) : (
        <>
          {next === "shipped" ? <p className="text-sm text-ink-muted">{t("shippedNeedsDocs")}</p> : null}
          <Button name="action" value={next}>
            {t(`advance.${next}`)}
          </Button>
        </>
      )}
    </form>
  );
}

export function ReceiptPanel({ orderId }: { orderId: string }) {
  const t = useTranslations("Orders");
  const [state, action] = useActionState(confirmReceipt, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {state.formError ? <FormAlert>{t(`errors.${state.formError}`, { moq: 0 })}</FormAlert> : null}
      <p className="text-sm text-ink">{t("receiptHelp")}</p>
      <Button>{t("confirmReceipt")}</Button>
    </form>
  );
}

export function ClosePanel({ orderId }: { orderId: string }) {
  const t = useTranslations("Orders");
  const [state, action] = useActionState(adminCloseOrder, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {state.formError ? <FormAlert>{t(`errors.${state.formError}`, { moq: 0 })}</FormAlert> : null}
      <Field name="note" label={`${t("closeNote")} · ${t("optional")}`} />
      <Button>{t("close")}</Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Administrador: estado de la comisión (el cobro se marca a mano)
// ---------------------------------------------------------------------------
export function CommissionPanel({ commissionId, status }: { commissionId: string; status: string }) {
  const t = useTranslations("Orders");
  const fieldError = useFieldError();
  const [state, action] = useActionState(commissionAction, initialFormState);
  if (status === "paid") return null;
  return (
    <form action={action} noValidate className="mt-4 space-y-3 border-t border-line pt-4">
      <input type="hidden" name="commissionId" value={commissionId} />
      {state.status === "success" ? <FormAlert tone="success">{t("commission.saved")}</FormAlert> : null}
      {state.formError ? <FormAlert>{t(`errors.${state.formError}`, { moq: 0 })}</FormAlert> : null}
      {status === "registered" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="invoicedOn" type="date" label={t("commission.invoicedAt")} />
            <Field name="dueDate" type="date" label={`${t("commission.dueDate")} · ${t("optional")}`} error={fieldError(state.fieldErrors?.dueDate, t("commission.dueDate"))} />
          </div>
          <Button name="action" value="invoice">
            {t("commission.markInvoiced")}
          </Button>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button name="action" value="paid">
            {t("commission.markPaid")}
          </Button>
          {status === "invoiced" ? (
            <Button name="action" value="overdue" tone="danger">
              {t("commission.markOverdue")}
            </Button>
          ) : null}
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Documentos de embarque (la fábrica sube factura comercial y BL)
// ---------------------------------------------------------------------------
export function OrderDocuments({
  orderId,
  documents,
  canEdit,
}: {
  orderId: string;
  documents: { id: string; kind: string; fileName: string | null; url: string | null }[];
  canEdit: boolean;
}) {
  const t = useTranslations("Orders");
  const tu = useTranslations("Registration.upload");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("commercial_invoice");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setMessage(null);
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return setMessage(tu("invalidType"));
    if (file.size > MAX_UPLOAD_BYTES) return setMessage(tu("tooLarge"));
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${orderId}/${kind}-${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("shipping-docs").upload(path, file, { contentType: file.type });
    if (error) return setMessage(tu("failed"));
    const result = await registerOrderDocument({ orderId, kind, storagePath: path, fileName: file.name, mimeType: file.type });
    if (!result.ok) {
      await supabase.storage.from("shipping-docs").remove([path]);
      return setMessage(tu("failed"));
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {documents.length ? (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) border border-line px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block font-semibold text-navy-800">{t(`documentKinds.${d.kind}`)}</span>
                <span className="block truncate text-ink-muted">{d.fileName}</span>
              </span>
              <span className="flex gap-3">
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-800 underline">
                    {t("open")}
                  </a>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(async () => { const r = await removeOrderDocument(d.id); if (!r.ok) setMessage(tu("failed")); router.refresh(); })}
                    className="font-semibold text-danger hover:underline"
                  >
                    {tu("remove")}
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">{t("noDocuments")}</p>
      )}
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <SelectField
            label={t("documentKind")}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            options={["commercial_invoice", "bill_of_lading", "other"].map((k) => ({ value: k, label: t(`documentKinds.${k}`) }))}
            className="min-w-56"
          />
          <input ref={inputRef} type="file" accept={ALLOWED_UPLOAD_TYPES.join(",")} className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) startTransition(() => upload(f)); }} />
          <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="inline-flex min-h-12 items-center rounded-(--radius-control) border border-dashed border-navy-600 px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50 disabled:opacity-60">
            {pending ? tu("uploading") : tu("choose")}
          </button>
        </div>
      ) : null}
      {message ? <p role="alert" className="text-sm text-danger">{message}</p> : null}
    </div>
  );
}
