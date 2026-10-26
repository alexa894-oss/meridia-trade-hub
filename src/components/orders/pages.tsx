import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { listCommissions, listOrders, loadOrder, loadQuoteForOrder, type CommissionStatus, type OrderStatus } from "@/lib/orders/load";
import { localized } from "@/lib/registration/load";
import { Card, formatDate, StatusBadge } from "@/components/admin/ui";
import { FormAlert } from "@/components/forms";
import { money } from "@/components/quotes/format";
import { ClosePanel, CommissionPanel, CreateOrderForm, FactoryOrderPanel, OrderDocuments, ReceiptPanel } from "./order-actions";
import { CommissionCard, OrderList, OrderStatusBadge, OrderSummary, OrderTimeline, orderBase } from "./order-view";

type Role = "buyer" | "factory" | "admin";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const orderStatuses: OrderStatus[] = ["sent", "confirmed", "in_production", "ready_to_ship", "shipped", "delivered", "closed", "rejected"];

export async function OrdersListPage({ role, status }: { role: Role; status?: string }) {
  await requireRole(role);
  const filter = (status && orderStatuses.includes(status as OrderStatus) ? status : "all") as OrderStatus | "all";
  const [t, orders] = await Promise.all([getTranslations("Orders"), listOrders(role, filter)]);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>
      {role === "admin" ? (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2">
            {(["all", ...orderStatuses] as const).map((s) => (
              <li key={s} className="shrink-0">
                <Link href={`/admin/pedidos?estado=${s}`} className={`inline-flex min-h-9 items-center rounded-(--radius-control) border px-3 text-sm ${s === filter ? "border-navy-800 bg-navy-800 text-white" : "border-line bg-surface"}`}>
                  {s === "all" ? t("all") : t(`status.${s}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <OrderList orders={orders} role={role} />
    </div>
  );
}

export async function OrderDetailPage({ role, id, generated }: { role: Role; id: string; generated?: boolean }) {
  if (!UUID.test(id)) notFound();
  await requireRole(role);
  const data = await loadOrder(id, role);
  if (!data) notFound();
  const t = await getTranslations("Orders");
  const { order } = data;
  const factoryCanEditDocs = role === "factory" && ["confirmed", "in_production", "ready_to_ship"].includes(order.status);

  return (
    <div className="space-y-5">
      <Link href={orderBase[role]} className="text-sm font-semibold text-navy-800 hover:underline">
        ← {t("back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">
          {t("orderFor", { number: order.rfqs?.number ?? "" })} · {order.rfqs?.product}
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>
      {generated ? <FormAlert tone="success">{t("generated")}</FormAlert> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-5">
          <Card title={t("summary")}>
            <OrderSummary data={data} role={role} />
          </Card>
          <Card title={t("documents")}>
            <OrderDocuments orderId={order.id} documents={data.documents} canEdit={factoryCanEditDocs} />
          </Card>
          {role !== "buyer" && data.commission ? (
            <Card title={t("commission.title")}>
              <CommissionCard commission={data.commission} />
              {role === "admin" ? <CommissionPanel commissionId={data.commission.id} status={data.commission.status} /> : null}
            </Card>
          ) : null}
        </div>
        <div className="space-y-5 lg:sticky lg:top-4">
          <Card title={t("tracking")}>
            <OrderTimeline data={data} />
          </Card>
          {role === "factory" ? (
            <Card title={t("actions")}>
              <FactoryOrderPanel orderId={order.id} status={order.status} />
            </Card>
          ) : null}
          {role === "buyer" && order.status === "shipped" ? (
            <Card title={t("actions")}>
              <ReceiptPanel orderId={order.id} />
            </Card>
          ) : null}
          {role === "admin" && order.status === "delivered" ? (
            <Card title={t("actions")}>
              <ClosePanel orderId={order.id} />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export async function NewOrderPage({ quoteId }: { quoteId: string | undefined }) {
  await requireRole("buyer");
  if (!quoteId || !UUID.test(quoteId)) notFound();
  const data = await loadQuoteForOrder(quoteId);
  if (!data) notFound();
  const [t, locale] = await Promise.all([getTranslations("Orders"), getLocale()]);
  const { quote } = data;
  const rfq = quote.rfqs;
  const unitLabel = rfq?.units ? localized(rfq.units.names as Record<string, string>, locale) : "";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href={`/comprador/solicitudes/${quote.rfq_id}`} className="text-sm font-semibold text-navy-800 hover:underline">
        ← {t("backToRequest")}
      </Link>
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("newTitle")}</h1>
      <p className="text-ink-muted">
        #{rfq?.number} · {rfq?.product} · {data.factoryName}
      </p>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <CreateOrderForm
          quoteId={quote.id}
          prices={quote.quote_prices.map((p) => ({ incoterm: p.incoterm, unitPrice: Number(p.unit_price) }))}
          currency={quote.currency ?? ""}
          moq={quote.moq !== null ? Number(quote.moq) : null}
          defaultQuantity={rfq?.quantity !== null && rfq?.quantity !== undefined ? String(rfq.quantity) : ""}
          unitLabel={unitLabel}
        />
      </section>
    </div>
  );
}

const commissionStatuses: CommissionStatus[] = ["registered", "invoiced", "overdue", "paid"];

// Vista de comisiones: el administrador ve todas; la fábrica, las suyas (RLS).
export async function CommissionsPage({ role, status }: { role: "factory" | "admin"; status?: string }) {
  await requireRole(role);
  const filter = (status && commissionStatuses.includes(status as CommissionStatus) ? status : "all") as CommissionStatus | "all";
  const [t, locale, rows] = await Promise.all([getTranslations("Orders"), getLocale(), listCommissions(filter)]);
  const base = role === "admin" ? "/admin/comisiones" : "/fabrica/comisiones";
  const tone: Record<string, string> = { registered: "submitted", invoiced: "assigned", paid: "validated", overdue: "rejected" };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("commission.pageTitle")}</h1>
        <p className="mt-1 text-ink-muted">{t(`commission.intro.${role}`)}</p>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          {(["all", ...commissionStatuses] as const).map((s) => (
            <li key={s} className="shrink-0">
              <Link href={`${base}?estado=${s}`} className={`inline-flex min-h-9 items-center rounded-(--radius-control) border px-3 text-sm ${s === filter ? "border-navy-800 bg-navy-800 text-white" : "border-line bg-surface"}`}>
                {s === "all" ? t("all") : t(`commissionStatus.${s}`)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-muted">{t("commission.empty")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`${orderBase[role]}/${c.order_id}`} className="grid gap-2 p-4 hover:bg-navy-50 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-800">
                    #{c.orders?.rfqs?.number} · {c.orders?.rfqs?.product}
                    {role === "admin" && c.companies?.factory_details ? ` · ${c.companies.factory_details.legal_name_en}` : ""}
                  </p>
                  <p className="text-sm text-ink">
                    {Number(c.rate_pct)} % × {money(Number(c.base_amount), c.currency, locale)} = <strong>{money(Number(c.amount), c.currency, locale)}</strong>
                  </p>
                  <p className="text-xs text-ink-muted">
                    {t("commission.registeredAt", { date: formatDate(c.created_at, locale) })}
                    {c.due_date ? ` · ${t("commission.dueOn", { date: formatDate(`${c.due_date}T12:00:00Z`, locale) })}` : ""}
                  </p>
                </div>
                <span className="justify-self-start sm:justify-self-end">
                  <StatusBadge status={tone[c.status]} label={t(`commissionStatus.${c.status}`)} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
