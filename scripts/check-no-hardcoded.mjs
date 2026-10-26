// Criterio de aceptación: ningún precio de membresía ni porcentaje de comisión
// escrito en el código; todos salen de la configuración del administrador.
// Busca asignaciones numéricas literales a esos campos en src/.
import fs from "node:fs";
import path from "node:path";

const PATTERNS = [
  /commission_rate\s*[:=]\s*\d/,
  /commissionRate\s*[:=]\s*["']?\d/,
  /rate_pct\s*[:=]\s*\d/,
  /\bprice\s*:\s*\d/, // precios de planes
];
const hits = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && !full.endsWith("database.types.ts")) {
      fs.readFileSync(full, "utf8").split("\n").forEach((line, i) => {
        if (PATTERNS.some((p) => p.test(line))) hits.push(`${full}:${i + 1}: ${line.trim()}`);
      });
    }
  }
}
walk("src");
if (hits.length) {
  console.error("✗ Valores de precio o comisión escritos en el código:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("✓ Sin precios de membresía ni porcentajes de comisión en el código.");
