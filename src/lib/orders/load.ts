import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type CommissionStatus = Database["public"]["Enums"]["commission_status"];

// Hitos del seguimiento, en orden. "Rechazado" es un final aparte.
export const orderMilestones: OrderStatus[] = ["sent", "confirmed", "in_production", "ready_to_ship", "shipped", "delivered", "closed"];

const ORDER_FIELDS =
  "id, status, incoterm, quantity, unit_price, currency, total_amount, rejection_reason, received_confirmed_at, created_at, quote_id, rfq_id, buyer_company_id, factory_company_id, rfqs(number, product, units(names))";

// Nombres de la otra parte sin exponer datos de contacto: el comprador ve la
// fábrica (perfil público del comparador); la fábrica ve sector y país del comprador.
async function counterpartNames(rows: { rfq_id: string; factory_company_id: string }[], role: "buyer" | "factory" | "admin") {
  const supabase = await createClient();
  const names = new Map<string, { factory: string | null; buyer: string | null; buyerCountry: string | null; buyerSector: Record<string, string> | null }>();
  for (const rfqId of new Set(rows.map((r) => r.rfq_id))) {
    if (role === "buyer") {
      const { data } = await supabase.rpc("get_rfq_factory_profiles", { p_rfq: rfqId });
      for (const f of data ?? []) names.set(`${rfqId}:${f.company_id}`, { factory: f.legal_name_en, buyer: null, buyerCountry: null, buyerSector: null });
    } else {
      const { data } = await supabase.rpc("get_rfq_buyer_profile", { p_rfq: rfqId });
      const b = data?.[0];
      for (const r of rows.filter((x) => x.rfq_id === rfqId)) {
        names.set(`${rfqId}:${r.factory_company_id}`, {
          factory: null,
          buyer: b?.display_name ?? null,
          buyerCountry: b?.country ?? null,
          buyerSector: (b?.sector_names as Record<string, string> | null) ?? null,
        });
      }
    }
  }
  return names;
}

export async function listOrders(role: "buyer" | "factory" | "admin", status?: OrderStatus | "all") {
  const supabase = await createClient();
  let query = supabase.from("orders").select(ORDER_FIELDS).order("created_at", { ascending: false });
  if (status && status !== "all") query = query.eq("status", status);
  const { data } = await query.limit(200);
  const rows = data ?? [];

  if (role === "admin") {
    const ids = [...new Set(rows.flatMap((r) => [r.buyer_company_id, r.factory_company_id]))];
    const { data: companies } = ids.length
      ? await supabase.from("companies").select("id, buyer_details(legal_name, full_name), factory_details(legal_name_en)").in("id", ids)
      : { data: [] };
    const byId = new Map((companies ?? []).map((c) => [c.id, c.factory_details?.legal_name_en ?? c.buyer_details?.legal_name ?? c.buyer_details?.full_name ?? ""]));
    return rows.map((r) => ({ ...r, factoryName: byId.get(r.factory_company_id) ?? "", buyerName: byId.get(r.buyer_company_id) ?? "", buyerCountry: null, buyerSector: null }));
  }

  const names = await counterpartNames(rows, role);
  return rows.map((r) => {
    const n = names.get(`${r.rfq_id}:${r.factory_company_id}`);
    return { ...r, factoryName: n?.factory ?? "", buyerName: n?.buyer ?? "", buyerCountry: n?.buyerCountry ?? null, buyerSector: n?.buyerSector ?? null };
  });
}

export type OrderListItem = Awaited<ReturnType<typeof listOrders>>[number];

export async function loadOrder(id: string, role: "buyer" | "factory" | "admin") {
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select(ORDER_FIELDS).eq("id", id).maybeSingle();
  if (!order) return null;

  await supabase.rpc("mark_overdue_commissions");
  const [docs, history, commission, list] = await Promise.all([
    supabase.from("order_documents").select("id, kind, file_name, storage_path, created_at").eq("order_id", id).order("created_at"),
    supabase.from("status_history").select("to_status, note, created_at").eq("entity_type", "order").eq("entity_id", id).order("created_at"),
    // El comprador nunca ve la comisión (RLS): para él la consulta devuelve vacío.
    role === "buyer" ? Promise.resolve({ data: null }) : supabase.from("commissions").select("*").eq("order_id", id).maybeSingle(),
    listOrders(role).then((all) => all.find((o) => o.id === id) ?? null),
  ]);

  const documents = await Promise.all(
    (docs.data ?? []).map(async (d) => {
      const { data } = await supabase.storage.from("shipping-docs").createSignedUrl(d.storage_path, 600);
      return { id: d.id, kind: d.kind, fileName: d.file_name, createdAt: d.created_at, url: data?.signedUrl ?? null };
    }),
  );
  const reached = new Map<string, { at: string; note: string | null }>();
  for (const h of history.data ?? []) reached.set(h.to_status, { at: h.created_at, note: h.note });

  return { order: list ?? { ...order, factoryName: "", buyerName: "", buyerCountry: null, buyerSector: null }, documents, reached, commission: commission.data };
}

// Para generar una orden: la cotización elegida con sus precios.
export async function loadQuoteForOrder(quoteId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("id, status, currency, moq, valid_until, rfq_id, factory_company_id, quote_prices(incoterm, unit_price), rfqs(number, product, quantity, status, units(names))")
    .eq("id", quoteId)
    .maybeSingle();
  if (!data) return null;
  const { data: profiles } = await supabase.rpc("get_rfq_factory_profiles", { p_rfq: data.rfq_id });
  return { quote: data, factoryName: profiles?.find((p) => p.company_id === data.factory_company_id)?.legal_name_en ?? "" };
}

export async function listCommissions(status: CommissionStatus | "all") {
  const supabase = await createClient();
  await supabase.rpc("mark_overdue_commissions");
  let query = supabase
    .from("commissions")
    .select("*, orders(id, rfq_id, total_amount, rfqs(number, product)), companies!commissions_factory_company_id_fkey(factory_details(legal_name_en))")
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  const { data } = await query.limit(300);
  return data ?? [];
}
