import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type CompanyStatus = Database["public"]["Enums"]["company_status"];
type CompanyKind = Database["public"]["Enums"]["company_kind"];

export const companyStatuses: CompanyStatus[] = [
  "in_review",
  "reviewing",
  "info_requested",
  "registered",
  "validated",
  "rejected",
  "suspended",
];

export function companyDisplayName(c: {
  kind: CompanyKind;
  buyer_details: { legal_name: string | null; full_name: string | null } | null;
  factory_details: { legal_name_en: string; legal_name_zh: string } | null;
}) {
  if (c.kind === "factory") {
    return c.factory_details ? `${c.factory_details.legal_name_en} · ${c.factory_details.legal_name_zh}` : null;
  }
  return c.buyer_details?.legal_name ?? c.buyer_details?.full_name ?? null;
}

export async function loadAlerts() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_alerts");
  return data as {
    pending_company_hours: number | null;
    unanswered_rfq_hours: number | null;
    companies_in_review: number;
    companies_overdue: number | null;
    rfqs_awaiting_quotes: number;
    rfqs_overdue: number | null;
    rfqs_to_assign: number;
  } | null;
}

export async function listCompanies(filter: { status?: CompanyStatus | "all"; kind?: CompanyKind | "all" }) {
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select(
      "id, kind, status, country, created_at, submitted_at, buyer_details(account_type, legal_name, full_name), factory_details(legal_name_en, legal_name_zh), company_documents(count)",
    )
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (filter.status && filter.status !== "all") query = query.eq("status", filter.status);
  if (filter.kind && filter.kind !== "all") query = query.eq("kind", filter.kind);
  const { data } = await query.limit(200);
  return (data ?? []).map((c) => ({
    id: c.id,
    kind: c.kind,
    status: c.status,
    country: c.country,
    createdAt: c.created_at,
    submittedAt: c.submitted_at,
    accountType: c.buyer_details?.account_type ?? null,
    name: companyDisplayName(c),
    documents: (c.company_documents as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

export async function countCompaniesByStatus(kind?: CompanyKind) {
  const supabase = await createClient();
  let query = supabase.from("companies").select("status");
  if (kind) query = query.eq("kind", kind);
  const { data } = await query;
  const counts: Partial<Record<CompanyStatus, number>> = {};
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

// Detalle completo para revisar una empresa (incluye contacto: solo admin).
export async function loadCompanyForReview(id: string) {
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select(
      "*, sectors(names), buyer_details(*, purchase_frequencies(names)), buyer_categories(categories(names)), factory_details(*), company_contacts(*), factory_admin(*), factory_categories(categories(names)), company_documents(id, kind, file_name, storage_path, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!company) return null;

  const [reviews, history, memberships, plans, accounts, notes] = await Promise.all([
    supabase
      .from("company_reviews")
      .select("id, action, message, created_at")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("status_history")
      .select("id, from_status, to_status, note, created_at, actor_id")
      .eq("entity_type", "company")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("factory_memberships")
      .select("id, starts_at, ends_at, membership_plans(name, price, currency, billing_period)")
      .eq("factory_company_id", id)
      .order("starts_at", { ascending: false }),
    supabase.from("membership_plans").select("id, name, active").order("name"),
    supabase.from("profiles").select("id, full_name, role").eq("company_id", id),
    supabase.from("company_notes").select("id, body, author_id, created_at").eq("company_id", id).order("created_at", { ascending: false }),
  ]);
  // Autor de cada observación interna (siempre un administrador).
  const authorIds = [...new Set((notes.data ?? []).map((n) => n.author_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const authorName = new Map((authors ?? []).map((a) => [a.id, a.full_name]));

  // Enlaces firmados de corta duración para abrir los documentos privados.
  const documents = await Promise.all(
    (company.company_documents ?? []).map(async (d) => {
      const { data } = await supabase.storage.from("company-docs").createSignedUrl(d.storage_path, 300);
      return { id: d.id, kind: d.kind, fileName: d.file_name, createdAt: d.created_at, url: data?.signedUrl ?? null };
    }),
  );

  return {
    company,
    name: companyDisplayName(company),
    documents,
    reviews: reviews.data ?? [],
    history: history.data ?? [],
    memberships: memberships.data ?? [],
    plans: plans.data ?? [],
    accounts: accounts.data ?? [],
    notes: (notes.data ?? []).map((n) => ({ ...n, authorName: authorName.get(n.author_id) ?? null })),
  };
}

// "Solicitudes de acceso": empresas y personas que pidieron entrar a Meridia.
export async function listAccessRequests(status: CompanyStatus | "pending" | "all") {
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select("id, status, country, created_at, submitted_at, sectors(names), buyer_details(account_type, legal_name, trade_name, full_name)")
    .eq("kind", "buyer")
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (status === "pending") query = query.in("status", ["in_review", "reviewing"]);
  else if (status !== "all") query = query.eq("status", status);
  const { data } = await query.limit(300);
  return (data ?? []).map((c) => ({
    id: c.id,
    status: c.status,
    country: c.country,
    createdAt: c.created_at,
    submittedAt: c.submitted_at,
    sector: (c.sectors?.names ?? null) as Record<string, string> | null,
    accountType: c.buyer_details?.account_type ?? null,
    name: c.buyer_details?.trade_name ?? c.buyer_details?.legal_name ?? c.buyer_details?.full_name ?? null,
  }));
}

export async function countAccessRequestsByStatus() {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("status").eq("kind", "buyer");
  const counts: Partial<Record<CompanyStatus, number>> = {};
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

export async function listPlans() {
  const supabase = await createClient();
  const { data } = await supabase.from("membership_plans").select("*").order("active", { ascending: false }).order("name");
  return data ?? [];
}

export async function loadSettingsPage() {
  const supabase = await createClient();
  const [settings, sectors, categories, units, legal] = await Promise.all([
    supabase.from("platform_settings").select("key, value"),
    supabase.from("sectors").select("*").order("sort_order"),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("units").select("*").order("sort_order"),
    supabase.from("legal_documents").select("*").order("version", { ascending: false }),
  ]);
  const map = Object.fromEntries((settings.data ?? []).map((s) => [s.key, s.value]));
  return {
    settings: {
      factorySeesBuyerName: map.factory_sees_buyer_name === true,
      buyerSeesFactoryTier: map.buyer_sees_factory_tier === true,
      allowIndividualBuyers: map.allow_individual_buyers === true,
      pendingCompanyAlertHours: typeof map.pending_company_alert_hours === "number" ? map.pending_company_alert_hours : null,
      unansweredRfqAlertHours: typeof map.unanswered_rfq_alert_hours === "number" ? map.unanswered_rfq_alert_hours : null,
    },
    sectors: sectors.data ?? [],
    categories: categories.data ?? [],
    units: units.data ?? [],
    legal: legal.data ?? [],
  };
}
