import { expect, test } from "@playwright/test";
import { accounts, login } from "./fixtures";

// Criterio de aceptación: no se avanza si falta un campo obligatorio y el error nombra el campo.
test("crear cuenta vacía: cada error nombra su campo", async ({ page }) => {
  await page.goto("/crear-cuenta");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  for (const field of ["Tipo de cuenta", "Nombre completo", "Correo electrónico", "Contraseña", "Confirmar contraseña"]) {
    await expect(page.getByText(`Completa el campo «${field}».`)).toBeVisible();
  }
  await expect(page).toHaveURL(/\/crear-cuenta/);
});

test("solicitud: al enviar sin datos se nombran los campos que faltan", async ({ page }) => {
  await login(page, accounts.buyerAndina, "/comprador/solicitudes/nueva");
  await page.getByLabel("Producto").first().fill("Prueba de campos obligatorios");
  await page.getByRole("button", { name: "Enviar a Meridia" }).click();
  for (const field of ["Categoría", "Descripción", "Especificaciones técnicas", "Cantidad", "Unidad", "Fecha límite"]) {
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
