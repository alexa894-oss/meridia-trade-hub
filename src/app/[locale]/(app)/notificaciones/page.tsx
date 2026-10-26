import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireProfile } from "@/lib/auth/guard";
import { roleHome, type Role } from "@/lib/auth/roles";
import { listNotifications } from "@/lib/messages/load";
import { formatDate } from "@/components/admin/ui";
import { MarkAllRead } from "@/components/messages/mark-all-read";
import { PageLoading } from "@/components/page-loading";

export const instant = false;

const messagesBase: Record<Role, string> = { buyer: "/comprador/mensajes", factory: "/fabrica/mensajes", admin: "/admin/mensajes" };

function hrefFor(type: string, payload: Record<string, unknown>, role: Role) {
  const rfq = typeof payload.rfq_id === "string" ? payload.rfq_id : null;
  switch (type) {
    case "message":
      return `${messagesBase[role]}/${payload.conversation_id}`;
    case "rfq_assigned":
    case "quote_hidden":
      return rfq ? `/fabrica/oportunidades/${rfq}` : roleHome[role];
    case "rfq_status":
    case "quote_received":
      return rfq ? `/comprador/solicitudes/${rfq}` : roleHome[role];
    case "order_created":
    case "order_status": {
      const base = role === "buyer" ? "/comprador/pedidos" : role === "factory" ? "/fabrica/pedidos" : "/admin/pedidos";
      return `${base}/${payload.order_id}`;
    }
    case "commission_missing":
      return `/admin/empresas/${payload.company_id}`;
    default:
      return roleHome[role];
  }
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NotificationsList />
    </Suspense>
  );
}

async function NotificationsList() {
  const profile = await requireProfile();
  const [t, locale, items] = await Promise.all([getTranslations("Notifications"), getLocale(), listNotifications(profile.id)]);
  const known = ["message", "rfq_assigned", "quote_hidden", "rfq_status", "quote_received", "company_review", "order_created", "order_status", "commission_missing"];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <MarkAllRead hasUnread={items.some((n) => !n.read_at)} />
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>
      {items.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {items.map((n) => {
            const payload = (n.payload ?? {}) as Record<string, unknown>;
            const type = known.includes(n.type) ? n.type : "other";
            return (
              <li key={n.id}>
                <Link href={hrefFor(n.type, payload, profile.role)} className={`flex items-start gap-3 p-4 hover:bg-navy-50 ${n.read_at ? "" : "bg-gold-100/50"}`}>
                  {!n.read_at ? <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-gold-500" /> : <span className="size-2 shrink-0" />}
                  <span className="min-w-0">
                    <span className="block text-ink">
                      {t(`types.${type}`, {
                        number: String(payload.number ?? ""),
                        from: payload.from === "meridia" ? "Meridia" : payload.from === "factory" ? t("theFactory") : t("theBuyer"),
                        status: String(payload.status ?? ""),
                      })}
                    </span>
                    <span className="text-xs text-ink-muted">{formatDate(n.created_at, locale, true)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
