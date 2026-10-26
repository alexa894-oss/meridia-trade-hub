// Datos de prueba para DESARROLLO y STAGING. Nunca para producción.
//
// Uso:
//   SEED_PASSWORD=... npm run seed                     # usa .env.local (desarrollo)
//   SEED_PASSWORD=... npm run seed -- --env=staging    # usa .env.staging.local
//
// Crea empresas ficticias de construcción y acabados (puertas, ventanas, pisos y
// revestimientos), solicitudes, cotizaciones y una conversación. Todas las cuentas
// usan correos @seed.meridia.test y la contraseña SEED_PASSWORD.
//
// Protecciones: solo corre contra los proyectos de Supabase listados abajo y se
// niega si MERIDIA_ENV=production. No inventa precios de membresía ni comisiones:
// esos valores los define el administrador.

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SEEDABLE_PROJECTS = {
  arhfwbrxgddafvszqmbs: "desarrollo",
  siqxntltnwzxyxuvwymd: "staging",
};
const DOMAIN = "seed.meridia.test";

const envName = (process.argv.find((a) => a.startsWith("--env=")) ?? "--env=development").split("=")[1];
const envFile = envName === "staging" ? ".env.staging.local" : ".env.local";
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (process.env.MERIDIA_ENV === "production") fail("MERIDIA_ENV=production: los datos de prueba nunca se cargan en producción.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const password = process.env.SEED_PASSWORD ?? "";
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!url || !key) fail(`Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ${envFile}.`);
if (!ref || !SEEDABLE_PROJECTS[ref]) fail(`El proyecto ${ref ?? url} no está en la lista de proyectos de prueba. No se carga nada.`);
if (password.length < 12) fail("Define SEED_PASSWORD (mínimo 12 caracteres) para las cuentas de prueba.");

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const must = (res, what) => {
  if (res.error) fail(`${what}: ${res.error.message}`);
  return res.data;
};

// ¿Ya se sembró?
const existing = must(await db.auth.admin.listUsers({ page: 1, perPage: 200 }), "listar usuarios");
if (existing.users.some((u) => u.email?.endsWith(`@${DOMAIN}`))) {
  fail(`Ya hay cuentas @${DOMAIN} en ${SEEDABLE_PROJECTS[ref]}. Los datos de prueba ya están cargados.`);
}

// Administrador de prueba (rol desde app_metadata, nunca desde el registro público).
must(
  await db.auth.admin.createUser({ email: `admin@${DOMAIN}`, password, email_confirm: true, app_metadata: { role: "admin" }, user_metadata: { full_name: "Admin de prueba" } }),
  "crear admin de prueba",
);

const lookup = async (table) => Object.fromEntries(must(await db.from(table).select("id, slug"), table).map((r) => [r.slug, r.id]));
const categories = await lookup("categories");
const sectors = await lookup("sectors");
const units = await lookup("units");

async function user(email, role, fullName) {
  const data = must(
    await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { signup_role: role, full_name: fullName, locale: "es" } }),
    `crear ${email}`,
  );
  return data.user.id;
}

async function company(userId, kind, status, country, sectorSlug) {
  const row = must(
    await db
      .from("companies")
      .insert({ kind, status, country, sector_id: sectorSlug ? sectors[sectorSlug] : null, submitted_at: new Date().toISOString(), validated_at: status === "validated" ? new Date().toISOString() : null })
      .select("id")
      .single(),
    "crear empresa",
  );
  must(await db.from("profiles").update({ company_id: row.id }).eq("id", userId), "vincular perfil");
  return row.id;
}

// Textos legales vigentes: las cuentas de prueba ya los aceptaron.
const legal = must(await db.rpc("current_legal_documents"), "textos legales");
async function acceptLegal(userId) {
  must(await db.from("legal_acceptances").insert(legal.map((d) => ({ user_id: userId, legal_document_id: d.id }))), "aceptar textos");
}

// ---------------------------------------------------------------------------
// Compradores
// ---------------------------------------------------------------------------
const buyers = [
  { email: `compras.andina@${DOMAIN}`, name: "Laura Gómez", legal: "Constructora Andina S.A.S.", taxId: "NIT 900.000.001-1", country: "CO", sector: "construction", status: "validated", title: "Jefa de compras", phone: "+57 300 000 0001" },
  { email: `compras.istmo@${DOMAIN}`, name: "Carlos Pérez", legal: "Grupo Edificar del Istmo S.A.", taxId: "RUC 0000000-1-000001", country: "PA", sector: "real-estate", status: "validated", title: "Gerente de proyectos", phone: "+507 6000 0001" },
  { email: `proyecto.rojas@${DOMAIN}`, name: "Mariana Rojas", individual: true, country: "CR", status: "in_review", phone: "+506 8000 0001", description: "Remodelación de vivienda familiar en San José: pisos, puertas interiores y ventanas de aluminio." },
];
const buyerIds = {};
for (const b of buyers) {
  const uid = await user(b.email, "buyer", b.name);
  const cid = await company(uid, "buyer", b.status, b.country, b.individual ? null : b.sector);
  must(
    await db.from("buyer_details").insert(
      b.individual
        ? { company_id: cid, account_type: "individual", full_name: b.name, project_description: b.description }
        : { company_id: cid, account_type: "company", legal_name: b.legal, tax_id: b.taxId, website: null },
    ),
    "datos comprador",
  );
  must(await db.from("company_contacts").insert({ company_id: cid, contact_name: b.name, contact_title: b.title ?? null, phone: b.phone, email: b.email }), "contacto comprador");
  await acceptLegal(uid);
  buyerIds[b.email] = { uid, cid };
}

// ---------------------------------------------------------------------------
// Fábricas (una estándar con licencia, VIP sin licencia, una en revisión)
// ---------------------------------------------------------------------------
const factories = [
  { email: `ventas.puertas@${DOMAIN}`, zh: "佛山示例木门有限公司", en: "Foshan Sample Wood Doors Co., Ltd.", city: "Foshan", province: "Guangdong", cats: ["doors"], capacity: "3.000 puertas al mes", port: "Shenzhen", year: 2009, status: "validated", tier: "standard", license: true, wechat: "seed_puertas" },
  { email: `ventas.ventanas@${DOMAIN}`, zh: "广州示例铝窗有限公司", en: "Guangzhou Sample Aluminium Windows Co., Ltd.", city: "Guangzhou", province: "Guangdong", cats: ["windows", "doors"], capacity: "8.000 m² de ventanas al mes", port: "Guangzhou (Nansha)", year: 2012, status: "validated", tier: "vip", license: false, wechat: "seed_ventanas" },
  { email: `ventas.pisos@${DOMAIN}`, zh: "晋江示例陶瓷有限公司", en: "Jinjiang Sample Ceramics Co., Ltd.", city: "Jinjiang", province: "Fujian", cats: ["flooring", "ceramics-porcelain"], capacity: "60.000 m² al mes", port: "Xiamen", year: 2005, status: "validated", tier: "standard", license: true, wechat: "seed_pisos" },
  { email: `ventas.revestimientos@${DOMAIN}`, zh: "厦门示例石材有限公司", en: "Xiamen Sample Stone Cladding Co., Ltd.", city: "Xiamen", province: "Fujian", cats: ["wall-cladding"], capacity: "15.000 m² al mes", port: "Xiamen", year: null, status: "in_review", tier: null, license: false, wechat: "seed_revest" },
];
const factoryIds = {};
for (const f of factories) {
  const uid = await user(f.email, "factory", `Ventas ${f.en.split(" ")[0]}`);
  const cid = await company(uid, "factory", f.status, "CN", null);
  must(
    await db.from("factory_details").insert({
      company_id: cid, legal_name_zh: f.zh, legal_name_en: f.en, city: f.city, province: f.province,
      website: `https://${f.wechat.replace("seed_", "")}.example`, capacity: f.capacity, departure_port: f.port,
      founded_year: f.year, founded_year_verified: f.year !== null && f.status === "validated",
    }),
    "datos fábrica",
  );
  must(await db.from("factory_categories").insert(f.cats.map((c) => ({ factory_company_id: cid, category_id: categories[c] }))), "categorías");
  must(await db.from("company_contacts").insert({ company_id: cid, contact_name: "Contacto de prueba", contact_title: "Ventas internacionales", phone: "+86 000 0000 0001", email: f.email, wechat: f.wechat }), "contacto fábrica");
  if (f.license) {
    must(await db.from("company_documents").insert({ company_id: cid, kind: "cn_business_license", storage_path: `${cid}/seed-license.pdf`, file_name: "licencia-de-prueba.pdf", uploaded_by: uid }), "licencia");
  }
  // Tipo de fábrica sí; comisión NO: la define el administrador.
  if (f.tier) must(await db.from("factory_admin").insert({ company_id: cid, tier: f.tier }), "tipo de fábrica");
  await acceptLegal(uid);
  factoryIds[f.email] = { uid, cid };
}

// ---------------------------------------------------------------------------
// Solicitudes, asignaciones, cotizaciones y una conversación
// ---------------------------------------------------------------------------
const istmo = buyerIds[`compras.istmo@${DOMAIN}`];
const andina = buyerIds[`compras.andina@${DOMAIN}`];
const puertas = factoryIds[`ventas.puertas@${DOMAIN}`];
const ventanas = factoryIds[`ventas.ventanas@${DOMAIN}`];
const pisos = factoryIds[`ventas.pisos@${DOMAIN}`];
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const rfqDoors = must(
  await db.from("rfqs").insert({
    buyer_company_id: istmo.cid, created_by: istmo.uid, status: "quoted", product: "Puertas interiores de madera para hotel",
    category_id: categories.doors, description: "Puertas para 80 habitaciones y áreas comunes de un hotel en Ciudad de Panamá.",
    quantity: 160, unit_id: units.units, destination_country: "PA", technical_specs: "900 × 2100 mm, núcleo sólido, chapa de roble, marco y bisagras incluidos.",
    deadline: inDays(30), reference_url: "https://example.com/referencia-puerta", accepts_alternatives: true, needs_sample: true,
    incoterms: ["FOB", "CIF"], destination_port: "Balboa", shipping_modes: ["FCL"], submitted_at: new Date().toISOString(),
  }).select("id").single(),
  "solicitud puertas",
);
const rfqFloors = must(
  await db.from("rfqs").insert({
    buyer_company_id: andina.cid, created_by: andina.uid, status: "assigned", product: "Porcelanato 60 × 60 para vivienda",
    category_id: categories.flooring, description: "Piso para un conjunto residencial de 120 apartamentos en Medellín.",
    quantity: 9000, unit_id: units["square-meters"], destination_country: "CO", technical_specs: "Porcelanato rectificado 60 × 60, PEI 4, acabado mate, color gris claro.",
    deadline: inDays(25), reference_url: "https://example.com/referencia-piso", accepts_alternatives: false, needs_sample: true,
    incoterms: ["FOB"], shipping_modes: ["FCL"], submitted_at: new Date().toISOString(),
  }).select("id").single(),
  "solicitud pisos",
);
must(await db.from("rfqs").insert({ buyer_company_id: andina.cid, created_by: andina.uid, status: "draft", product: "Ventanas corredizas de aluminio" }), "borrador");
const admins = must(await db.from("profiles").select("id").eq("role", "admin").limit(1), "admin");
const assigner = admins[0]?.id ?? istmo.uid;
must(
  await db.from("rfq_assignments").insert([
    { rfq_id: rfqDoors.id, factory_company_id: puertas.cid, assigned_by: assigner },
    { rfq_id: rfqDoors.id, factory_company_id: ventanas.cid, assigned_by: assigner },
    { rfq_id: rfqFloors.id, factory_company_id: pisos.cid, assigned_by: assigner },
  ]),
  "asignaciones",
);

const baseQuote = { status: "submitted", currency: "USD", valid_until: inDays(20), submitted_at: new Date().toISOString() };
const q1 = must(
  await db.from("quotes").insert({
    ...baseQuote, rfq_id: rfqDoors.id, factory_company_id: puertas.cid, created_by: puertas.uid, offer_type: "exact",
    moq: 100, production_time_days: 35, departure_port: "Shenzhen", deposit_pct: 30, deposit_timing: "Al confirmar la orden", balance_pct: 70, balance_timing: "Contra copia del BL",
    sample_available: true, sample_cost: 0, sample_shipping_free: false, sample_shipping_cost: 60,
  }).select("id").single(),
  "cotización 1",
);
const q2 = must(
  await db.from("quotes").insert({
    ...baseQuote, rfq_id: rfqDoors.id, factory_company_id: ventanas.cid, created_by: ventanas.uid, offer_type: "alternative",
    alternative_differences: "Chapa de nogal en lugar de roble; mismo núcleo sólido y medidas.",
    moq: 150, production_time_days: 28, departure_port: "Guangzhou (Nansha)", deposit_pct: 40, deposit_timing: "Al confirmar la orden", balance_pct: 60, balance_timing: "Antes del embarque",
    sample_available: false,
  }).select("id").single(),
  "cotización 2",
);
must(
  await db.from("quote_prices").insert([
    { quote_id: q1.id, incoterm: "FOB", unit_price: 118 },
    { quote_id: q1.id, incoterm: "CIF", unit_price: 131 },
    { quote_id: q2.id, incoterm: "FOB", unit_price: 109.5 },
    { quote_id: q2.id, incoterm: "CIF", unit_price: 124 },
  ]),
  "precios",
);

const conv = must(await db.from("conversations").insert({ rfq_id: rfqDoors.id, factory_company_id: puertas.cid }).select("id").single(), "conversación");
must(
  await db.from("messages").insert([
    { conversation_id: conv.id, sender_id: istmo.uid, sender_kind: "buyer", body: "¿La muestra puede llegar en 10 días?" },
    { conversation_id: conv.id, sender_id: puertas.uid, sender_kind: "factory", body: "Sí, podemos despacharla esta semana por courier." },
  ]),
  "mensajes",
);

console.log(`✓ Datos de prueba cargados en ${SEEDABLE_PROJECTS[ref]}.`);
console.log(`  Compradores: ${buyers.map((b) => b.email).join(", ")}`);
console.log(`  Fábricas: ${factories.map((f) => f.email).join(", ")}`);
console.log(`  Administrador de prueba: admin@${DOMAIN}`);
console.log("  Contraseña: la de SEED_PASSWORD.");
