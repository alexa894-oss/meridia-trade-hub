import { expect, test } from "@playwright/test";
import { accounts, login } from "./fixtures";

// Criterio de aceptación: ninguna empresa aparece como verificada antes de su validación.
test("una empresa en revisión no aparece como verificada", async ({ page }) => {
  await login(page, accounts.buyerPending);
  await expect(page.getByText("En revisión", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Empresa verificada");
});

test("en el comparador solo las fábricas validadas llevan la marca de verificación", async ({ page }) => {
  await login(page, accounts.buyerIstmo, "/comprador/solicitudes");
  await page.getByRole("link", { name: /Puertas interiores de madera/ }).click();
  const table = page.locator("table");
  await expect(table).toBeVisible();
  await expect(table.getByText("Verificada", { exact: true })).toHaveCount(2);
  await expect(table.getByText("Alternativa", { exact: true })).toBeVisible();
  // El tipo VIP no se muestra al comprador con la configuración inicial.
  await expect(table).not.toContainText("VIP");
});
