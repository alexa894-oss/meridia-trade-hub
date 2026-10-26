// Lista las claves de messages/es.json que faltan en cada otro idioma.
// Uso: npm run i18n:check   (sale con código 1 si falta alguna)
import fs from "node:fs";
import path from "node:path";

const dir = path.join(import.meta.dirname, "..", "messages");
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const base = flatten(read("es.json"));
let missingTotal = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "es.json")) {
  const keys = new Set(flatten(read(file)));
  const missing = base.filter((k) => !keys.has(k));
  missingTotal += missing.length;
  console.log(`${file}: ${base.length - missing.length}/${base.length} claves traducidas`);
  missing.forEach((k) => console.log(`  falta ${k}`));
}

process.exit(missingTotal ? 1 : 0);
