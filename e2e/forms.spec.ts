import { expect, test } from "@playwright/test";
import { accounts, login } from "./fixtures";

// Criterio de aceptación: no se avanza si falta un campo obligatorio y el error nombra el campo.
test("solicitar acceso: no avanza sin los obligatorios y cada error nombra su campo", async ({ page }) => {
  await page.goto("/solicitar-acceso");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Completa el campo «¿Cómo deseas registrarte?».")).toBeVisible();
  await page.getByText("Empresa / Persona jurídica").click();
  await page.getByRole("button", { name: "Continuar" }).click();
  for (const field of ["Razón social / nombre legal", "Nombre comercial", "País de constitución", "Identificación fiscal", "Actividad económica"]) {
    await expect(page.getByText(`Completa el campo «${field}».`)).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Información empresarial" })).toBeVisible();
});

test("solicitar acceso: no hay opción pública para registrar fábricas", async ({ page }) => {
  await page.goto("/solicitar-acceso");
  await expect(page.getByText("Empresa / Persona jurídica")).toBeVisible();
  await expect(page.getByText("Persona natural")).toBeVisible();
  await expect(page.getByText(/^Fábrica$/)).toHaveCount(0);
});

test("solicitante pendiente no entra a solicitudes de cotización, ni cambiando la URL", async ({ page }) => {
  await login(page, accounts.buyerPending, "/comprador/solicitudes/nueva");
  await expect(page).toHaveURL(/\/comprador\/solicitud$/);
  await expect(page.getByRole("link", { name: "Solicitudes de cotización" })).toHaveCount(0);
});

test("solicitud: al enviar sin datos se nombran los campos que faltan", async ({ page }) => {
  await login(page, accounts.buyerAndina, "/comprador/solicitudes/nueva");
  await page.getByLabel("Producto").first().fill("Prueba de campos obligatorios");
  await page.getByRole("button", { name: "Enviar a Meridia" }).click();
  for (const field of ["Categoría", "Descripción", "Especificaciones técnicas", "Cantidad", "Unidad", "Frecuencia de compra", "Fecha límite"]) {
    await expect(page.getByText(`Completa el campo «${field}».`)).toBeVisible();
  }
  await expect(page.getByText("Elige al menos una opción en «Términos de cotización».")).toBeVisible();
  await expect(page).toHaveURL(/\/nueva/);
});

test("solicitud: un correo en la descripción bloquea el envío", async ({ page }) => {
  await login(page, accounts.buyerAndina, "/comprador/solicitudes/nueva");
  await page.getByLabel("Descripción").fill("Escribir a compras@ejemplo.com para dudas");
  await page.getByLabel("Producto").first().click();
  await expect(page.getByText(/Parece un dato de contacto/)).toBeVisible();
});
