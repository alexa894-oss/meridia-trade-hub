import { test, type Page } from "@playwright/test";
import { accounts, buyerLegalNames, contacts, expectNoneOf, login, pageContent } from "./fixtures";

// Criterio de aceptación: ninguna pantalla de comprador o fábrica muestra un correo,
// teléfono o WeChat de la otra parte. Se recorren todas las páginas alcanzables
// desde el panel de cada rol (listas y detalles).
async function crawl(page: Page, start: string[], allowed: string[], limit = 40) {
  const seen = new Set<string>();
  const queue = [...start];
  const pages: { path: string; content: string }[] = [];
  while (queue.length && seen.size < limit) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    await page.goto(path);
    pages.push({ path, content: await pageContent(page) });
    const links = await page.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href")!));
    for (const href of links) {
      const clean = href.split("#")[0];
      if (allowed.some((p) => clean.startsWith(p)) && !seen.has(clean)) queue.push(clean);
    }
  }
  return pages;
}

test("el comprador no ve contactos de las fábricas en ninguna pantalla", async ({ page }) => {
  await login(page, accounts.buyerIstmo);
  const pages = await crawl(page, ["/comprador", "/notificaciones"], ["/comprador", "/notificaciones"]);
  test.info().annotations.push({ type: "páginas revisadas", description: String(pages.length) });
  for (const p of pages) expectNoneOf(p.content, contacts.factories, `Comprador · ${p.path}`);
});

test("la fábrica no ve contactos ni nombre del comprador en ninguna pantalla", async ({ page }) => {
  await login(page, accounts.factoryDoors);
  const pages = await crawl(page, ["/fabrica", "/notificaciones"], ["/fabrica", "/notificaciones"]);
  test.info().annotations.push({ type: "páginas revisadas", description: String(pages.length) });
  // Con la configuración inicial la fábrica solo ve sector y país del comprador.
  for (const p of pages) expectNoneOf(p.content, [...contacts.buyers, ...buyerLegalNames], `Fábrica · ${p.path}`);
});
