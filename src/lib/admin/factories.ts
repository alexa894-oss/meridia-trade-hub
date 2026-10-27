import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadCompanyForReview } from "./load";

export type FactoryAccount = "none" | "invited" | "active";

// "Red de fabricantes": todas las fábricas que Meridia incorporó.
export async function listFactories() {
  const supabase = await createClient();
  const [factories, accounts, invitations] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, status, country, created_at, factory_details(legal_name_en, trade_name), factory_admin(tier, identity_verified, capacity_verified, history_verified), factory_categories(categories(names))",
      )
      .eq("kind", "factory")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("profiles").select("company_id").eq("role", "factory").not("company_id", "is", null),
    supabase.from("factory_invitations").select("company_id").is("accepted_at", null).is("revoked_at", null),
  ]);
  const withAccount = new Set((accounts.data ?? []).map((a) => a.company_id));
  const invited = new Set((invitations.data ?? []).map((i) => i.company_id));
  return (factories.data ?? []).map((c) => ({
    id: c.id,
    status: c.status,
    country: c.country,
    createdAt: c.created_at,
    name: c.factory_details?.trade_name ?? c.factory_details?.legal_name_en ?? null,
    legalName: c.factory_details?.legal_name_en ?? null,
    tier: c.factory_admin?.tier ?? null,
    verifications: {
      identity: !!c.factory_admin?.identity_verified,
      capacity: !!c.factory_admin?.capacity_verified,
      history: !!c.factory_admin?.history_verified,
    },
    categories: c.factory_categories.map((fc) => fc.categories?.names as Record<string, string> | undefined).filter(Boolean) as Record<string, string>[],
    account: (withAccount.has(c.id) ? "active" : invited.has(c.id) ? "invited" : "none") as FactoryAccount,
  }));
}

// Ficha completa de una fábrica para el administrador.
export async function loadFactory(id: string) {
  const data = await loadCompanyForReview(id);
  if (!data || data.company.kind !== "factory") return data ? { notFactory: true as const } : null;
  const supabase = await createClient();
  const { data: invitations } = await supabase
    .from("factory_invitations")
    .select("id, email, created_at, accepted_at, revoked_at")
    .eq("company_id", id)
    .order("created_at", { ascending: false });
  const accounts = data.accounts.filter((a) => a.role === "factory");
  const pending = (invitations ?? []).find((i) => !i.accepted_at && !i.revoked_at) ?? null;
  return {
    ...data,
    invitations: invitations ?? [],
    pendingInvitation: pending,
    factoryAccounts: accounts,
    account: (accounts.length ? "active" : pending ? "invited" : "none") as FactoryAccount,
  };
}

export async function loadCategoryOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, names").order("sort_order");
  return (data ?? []) as { id: string; names: Record<string, string> }[];
}
