import type { ReactNode } from "react";

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="font-display text-lg font-semibold text-navy-800">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const statusTone: Record<string, string> = {
  validated: "bg-success/10 text-success",
  in_review: "bg-gold-100 text-gold-700",
  info_requested: "bg-gold-100 text-gold-700",
  registered: "bg-navy-50 text-ink-muted",
  rejected: "bg-danger/10 text-danger",
  suspended: "bg-danger/10 text-danger",
  // Solicitudes
  draft: "bg-navy-50 text-ink-muted",
  submitted: "bg-gold-100 text-gold-700",
  assigned: "bg-navy-100 text-navy-800",
  quoted: "bg-success/10 text-success",
  negotiating: "bg-success/10 text-success",
  order_created: "bg-success/10 text-success",
  no_response: "bg-danger/10 text-danger",
  closed: "bg-navy-50 text-ink-muted",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${statusTone[status] ?? "bg-navy-50"}`}>
      {label}
    </span>
  );
}

export function DataList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-sm text-ink-muted">{item.label}</dt>
          <dd className="mt-0.5 font-medium break-words">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function formatDate(value: string | null, locale: string, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "America/Panama",
  }).format(new Date(value));
}
