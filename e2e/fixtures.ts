import { expect, type Page } from "@playwright/test";

// Cuentas y datos que crea scripts/seed.mjs (solo desarrollo).
export const PASSWORD = process.env.SEED_PASSWORD ?? "";
const D = "seed.meridia.test";

export const accounts = {
  admin: `admin@${D}`,
  buyerIstmo: `compras.istmo@${D}`,
  buyerAndina: `compras.andina@${D}`,
  buyerPending: `proyecto.rojas@${D}`,
  factoryDoors: `ventas.puertas@${D}`,
  factoryWindows: `ventas.ventanas@${D}`,
  factoryFloors: `ventas.pisos@${D}`,
} as const;

// Datos de contacto sembrados: ninguna pantalla de la otra parte debe mostrarlos.
export const contacts = {
  buyers: [`compras.istmo@${D}`, "+507 6000 0001", `compras.andina@${D}`, "+57 300 000 0001", `proyecto.rojas@${D}`, "+506 8000 0001"],
  factories: [`ventas.puertas@${D}`, `ventas.ventanas@${D}`, `ventas.pisos@${D}`, "+86 000 0000 0001", "seed_puertas", "seed_ventanas", "seed_pisos"],
};
export const buyerLegalNames = ["Grupo Edificar del Istmo", "Constructora Andina"];

export async function login(page: Page, email: string, next = "/panel") {
  if (!PASSWORD) throw new Error("Define SEED_PASSWORD (la misma usada en npm run seed).");
  await page.context().clearCookies();
  await page.goto(`/ingresar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/ingresar"));
}

// Texto visible + HTML de la página (incluye datos serializados para el cliente).
export async function pageContent(page: Page) {
  await page.waitForLoadState("networkidle");
  return `${await page.content()}\n${await page.locator("body").innerText()}`;
}

export function expectNoneOf(content: string, values: string[], where: string) {
  for (const value of values) expect(content, `${where} no debe mostrar «${value}»`).not.toContain(value);
}
