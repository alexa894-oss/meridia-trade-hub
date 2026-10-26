import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { orderMilestones, type loadOrder, type OrderListItem } from "@/lib/orders/load";
import { localized } from "@/lib/registration/load";
import { DataList, formatDate, StatusBadge } from "@/components/admin/ui";
import { money, plainNumber } from "@/components/quotes/format";

type Role = "buyer" | "factory" | "admin";
type Loaded = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

const orderTone: Record<string, string> = {
  sent: "submitted",
  confirmed: "assigned",
  in_production: "assigned",
  ready_to_ship: "assigned",
  shipped: "quoted",
  delivered: "validated",
  closed: "closed",
  rejected: "rejected",
};
export const orderBase: Record<Role, string> = { buyer: "/comprador/pedidos", factory: "/fabrica/pedidos", admin: "/admin/pedidos" };

export async function OrderStatusBadge({ status }: { status: string }) {
  const t = await getTranslations("Orders");
  return <StatusBadge status={orderTone[status] ?? "closed"} label={t(`status.${status}`)} />;
}

export async function counterpartLabel(o: OrderListItem, role: Role) {
  const [t, locale] = await Promise.all([getTranslations("Orders"), getLocale()]);
  if (role === "buyer") return o.factoryName || t("factory");
  if (role === "admin") return `${o.buyerName} → ${o.factoryName}`;
  const sector = o.buyerSector ? localized(o.buyerSector, locale) : null;
  return o.buyerName || [t("buyer"), sector, o.buyerCountry ? countryName(o.buyerCountry, locale) : null].filter(Boolean).join(" · ");
}

export async function OrderList({ orders, role }: { orders: OrderListItem[]; role: Role }) {
  const [t, locale] = await Promise.all([getTranslations("Orders"), getLocale()]);
  if (!orders.length) return <p className="rounded-xl border border-line bg-surface p-6 text-ink-muted">{t(`empty.${role}`)}</p>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {await Promise.all(
        orders.map(async (o) => (
          <li key={o.id}>
            <Link href={`${orderBase[role]}/${o.id}`} className="grid gap-2 p-4 hover:bg-navy-50 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy-800">
                  #{o.rfqs?.number} · {o.rfqs?.product}
                </p>
                <p className="truncate text-sm text-ink-muted">{await counterpartLabel(o, role)}</p>
                <p className="text-sm text-ink">
                  {plainNumber(Number(o.quantity), locale)} × {money(Number(o.unit_price), o.currency, locale)} {o.incoterm} = <strong>{money(Number(o.total_amount), o.currency, locale)}</strong>
                </p>
              </div>
              <span className="justify-self-start sm:justify-self-end">
                <OrderStatusBadge status={o.status} />
              </span>
            </Link>
          </li>
        )),
      )}
    </ul>
  );
}

// Seguimiento por hitos confirmados con fecha. Sin mapas ni movimiento simulado.
export async function OrderTimeline({ data }: { data: Loaded }) {
  const [t, locale] = await Promise.all([getTranslations("Orders"), getLocale()]);
  const rejected = data.order.status === "rejected";
  const steps = rejected ? (["sent", "rejected"] as const) : orderMilestones;
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const reached = data.reached.get(step);
        const last = i === steps.length - 1;
        return (
          <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? <span aria-hidden className={`absolute top-6 left-[11px] h-[calc(100%-1rem)] w-0.5 ${reached ? "bg-gold-500" : "bg-line"}`} /> : null}
            <span
              aria-hidden
              className={`relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                reached ? (step === "rejected" ? "bg-danger text-white" : "bg-navy-800 text-white") : "border-2 border-line bg-surface text-ink-muted"
              }`}
            >
              {reached ? (step === "rejected" ? "×" : "✓") : i + 1}
            </span>
            <div>
              <p className={`font-semibold ${reached ? "text-navy-800" : "text-ink-muted"}`}>{t(`milestones.${step}`)}</p>
              <p className="text-sm text-ink-muted">{reached ? formatDate(reached.at, locale, true) : t("pending")}</p>
              {reached?.note ? <p className="mt-0.5 text-sm whitespace-pre-line text-ink">{reached.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export async function OrderSummary({ data, role }: { data: Loaded; role: Role }) {
  const [t, locale] = await Promise.all([getTranslations("Orders"), getLocale()]);
  const o = data.order;
  const unit = o.rfqs?.units ? localized(o.rfqs.units.names as Record<string, string>, locale) : "";
  const rfqHref = role === "buyer" ? `/comprador/solicitudes/${o.rfq_id}` : role === "factory" ? `/fabrica/oportunidades/${o.rfq_id}` : `/admin/solicitudes/${o.rfq_id}`;
  return (
    <DataList
      items={[
        { label: t(role === "buyer" ? "factory" : role === "factory" ? "buyer" : "parties"), value: await counterpartLabel(o, role) },
        { label: t("request"), value: <Link href={rfqHref} className="text-navy-800 underline">#{o.rfqs?.number} · {o.rfqs?.product}</Link> },
        { label: t("incoterm"), value: o.incoterm },
        { label: t("quantity"), value: `${plainNumber(Number(o.quantity), locale)} ${unit}` },
        { label: t("unitPrice"), value: money(Number(o.unit_price), o.currency, locale) },
        { label: t("total"), value: <strong>{money(Number(o.total_amount), o.currency, locale)}</strong> },
        { label: t("createdAt"), value: formatDate(o.created_at, locale, true) },
        ...(o.rejection_reason ? [{ label: t("rejectionReason"), value: o.rejection_reason }] : []),
      ]}
    />
  );
}

export async function CommissionCard({ commission }: { commission: NonNullable<Loaded["commission"]> }) {
  const [t, locale] = await Promise.all([getTranslations("Orders"), getLocale()]);
  return (
    <DataList
      items={[
        { label: t("commission.status"), value: t(`commissionStatus.${commission.status}`) },
        { label: t("commission.rate"), value: `${Number(commission.rate_pct)} %` },
        { label: t("commission.base"), value: money(Number(commission.base_amount), commission.currency, locale) },
        { label: t("commission.amount"), value: <strong>{money(Number(commission.amount), commission.currency, locale)}</strong> },
        // Fecha de factura: es un día (no una hora), así que se muestra sin zona horaria.
        { label: t("commission.invoicedAt"), value: commission.invoiced_at ? formatDate(`${commission.invoiced_at.slice(0, 10)}T12:00:00Z`, locale) : "—" },
        { label: t("commission.dueDate"), value: commission.due_date ? formatDate(`${commission.due_date}T12:00:00Z`, locale) : "—" },
        { label: t("commission.paidAt"), value: commission.paid_at ? formatDate(commission.paid_at, locale) : "—" },
      ]}
    />
  );
}
