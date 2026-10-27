import { expect, test } from "@playwright/test";
import { accounts, login } from "./fixtures";

// Flujo principal: solicitud → asignación → cotización → aprobación de Meridia → comparador → orden.
// Termina en la aceptación de la fábrica, que se bloquea porque la comisión no
// está configurada (no hay valores por defecto: la define el administrador).
test("solicitud de punta a punta hasta la orden", async ({ page }) => {
  test.setTimeout(240_000);
  const product = `Ventanas de prueba ${Date.now()}`;
  const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

  // 1. El comprador crea y envía la solicitud.
  await login(page, accounts.buyerIstmo, "/comprador/solicitudes/nueva");
  await page.getByLabel("Producto").first().fill(product);
  await page.getByLabel("Categoría").selectOption({ label: "Ventanas" });
  await page.getByLabel("Descripción").fill("Ventanas corredizas para un edificio de oficinas.");
  await page.getByLabel("Especificaciones técnicas").fill("Aluminio serie 80, vidrio laminado 6 mm, color negro.");
  await page.getByLabel("Cantidad").fill("200");
  await page.getByLabel("Unidad").selectOption({ label: "Unidades" });
  await page.getByLabel("Enlace de referencia").fill("https://example.com/ventana");
  await page.getByLabel("Fecha límite").fill(inDays(30));
  await page.getByText("FOB", { exact: true }).click();
  await page.getByRole("button", { name: "Enviar a Meridia" }).click();
  await expect(page.getByText(/Solicitud enviada/)).toBeVisible();

  // 2. Meridia asigna fábricas compatibles (marcadas por defecto por categoría).
  await login(page, accounts.admin, "/admin/solicitudes?estado=submitted");
  await page.getByRole("link", { name: new RegExp(product) }).click();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await page.getByRole("button", { name: "Asignar seleccionadas" }).click();
  await expect(page.getByText(/Se asign/)).toBeVisible();

  // 3. La fábrica cotiza.
  await login(page, accounts.factoryWindows, "/fabrica/oportunidades");
  await page.getByRole("link", { name: new RegExp(product) }).click();
  await page.getByLabel("Moneda").fill("USD");
  await page.getByLabel(/Precio unitario FOB/).fill("95");
  await page.getByLabel(/Cantidad mínima/).fill("100");
  await page.getByLabel("Tiempo de producción (días)").fill("30");
  await page.getByLabel("Vigencia de la cotización").fill(inDays(20));
  await page.getByLabel("Anticipo (%)").fill("30");
  await page.getByLabel("Momento del anticipo").fill("Al confirmar la orden");
  await page.getByLabel("Saldo (%)").fill("70");
  await page.getByLabel("Momento del saldo").fill("Antes del embarque");
  await page.getByText("Sin muestra", { exact: true }).click();
  await page.getByRole("button", { name: "Enviar cotización" }).click();
  await expect(page.getByText(/Meridia la revisará antes de presentarla al comprador/)).toBeVisible();

  // 3b. El comprador todavía no la ve: Meridia la revisa y la aprueba.
  await login(page, accounts.buyerIstmo, "/comprador/solicitudes");
  await page.getByRole("link", { name: new RegExp(product) }).click();
  await expect(page.locator("body")).not.toContainText("95,00");
  await login(page, accounts.admin, "/admin/solicitudes?estado=assigned");
  await page.getByRole("link", { name: new RegExp(product) }).click();
  await page.getByRole("button", { name: "Aprobar y enviar al comprador" }).click();
  await expect(page.getByText("Cotización aprobada: el comprador ya puede verla.")).toBeVisible();

  // 4. El comprador compara, marca preferida y genera la orden.
  await login(page, accounts.buyerIstmo, "/comprador/solicitudes");
  await page.getByRole("link", { name: new RegExp(product) }).click();
  await expect(page.locator("table")).toContainText("95,00");
  await page.getByRole("button", { name: "Marcar preferida" }).click();
  await expect(page.getByText("En negociación").first()).toBeVisible();
  await page.getByRole("link", { name: "Generar orden" }).click();
  await page.getByLabel("Término").selectOption("FOB");
  await page.getByRole("button", { name: "Enviar orden a la fábrica" }).click();
  await expect(page.getByText(/Orden enviada a la fábrica/)).toBeVisible();
  const orderUrl = page.url().replace("/comprador/", "/fabrica/").split("?")[0];

  // 5. La fábrica no puede aceptar sin comisión configurada por Meridia.
  await login(page, accounts.factoryWindows, new URL(orderUrl).pathname);
  await page.getByRole("button", { name: "Aceptar orden" }).click();
  await expect(page.getByText(/todavía no configuró la comisión/)).toBeVisible();
});
