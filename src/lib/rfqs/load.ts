import "server-only";
import { createClient } from "@/lib/supabase/server";

import { type RfqStatus } from "./constants";

export * from "./constants";

const RFQ_FIELDS =
  "id, number, status, product, description, quantity, technical_specs, deadline, destination_country, destination_port, reference_image_path, reference_url, accepts_alternatives, needs_sample, incoterms, shipping_modes, category_id, unit_id, created_at, submitted_at, buyer_company_id, categories(names), units(names)";

export type RfqRecord = Awaited<ReturnType<typeof fetchRfq>>;

async function fetchRfq(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("rfqs").select(RFQ_FIELDS).eq("id", id).maybeSingle();
  return data;
}

// Enlace firmado para la imagen o archivo de referencia (bucket privado).
async function referenceFileUrl(path: string | null) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("rfq-attachments").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

// Última nota del administrador (pedir información o cierre), desde el historial.
async function latestNote(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("status_history")
    .select("note, to_status, created_at")
    .eq("entity_type", "rfq")
    .eq("entity_id", id)
    .not("note", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

export async function loadRfqOptions() {
  const supabase = await createClient();
  const [categories, units] = await Promise.all([
    supabase.from("categories").select("id, names").order("sort_order"),
    supabase.from("units").select("id, names").order("sort_order"),
  ]);
  return {
    categories: (categories.data ?? []).map((c) => ({ id: c.id, names: c.names as Record<string, string> })),
    units: (units.data ?? []).map((u) => ({ id: u.id, names: u.names as Record<string, string> })),
  };
}

// ---------------------------------------------------------------------------
// Comprador
// ---------------------------------------------------------------------------
export async function listBuyerRfqs() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rfqs")
    .select("id, number, status, product, quantity, deadline, created_at, submitted_at, units(names)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function loadBuyerRfq(id: string) {
  const rfq = await fetchRfq(id);
  if (!rfq) return null;
  const [imageUrl, note] = await Promise.all([referenceFileUrl(rfq.reference_image_path), latestNote(id)]);
  return { rfq, imageUrl, note };
}

// ---------------------------------------------------------------------------
// Fábrica: solo lo asignado (RLS); del comprador, solo sector y país.
// ---------------------------------------------------------------------------
export async function listOpportunities() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rfq_assignments")
    .select("assigned_at, rfqs(id, number, status, product, quantity, deadline, destination_country, units(names), categories(names))")
    .order("assigned_at", { ascending: false });
  return (data ?? []).filter((a) => a.rfqs);
}

export async function loadOpportunity(id: string) {
  const rfq = await fetchRfq(id);
  if (!rfq) return null;
  const supabase = await createClient();
  const [imageUrl, buyer] = await Promise.all([
    referenceFileUrl(rfq.reference_image_path),
    supabase.rpc("get_rfq_buyer_profile", { p_rfq: id }),
  ]);
  return { rfq, imageUrl, buyer: buyer.data?.[0] ?? null };
}

// ---------------------------------------------------------------------------
// Administrador
// ---------------------------------------------------------------------------
export async function listAdminRfqs(status: RfqStatus | "all") {
  const supabase = await createClient();
  let query = supabase
    .from("rfqs")
    .select(
      "id, number, status, product, quantity, deadline, submitted_at, created_at, units(names), categories(names), companies!rfqs_buyer_company_id_fkey(country, buyer_details(legal_name, full_name)), rfq_assignments(count)",
    )
    .order("submitted_at", { ascending: true, nullsFirst: false });
  if (status !== "all") query = query.eq("status", status);
  else query = query.neq("status", "draft");
  const { data } = await query.limit(200);
  return data ?? [];
}

export async function countAdminRfqsByStatus() {
  const supabase = await createClient();
  const { data } = await supabase.from("rfqs").select("status").neq("status", "draft");
  const counts: Partial<Record<RfqStatus, number>> = {};
  for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

export async function loadAdminRfq(id: string) {
  const rfq = await fetchRfq(id);
  if (!rfq) return null;
  const supabase = await createClient();
  const [imageUrl, note, buyer, assignments, factories, history] = await Promise.all([
    referenceFileUrl(rfq.reference_image_path),
    latestNote(id),
    supabase
      .from("companies")
      .select("id, status, country, sectors(names), buyer_details(legal_name, full_name, account_type)")
      .eq("id", rfq.buyer_company_id)
      .maybeSingle(),
    supabase
      .from("rfq_assignments")
      .select("factory_company_id, assigned_at")
      .eq("rfq_id", id),
    // Solo fábricas validadas; las de la misma categoría se proponen primero.
    supabase
      .from("companies")
      .select("id, factory_details(legal_name_en, legal_name_zh, city, province), factory_categories(category_id), factory_admin(tier)")
      .eq("kind", "factory")
      .eq("status", "validated"),
    supabase
      .from("status_history")
      .select("id, from_status, to_status, note, created_at")
      .eq("entity_type", "rfq")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const assigned = new Map((assignments.data ?? []).map((a) => [a.factory_company_id, a.assigned_at]));
  const quoted = new Set<string>();
  const { data: quotes } = await supabase.from("quotes").select("factory_company_id, status").eq("rfq_id", id);
  for (const q of quotes ?? []) if (q.status !== "draft") quoted.add(q.factory_company_id);

  const candidates = (factories.data ?? [])
    .map((f) => ({
      id: f.id,
      name: f.factory_details ? `${f.factory_details.legal_name_en} · ${f.factory_details.legal_name_zh}` : f.id,
      location: f.factory_details ? `${f.factory_details.city}, ${f.factory_details.province}` : "",
      tier: f.factory_admin?.tier ?? null,
      sameCategory: f.factory_categories.some((c) => c.category_id === rfq.category_id),
      assignedAt: assigned.get(f.id) ?? null,
      hasQuote: quoted.has(f.id),
    }))
    .sort((a, b) => Number(b.sameCategory) - Number(a.sameCategory) || a.name.localeCompare(b.name));

  return { rfq, imageUrl, note, buyer: buyer.data, candidates, history: history.data ?? [] };
}
