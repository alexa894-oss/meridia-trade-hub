import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accounts, login, PASSWORD } from "./fixtures";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const DOORS = "Puertas interiores de madera para hotel";

async function as(email: string) {
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return sb;
}

// Criterio de aceptación: una fábrica no puede abrir una solicitud que no le fue
// asignada, ni cambiando la URL. Se prueba contra RLS (API directa) y en la página.
test("una fábrica no asignada no accede a la solicitud ni por API ni por URL", async ({ page }) => {
  const buyer = await as(accounts.buyerIstmo);
  const { data: own } = await buyer.from("rfqs").select("id").eq("product", DOORS).single();
  expect(own?.id).toBeTruthy();

  const floors = await as(accounts.factoryFloors);
  const rfqs = await floors.from("rfqs").select("id, product").eq("id", own!.id);
  expect(rfqs.data, "RLS: la fábrica no asignada no lee la fila").toEqual([]);
  const quotes = await floors.from("quotes").select("id").eq("rfq_id", own!.id);
  expect(quotes.data, "RLS: tampoco ve las cotizaciones").toEqual([]);
  const conv = await floors.rpc("open_conversation", { p_rfq: own!.id, p_factory: (await floors.rpc("my_company_id")).data });
  expect(conv.error, "no puede abrir conversación en una solicitud ajena").not.toBeNull();

  await login(page, accounts.factoryFloors);
  await page.goto(`/fabrica/oportunidades/${own!.id}`);
  await expect(page.locator("body")).not.toContainText(DOORS);
  await expect(page.locator("body")).toContainText("404");
});

test("el comprador solo ve sus solicitudes y las cotizaciones enviadas a ellas", async () => {
  const andina = await as(accounts.buyerAndina);
  const { data } = await andina.from("rfqs").select("product");
  expect(data?.map((r) => r.product)).not.toContain(DOORS);
  const { data: quotes } = await andina.from("quotes").select("id, rfq_id");
  const own = new Set((await andina.from("rfqs").select("id")).data?.map((r) => r.id));
  for (const q of quotes ?? []) expect(own.has(q.rfq_id)).toBe(true);
});
