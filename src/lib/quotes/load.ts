import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
export type QuoteStatus = Database["public"]["Enums"]["quote_status"];

export type QuoteWithPrices = QuoteRow & { prices: Record<string, number> };

function withPrices(quote: QuoteRow & { quote_prices: { incoterm: string; unit_price: number }[] }): QuoteWithPrices {
  const { quote_prices, ...rest } = quote;
  return { ...rest, prices: Object.fromEntries(quote_prices.map((p) => [p.incoterm, Number(p.unit_price)])) };
}

// Cotización propia de la fábrica para esta solicitud (si existe) y su puerto declarado.
export async function loadFactoryQuote(rfqId: string, companyId: string) {
  const supabase = await createClient();
  await supabase.rpc("expire_quotes", { p_rfq: rfqId });
  const [quote, details] = await Promise.all([
    supabase.from("quotes").select("*, quote_prices(incoterm, unit_price)").eq("rfq_id", rfqId).eq("factory_company_id", companyId).maybeSingle(),
    supabase.from("factory_details").select("departure_port").eq("company_id", companyId).maybeSingle(),
  ]);
  return {
    quote: quote.data ? withPrices(quote.data) : null,
    defaultPort: details.data?.departure_port ?? null,
  };
}

// Comparador del comprador: cotizaciones visibles (RLS excluye borradores y
// ocultas) junto al perfil público de cada fábrica. Al abrirlo quedan "revisadas".
export async function loadComparator(rfqId: string) {
  const supabase = await createClient();
  await supabase.rpc("expire_quotes", { p_rfq: rfqId });
  await supabase.rpc("mark_quotes_reviewed", { p_rfq: rfqId });
  const [quotes, factories] = await Promise.all([
    supabase.from("quotes").select("*, quote_prices(incoterm, unit_price)").eq("rfq_id", rfqId).order("submitted_at"),
    supabase.rpc("get_rfq_factory_profiles", { p_rfq: rfqId }),
  ]);
  const profiles = new Map((factories.data ?? []).map((f) => [f.company_id, f]));
  return (quotes.data ?? []).map((q) => ({ quote: withPrices(q), factory: profiles.get(q.factory_company_id) ?? null }));
}

// Vista del administrador: todas las cotizaciones de la solicitud.
export async function loadAdminQuotes(rfqId: string) {
  const supabase = await createClient();
  await supabase.rpc("expire_quotes", { p_rfq: rfqId });
  const { data } = await supabase
    .from("quotes")
    .select("*, quote_prices(incoterm, unit_price), companies!quotes_factory_company_id_fkey(factory_details(legal_name_en, legal_name_zh))")
    .eq("rfq_id", rfqId)
    .order("submitted_at");
  return (data ?? []).map(({ companies, ...q }) => ({
    quote: withPrices(q),
    factoryName: companies?.factory_details ? `${companies.factory_details.legal_name_en} · ${companies.factory_details.legal_name_zh}` : "",
  }));
}
