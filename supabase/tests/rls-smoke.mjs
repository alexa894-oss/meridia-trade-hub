import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

// Prueba de humo de migraciones y RLS sobre Postgres embebido (PGlite).
// Simula lo mínimo de Supabase (roles, auth.uid(), storage, publicación realtime).
// Las pruebas completas contra Supabase llegan en la Etapa 8.
// Uso: npm run db:check
const dir = process.argv[2] ?? path.join(import.meta.dirname, '..', 'migrations');
const db = new PGlite();

await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key default gen_random_uuid(), email text,
  raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create publication supabase_realtime;
grant usage on schema public, auth, storage to anon, authenticated;
grant all on storage.objects to authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  try { await db.exec(fs.readFileSync(path.join(dir, f), 'utf8')); console.log('OK  ', f); }
  catch (e) { console.log('FAIL', f, e.message); process.exit(1); }
}

const q = async (sql, p) => (await db.query(sql, p)).rows;
const asUser = async (uid) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`); };
const asSuper = async () => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); };
let fails = 0;
const check = (name, cond) => { console.log(cond ? 'PASS' : 'FAIL', name); if (!cond) fails++; };
const expectError = async (name, fn) => { try { await fn(); check(name, false); } catch { check(name, true); } };

// Usuarios
const mk = async (meta, app = {}) => (await q(`insert into auth.users(raw_user_meta_data, raw_app_meta_data) values ($1,$2) returning id`, [meta, app]))[0].id;
const admin = await mk({}, { role: 'admin' });
const buyer = await mk({ signup_role: 'buyer' });
const facA = await mk({ signup_role: 'factory' });
const facB = await mk({ signup_role: 'factory' });
await expectError('signup sin rol válido falla', () => mk({ signup_role: 'admin' }));
check('admin creado vía app_metadata', (await q(`select role from profiles where id=$1`, [admin]))[0].role === 'admin');

// Datos base (como service role)
const co = async (kind, country, status) => (await q(`insert into companies(kind,country,status) values ($1,$2,$3) returning id`, [kind, country, status]))[0].id;
const cBuyer = await co('buyer', 'PA', 'validated');
const cA = await co('factory', 'CN', 'validated');
const cB = await co('factory', 'CN', 'validated');
const cPending = await co('factory', 'CN', 'registered');
await q(`update profiles set company_id=$1 where id=$2`, [cBuyer, buyer]);
await q(`update profiles set company_id=$1 where id=$2`, [cA, facA]);
await q(`update profiles set company_id=$1 where id=$2`, [cB, facB]);
await q(`insert into buyer_details(company_id,account_type,legal_name,tax_id) values ($1,'company','Constructora Istmo','RUC-1')`, [cBuyer]);
await q(`insert into factory_details(company_id,legal_name_zh,legal_name_en,city,province,website,founded_year,founded_year_verified) values ($1,'佛山门业','Foshan Doors','Foshan','Guangdong','https://x.test',2005,true)`, [cA]);
await q(`insert into company_contacts(company_id,contact_name,phone,email,wechat) values ($1,'Ana','+507 6000-0000','ana@istmo.test',null),($2,'Li','+86 138','li@foshan.test','liwx')`, [cBuyer, cA]);
await q(`insert into factory_admin(company_id,tier) values ($1,'vip')`, [cA]);
const cat = (await q(`insert into categories(slug,names) values ('doors','{"es":"Puertas"}') returning id`))[0].id;
const rfq = (await q(`insert into rfqs(buyer_company_id,created_by,status,product,category_id,description,quantity,unit,destination_country,deadline,incoterms) values ($1,$2,'submitted','Puertas','${cat}','desc',100,'unidades','PA','2026-12-31','{FOB}') returning id`, [cBuyer, buyer]))[0].id;
await expectError('asignar a fábrica no validada falla', () => q(`insert into rfq_assignments(rfq_id,factory_company_id,assigned_by) values ($1,$2,$3)`, [rfq, cPending, admin]));
await q(`insert into rfq_assignments(rfq_id,factory_company_id,assigned_by) values ($1,$2,$3)`, [rfq, cA, admin]);
await expectError('CIF sin puerto falla', () => q(`update rfqs set incoterms='{CIF}' where id=$1`, [rfq]));
await expectError('plan con "showroom" falla', () => q(`insert into membership_plans(name,price,currency,billing_period) values ('Oro con Showroom',1,'USD','annual')`));
const conv = (await q(`insert into conversations(rfq_id,factory_company_id) values ($1,$2) returning id`, [rfq, cA]))[0].id;

// --- RLS ---
await asUser(facB);
check('fábrica B no ve solicitud no asignada', (await q(`select id from rfqs where id=$1`, [rfq])).length === 0);
check('fábrica B no ve la conversación', (await q(`select id from conversations where id=$1`, [conv])).length === 0);
check('fábrica B no obtiene perfil del comprador', (await q(`select * from get_rfq_buyer_profile($1)`, [rfq])).length === 0);
await expectError('fábrica B no puede escribir en la conversación', () => q(`insert into messages(conversation_id,sender_id,sender_kind,body) values ($1,$2,'factory','hola')`, [conv, facB]));

await asUser(facA);
check('fábrica A ve solicitud asignada', (await q(`select id from rfqs where id=$1`, [rfq])).length === 1);
const contactsA = await q(`select company_id from company_contacts`);
check('fábrica A solo ve su propio contacto', contactsA.length === 1 && contactsA[0].company_id === cA);
check('fábrica A no ve factory_admin', (await q(`select * from factory_admin`)).length === 0);
check('fábrica A no ve empresa compradora', (await q(`select * from companies where id=$1`, [cBuyer])).length === 0);
check('fábrica A no ve buyer_details', (await q(`select * from buyer_details`)).length === 0);
const bp = (await q(`select * from get_rfq_buyer_profile($1)`, [rfq]))[0];
check('fábrica A ve país y sector, sin nombre', bp && bp.country === 'PA' && bp.display_name === null && !('email' in bp) && !('phone' in bp));
await q(`update factory_details set founded_year_verified=true, annual_figure_verified=true, founded_year=2006 where company_id=$1`, [cA]);
const fd = (await q(`select founded_year_verified, annual_figure_verified from factory_details where company_id=$1`, [cA]))[0];
check('fábrica no puede autoverificar datos', fd.founded_year_verified === false && fd.annual_figure_verified === false);
check('empresa validada no puede editar su estado (0 filas)', (await q(`update companies set status='suspended' where id=$1 returning id`, [cA])).length === 0);
const m = (await q(`insert into messages(conversation_id,sender_id,sender_kind,body) values ($1,$2,'meridia','hola') returning sender_kind`, [conv, facA]))[0];
check('mensaje de fábrica no puede firmarse como Meridia', m.sender_kind === 'factory');
await q(`insert into quotes(rfq_id,factory_company_id,created_by) values ($1,$2,$3)`, [rfq, cA, facA]);
await expectError('fábrica no cambia su rol', () => q(`update profiles set role='admin' where id=$1`, [facA]));

await asUser(buyer);
check('comprador no ve asignaciones', (await q(`select * from rfq_assignments`)).length === 0);
check('comprador no ve cotización en borrador', (await q(`select * from quotes`)).length === 0);
check('comprador no ve contacto de la fábrica', (await q(`select * from company_contacts where company_id=$1`, [cA])).length === 0);
check('comprador no ve comisiones', (await q(`select * from commissions`)).length === 0);
check('comprador no ve fábricas sin cotización enviada', (await q(`select * from get_rfq_factory_profiles($1)`, [rfq])).length === 0);
check('comprador ve el mensaje de la conversación', (await q(`select * from messages where conversation_id=$1`, [conv])).length === 1);
await asSuper();
const pend = await mk({ signup_role: 'factory' });
await q(`update profiles set company_id=$1 where id=$2`, [cPending, pend]);
await asUser(pend);
await expectError('empresa registrada no puede autovalidarse', () => q(`update companies set status='validated' where id=$1`, [cPending]));
check('empresa registrada sí puede enviarse a revisión', (await q(`update companies set status='in_review' where id=$1 returning status`, [cPending]))[0]?.status === 'in_review');
await asUser(buyer);

await asUser(facA);
await q(`update quotes set status='submitted', currency='USD', moq=10, production_time_days=30, departure_port='Shenzhen', valid_until='2026-12-31', deposit_pct=30, balance_pct=70, sample_available=false where rfq_id=$1`, [rfq]);
await asUser(buyer);
const fp = await q(`select * from get_rfq_factory_profiles($1)`, [rfq]);
check('comprador ve fábrica cotizante, sin tipo VIP, año verificado oculto tras cambio', fp.length === 1 && fp[0].tier === null && fp[0].founded_year === null && !('email' in fp[0]));
check('comprador ve la cotización enviada', (await q(`select * from quotes`)).length === 1);

await asUser(admin);
check('admin ve todos los contactos', (await q(`select * from company_contacts`)).length === 2);
await asSuper();
await expectError('pago que no suma 100 falla', () => q(`update quotes set balance_pct=60 where rfq_id=$1`, [rfq]));
const hist = await q(`select entity_type, from_status, to_status from status_history order by id`);
check('historial de estados registrado', hist.some((h) => h.entity_type === 'quote' && h.from_status === 'draft' && h.to_status === 'submitted'));

console.log(fails ? `\n${fails} FALLOS` : '\nTodo OK');
process.exit(fails ? 1 : 0);
