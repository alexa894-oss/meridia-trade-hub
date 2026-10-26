import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import type { Role } from "@/lib/auth/roles";
import { countryName } from "@/lib/countries";
import { listConversations, loadConversation, type ConversationSummary } from "@/lib/messages/load";
import { localized } from "@/lib/registration/load";
import { formatDate } from "@/components/admin/ui";
import { ChatThread } from "./chat-thread";

const base: Record<Role, string> = { buyer: "/comprador/mensajes", factory: "/fabrica/mensajes", admin: "/admin/mensajes" };
const rfqPath: Record<Role, string> = { buyer: "/comprador/solicitudes", factory: "/fabrica/oportunidades", admin: "/admin/solicitudes" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cómo se nombra a cada parte según quién mira. La fábrica ve al comprador por
// sector y país salvo que el administrador habilite su nombre.
async function partyLabels(c: ConversationSummary, role: Role) {
  const [t, locale] = await Promise.all([getTranslations("Messages"), getLocale()]);
  const sector = c.buyer_sector ? localized(c.buyer_sector as Record<string, string>, locale) : null;
  const anonymousBuyer = [t("buyer"), sector, c.buyer_country ? countryName(c.buyer_country, locale) : null].filter(Boolean).join(" · ");
  return {
    buyer: c.buyer_name ?? anonymousBuyer,
    factory: c.factory_name ?? t("factory"),
    meridia: "Meridia",
    counterpart: role === "buyer" ? (c.factory_name ?? t("factory")) : role === "factory" ? (c.buyer_name ?? anonymousBuyer) : `${c.buyer_name ?? anonymousBuyer} ↔ ${c.factory_name ?? t("factory")}`,
  };
}

export async function ConversationListPage({ role }: { role: Role }) {
  await requireRole(role);
  const [t, locale, conversations] = await Promise.all([getTranslations("Messages"), getLocale(), listConversations()]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>
      {conversations.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-ink-muted">{t(`emptyList.${role}`)}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {await Promise.all(
            conversations.map(async (c) => {
              const labels = await partyLabels(c, role);
              return (
                <li key={c.id}>
                  <Link href={`${base[role]}/${c.id}`} className="grid gap-1 p-4 hover:bg-navy-50 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy-800">{labels.counterpart}</p>
                      <p className="truncate text-sm text-ink-muted">
                        #{c.rfq_number} · {c.rfq_product}
                      </p>
                      <p className="truncate text-sm text-ink">
                        {c.last_message ? `${c.last_sender ? `${c.last_sender === "meridia" ? "Meridia" : labels[c.last_sender]}: ` : ""}${c.last_message}` : t("noMessages")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                      {c.last_message_at ? <span className="text-xs text-ink-muted">{formatDate(c.last_message_at, locale, true)}</span> : null}
                      {c.unread ? <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-bold text-navy-900">{t("unread", { count: c.unread })}</span> : null}
                    </div>
                  </Link>
                </li>
              );
            }),
          )}
        </ul>
      )}
    </div>
  );
}

export async function ConversationPage({ role, id }: { role: Role; id: string }) {
  if (!UUID.test(id)) notFound();
  const profile = await requireRole(role);
  const data = await loadConversation(id);
  if (!data) notFound();
  const t = await getTranslations("Messages");
  const { conversation, messages } = data;
  const labels = await partyLabels(conversation, role);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={base[role]} className="text-sm font-semibold text-navy-800 hover:underline">
        ← {t("back")}
      </Link>
      <div>
        <h1 className="font-display text-xl font-bold text-navy-800 sm:text-2xl">{labels.counterpart}</h1>
        <Link href={`${rfqPath[role]}/${conversation.rfq_id}`} className="text-sm text-navy-800 underline">
          #{conversation.rfq_number} · {conversation.rfq_product}
        </Link>
        <p className="mt-1 text-xs text-ink-muted">{t(`participants.${role}`)}</p>
      </div>
      <ChatThread
        conversationId={conversation.id}
        meId={profile.id}
        isAdmin={role === "admin"}
        labels={{ buyer: labels.buyer, factory: labels.factory, meridia: labels.meridia }}
        initialMessages={messages}
      />
    </div>
  );
}
