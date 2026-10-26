import { expect, test } from "@playwright/test";
import { accounts, login } from "./fixtures";

// Revisión en celular: cada pantalla clave sin desplazamiento horizontal de página.
// Las capturas quedan en test-results/ para revisarlas.
const screens: { who: string; email?: string; paths: string[] }[] = [
  { who: "visitante", paths: ["/", "/ingresar", "/crear-cuenta", "/recuperar"] },
  { who: "comprador", email: accounts.buyerIstmo, paths: ["/comprador", "/comprador/solicitudes", "/comprador/solicitudes/nueva", "/comprador/pedidos", "/comprador/mensajes", "/notificaciones"] },
  { who: "fabrica", email: accounts.factoryDoors, paths: ["/fabrica", "/fabrica/oportunidades", "/fabrica/pedidos", "/fabrica/comisiones", "/fabrica/mensajes"] },
  { who: "admin", email: accounts.admin, paths: ["/admin", "/admin/empresas", "/admin/solicitudes", "/admin/pedidos", "/admin/comisiones", "/admin/planes", "/admin/configuracion"] },
];

for (const s of screens) {
  test(`celular · ${s.who}`, async ({ page }, info) => {
    if (s.email) await login(page, s.email);
    for (const path of s.paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} no debe desbordar horizontalmente`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`${s.who}${path.replaceAll("/", "_") || "_inicio"}.png`), fullPage: true });
    }
  });
}
