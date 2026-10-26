// Lista las claves de messages/es.json que faltan en cada otro idioma.
// Uso: npm run i18n:check   (sale con código 1 si falta alguna en un idioma activo)
// Los idiomas solo previstos (p. ej. zh-CN antes de publicarse) se informan sin fallar.
import fs from "node:fs";
import path from "node:path";

const dir = path.join(import.meta.dirname, "..", "messages");
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

// Idiomas activos según src/i18n/routing.ts (locales: [...]).
const routingSrc = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "i18n", "routing.ts"), "utf8");
const active = new Set([...(routingSrc.match(/locales:\s*\[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]));

const base = flatten(read("es.json"));
let missingTotal = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "es.json")) {
  const keys = new Set(flatten(read(file)));
  const missing = base.filter((k) => !keys.has(k));
  const locale = file.replace(/\.json$/, "");
  const isActive = active.has(locale);
  if (isActive) missingTotal += missing.length;
  console.log(`${file}: ${base.length - missing.length}/${base.length} claves traducidas${isActive ? "" : " (idioma aún no activo)"}`);
  missing.forEach((k) => console.log(`  falta ${k}`));
}

process.exit(missingTotal ? 1 : 0);
