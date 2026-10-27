import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

// Prueba de humo de migraciones y RLS sobre Postgres embebido (PGlite).
// Simula lo mínimo de Supabase (roles, auth.uid(), storage, publicación realtime).
// Las pruebas completas contra Supabase llegan en la Etapa 8.
// Uso: npm run db:check
const dir = process.argv[2] ?? path.join(import.meta.dirname, '..', 'migrations');
const db = new PGlite();
process.on('uncaughtException', (e) => { console.log('FAIL (error inesperado):', e.message, e.query ?? ''); process.exit(1); });
process.on('unhandledRejection', (e) => { console.log('FAIL (error inesperado):', e.message, e.query ?? ''); process.exit(1); });

await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key default gen_random_uuid(), email text,
  raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
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
// El registro público siempre crea solicitantes (compradores); las fábricas las habilita Meridia.
const facA = await mk({ signup_role: 'factory' });
const facB = await mk({ signup_role: 'factory' });
check('registro público no crea fábricas', (await q(`select count(*)::int as n from profiles where id in ($1,$2) and role='buyer'`, [facA, facB]))[0].n === 2);
const sneaky = await mk({ signup_role: 'admin' });
check('registro público no puede pedir rol admin', (await q(`select role from profiles where id=$1`, [sneaky]))[0].role === 'buyer');
await q(`update profiles set role='factory' where id in ($1,$2)`, [facA, facB]);
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
const cat = (await q(`select id from categories where slug = 'doors'`))[0].id;
const unit = (await q(`select id from units where slug = 'units'`))[0].id;
const rfq = (await q(`insert into rfqs(buyer_company_id,created_by,status,product,category_id,description,quantity,unit_id,destination_country,deadline,incoterms) values ($1,$2,'submitted','Puertas','${cat}','desc',100,'${unit}','PA','2026-12-31','{FOB}') returning id`, [cBuyer, buyer]))[0].id;
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
check('fábrica validada no puede editar sus datos', (await q(`update factory_details set founded_year=2006 where company_id=$1 returning 1`, [cA])).length === 0);
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
// Fábrica incorporada por Meridia (todavía sin habilitar) con su cuenta invitada.
const pend = await mk({});
await q(`update profiles set role='factory', company_id=$1 where id=$2`, [cPending, pend]);
await q(`insert into factory_details(company_id,legal_name_zh,legal_name_en,city,province,website,capacity,departure_port) values ($1,'测试','Test Factory','Ningbo','Zhejiang','https://t.test','10k m2/mes','Ningbo')`, [cPending]);
await q(`insert into company_contacts(company_id,contact_name,phone,email,wechat) values ($1,'Wang','+86 1','w@t.test','wangwx')`, [cPending]);
await q(`insert into factory_categories(factory_company_id,category_id) values ($1,$2)`, [cPending, cat]);
await asUser(pend);
await expectError('empresa registrada no puede autovalidarse', () => q(`update companies set status='validated' where id=$1`, [cPending]));
await expectError('empresa no pasa a revisión con UPDATE directo', () => q(`update companies set status='in_review' where id=$1`, [cPending]));
await expectError('una fábrica no se envía sola a revisión', () => q(`select submit_company_for_review()`));
await expectError('una fábrica no crea su propia ficha', () => q(`select register_company('CN')`));
await q(`update factory_details set founded_year=2001, founded_year_verified=true, annual_figure_verified=true where company_id=$1`, [cPending]);
const fdp = (await q(`select founded_year_verified, annual_figure_verified from factory_details where company_id=$1`, [cPending]))[0];
check('fábrica no puede autoverificar datos', fdp.founded_year_verified === false && fdp.annual_figure_verified === false);
check('fábrica no ve datos de otros', (await q(`select * from company_contacts`)).length === 1);

// --- Etapa 9: solicitud de acceso de un comprador ---
await asSuper();
const appl = await mk({ signup_role: 'buyer', full_name: 'Luis' });
await asUser(appl);
const cAppl = (await q(`select register_company('co') as id`))[0].id;
await expectError('solicitante pendiente no crea solicitudes de cotización', () => q(`insert into rfqs(buyer_company_id,created_by,product) values ($1,$2,'Pisos')`, [cAppl, appl]));
await q(`insert into buyer_details(company_id,account_type,legal_name,tax_id) values ($1,'company','Importadora Andes','NIT-9')`, [cAppl]);
await expectError('solicitud incompleta no se envía', () => q(`select submit_company_for_review()`));
await q(`update buyer_details set trade_name='Andes', economic_activity='Importación', company_type='importer', destination_country='CO', purchase_volume='2 contenedores al año', purchase_frequency_id=(select id from purchase_frequencies where slug='annual') where company_id=$1`, [cAppl]);
await q(`update companies set sector_id=(select id from sectors where slug='construction') where id=$1`, [cAppl]);
await q(`insert into company_contacts(company_id,contact_name,contact_title,phone,email,whatsapp,city,country) values ($1,'Luis','Gerente','+57 300 0000001','l@andes.test','+57 300 0000001','Bogotá','CO')`, [cAppl]);
await q(`insert into buyer_categories(buyer_company_id,category_id) values ($1,$2)`, [cAppl, cat]);
await q(`insert into legal_acceptances(user_id,legal_document_id) select $1, id from current_legal_documents()`, [appl]);
await expectError('sin autorización del representante no se envía', () => q(`select submit_company_for_review()`));
await q(`update buyer_details set representative_authorized=true where company_id=$1`, [cAppl]);
await q(`select submit_company_for_review()`);
check('solicitud enviada queda como recibida', (await q(`select status from companies where id=$1`, [cAppl]))[0].status === 'in_review');
await expectError('solicitud recibida no se edita', () => q(`update company_contacts set phone='x' where company_id=$1 returning 1`, [cAppl]).then((r) => { if (!r.length) throw new Error('0 filas'); }));
await asUser(admin);
check('Meridia recibe aviso de la nueva solicitud', (await q(`select count(*)::int as n from notifications where user_id=$1 and type='access_request'`, [admin]))[0].n === 1);
await q(`insert into company_notes(company_id,body,author_id) values ($1,'Confirmar volumen por teléfono',$2)`, [cAppl, admin]);
await expectError('no se aprueba en revisión sin pasar por recibida', () => q(`select admin_review_company($1,'start_review')`, [cBuyer]));
await q(`select admin_review_company($1,'start_review')`, [cAppl]);
check('la solicitud pasa a en revisión', (await q(`select status from companies where id=$1`, [cAppl]))[0].status === 'reviewing');
await q(`select admin_review_company($1,'request_info','Sube el registro mercantil')`, [cAppl]);
await asUser(appl);
check('solicitante no ve observaciones internas', (await q(`select * from company_notes`)).length === 0);
check('solicitante ve el pedido de información', (await q(`select message from company_reviews where company_id=$1 and action='request_info'`, [cAppl]))[0]?.message === 'Sube el registro mercantil');
await q(`select submit_company_for_review()`);
await asUser(admin);
await q(`select admin_review_company($1,'validate')`, [cAppl]);
await asUser(appl);
check('solicitud aprobada', (await q(`select status from companies where id=$1`, [cAppl]))[0].status === 'validated');
const applDraft = await q(`insert into rfqs(buyer_company_id,created_by,product) values ($1,$2,'Pisos') returning id`, [cAppl, appl]);
check('comprador aprobado ya puede crear solicitudes', applDraft.length === 1);
await asSuper();
await q(`delete from rfqs where id=$1`, [applDraft[0].id]);
await asUser(buyer);

await asSuper(); // atajo de datos: el flujo real de envío se prueba en la Etapa 5
await q(`update quotes set status='submitted', currency='USD', moq=10, production_time_days=30, departure_port='Shenzhen', valid_until='2026-12-31', deposit_pct=30, balance_pct=70, sample_available=false where rfq_id=$1`, [rfq]);
await asUser(buyer);
const fp = await q(`select * from get_rfq_factory_profiles($1)`, [rfq]);
check('comprador ve fábrica cotizante: año verificado visible, sin tipo VIP ni contacto', fp.length === 1 && fp[0].tier === null && fp[0].founded_year === 2005 && fp[0].annual_capacity_or_sales === null && !('email' in fp[0]));
check('comprador ve la cotización enviada', (await q(`select * from quotes`)).length === 1);

await asUser(admin);
check('admin ve todos los contactos', (await q(`select * from company_contacts`)).length === 4);
await asSuper();
await expectError('pago que no suma 100 falla', () => q(`update quotes set balance_pct=60 where rfq_id=$1`, [rfq]));
const hist = await q(`select entity_type, from_status, to_status from status_history order by id`);
check('historial de estados registrado', hist.some((h) => h.entity_type === 'quote' && h.from_status === 'draft' && h.to_status === 'submitted'));

// --- Etapa 3: revisión de empresas por el administrador ---
await asUser(facB);
await expectError('no admin no puede revisar empresas', () => q(`select admin_review_company($1,'validate')`, [cPending]));
await expectError('no admin no puede ver alertas', () => q(`select admin_alerts()`));
await asUser(admin);
await expectError('pedir información exige mensaje', () => q(`select admin_review_company($1,'request_info','  ')`, [cAppl]));
await expectError('validar fábrica exige tipo', () => q(`select admin_review_company($1,'validate')`, [cPending]));
await expectError('estándar sin registro empresarial chino falla', () => q(`select admin_review_company($1,'validate',null,'standard')`, [cPending]));
check('la nota del pedido de información queda en el historial', (await q(`select note from status_history where entity_id=$1 and to_status='info_requested'`, [cAppl]))[0]?.note === 'Sube el registro mercantil');
await q(`select admin_review_company($1,'validate',null,'vip')`, [cPending]);
check('la fábrica habilitada recibe una notificación', (await q(`select count(*)::int as n from notifications where user_id=$1`, [pend]))[0].n === 1);
const val = (await q(`select c.status, c.validated_by, fa.tier from companies c join factory_admin fa on fa.company_id=c.id where c.id=$1`, [cPending]))[0];
check('validar como VIP registra quién validó', val.status === 'validated' && val.validated_by === admin && val.tier === 'vip');
await expectError('pasar a estándar sin licencia falla', () => q(`update factory_admin set tier='standard' where company_id=$1`, [cPending]));
const alerts = (await q(`select admin_alerts() as a`))[0].a;
check('alertas sin umbral quedan inactivas', alerts.companies_overdue === null && alerts.rfqs_overdue === null);
await q(`update platform_settings set value='24' where key='pending_company_alert_hours'`);
check('con umbral, la alerta cuenta', typeof (await q(`select admin_alerts() as a`))[0].a.companies_overdue === 'number');
await expectError('umbral negativo no se acepta', () => q(`update platform_settings set value='-5' where key='unanswered_rfq_alert_hours'`));
await asUser(pend);
check('la fábrica no ve su tipo VIP', (await q(`select * from factory_admin`)).length === 0);

// --- Etapa 4: solicitudes ---
await asSuper();
const fc = async (t) => (await q(`select find_contact_info($1) as f`, [t]))[0].f;
check('detecta correo', (await fc('escribe a ventas@obra.com')) === 'ventas@obra.com');
check('detecta teléfono', !!(await fc('llama al +507 6000-0000')));
check('detecta teléfono sin +', !!(await fc('tel 6000-0000 oficina')));
check('detecta WeChat', !!(await fc('mi 微信 es abc123')));
check('no confunde medidas, fechas ni cantidades', (await fc('Puerta 1200x2100 mm, entrega 2026-12-31, 1.200.000 unidades, 600 x 600')) === null);

await asUser(buyer);
const draft = (await q(`insert into rfqs(buyer_company_id,created_by,product) values ($1,$2,'Ventanas de aluminio') returning id`, [cBuyer, buyer]))[0].id;
await expectError('comprador no cambia estado con UPDATE', () => q(`update rfqs set status='submitted' where id=$1`, [draft]));
await expectError('borrador incompleto no se envía', () => q(`select submit_rfq($1)`, [draft]));
await q(`update rfqs set category_id=$2, description='Ventanas corredizas, contacto ventas@obra.com', quantity=50, unit_id=$3, destination_country='PA', deadline=current_date + 30, incoterms='{FOB}' where id=$1`, [draft, cat, unit]);
await expectError('texto con datos de contacto no se envía', () => q(`select submit_rfq($1)`, [draft]));
await q(`update rfqs set description='Ventanas corredizas de aluminio' where id=$1`, [draft]);
await expectError('sin especificaciones ni imagen no se envía', () => q(`select submit_rfq($1)`, [draft]));
await q(`update rfqs set technical_specs='Perfil 6063, vidrio 6 mm', reference_url='https://ejemplo.test/ventana.jpg' where id=$1`, [draft]);
await asSuper();
await q(`update companies set status='in_review' where id=$1`, [cBuyer]);
await asUser(buyer);
await expectError('comprador no validado no envía', () => q(`select submit_rfq($1)`, [draft]));
await asSuper();
await q(`update companies set status='validated' where id=$1`, [cBuyer]);
await asUser(buyer);
await q(`select submit_rfq($1)`, [draft]);
check('solicitud enviada', (await q(`select status from rfqs where id=$1`, [draft]))[0].status === 'submitted');
await expectError('enviada ya no se edita', () => q(`update rfqs set product='x' where id=$1 returning 1`, [draft]).then((r) => { if (!r.length) throw new Error('0'); }));
await asUser(facA);
check('fábrica no ve solicitud enviada sin asignar', (await q(`select id from rfqs where id=$1`, [draft])).length === 0);
await expectError('fábrica no puede asignarse', () => q(`select admin_assign_rfq($1, array[$2]::uuid[])`, [draft, cA]));
await asUser(admin);
check('admin asigna fábricas', (await q(`select admin_assign_rfq($1, array[$2]::uuid[]) as n`, [draft, cA]))[0].n === 1);
check('solicitud pasa a asignada', (await q(`select status from rfqs where id=$1`, [draft]))[0].status === 'assigned');
check('fábrica recibe aviso', (await q(`select count(*)::int as n from notifications where user_id=$1 and type='rfq_assigned'`, [facA]))[0].n === 1);
await asUser(facA);
check('fábrica asignada ve la solicitud', (await q(`select id from rfqs where id=$1`, [draft])).length === 1);
await asSuper();
await q(`update companies set status='suspended' where id=$1`, [cA]);
await asUser(facA);
check('fábrica suspendida pierde acceso', (await q(`select id from rfqs where id=$1`, [draft])).length === 0);
await asSuper();
await q(`update companies set status='validated' where id=$1`, [cA]);
await asUser(admin);
await expectError('cerrar exige mensaje', () => q(`select admin_rfq_action($1,'close','')`, [draft]));
await q(`select admin_rfq_action($1,'close','Proyecto cancelado')`, [draft]);
check('cerrada con nota en historial', (await q(`select note from status_history where entity_id=$1 and to_status='closed'`, [draft]))[0]?.note === 'Proyecto cancelado');

// --- Etapa 5: cotizaciones ---
await asSuper();
const rfq5 = (await q(`insert into rfqs(buyer_company_id,created_by,status,product,category_id,description,quantity,unit_id,destination_country,deadline,incoterms,destination_port,accepts_alternatives,technical_specs,reference_url) values ($1,$2,'assigned','Pisos',$3,'desc',100,$4,'PA',current_date+20,'{FOB,CIF}','Balboa',false,'60x60','https://x.test') returning id`, [cBuyer, buyer, cat, unit]))[0].id;
await q(`insert into rfq_assignments(rfq_id,factory_company_id,assigned_by) values ($1,$2,$3),($1,$4,$3)`, [rfq5, cA, admin, cPending]);
await asUser(facA);
const qA = (await q(`insert into quotes(rfq_id,factory_company_id,created_by,offer_type,alternative_differences,currency,moq,production_time_days,departure_port,valid_until,deposit_pct,deposit_timing,balance_pct,balance_timing,sample_available) values ($1,$2,$3,'alternative','Otro acabado','USD',50,30,'Shenzhen',current_date+15,30,'Al confirmar',70,'Antes de embarcar',false) returning id`, [rfq5, cA, facA]))[0].id;
await q(`insert into quote_prices(quote_id,incoterm,unit_price) values ($1,'FOB',10)`, [qA]);
await expectError('alternativa no aceptada por el comprador falla', () => q(`select submit_quote($1)`, [qA]));
await q(`update quotes set offer_type='exact', alternative_differences=null where id=$1`, [qA]);
await expectError('falta precio para CIF', () => q(`select submit_quote($1)`, [qA]));
await q(`insert into quote_prices(quote_id,incoterm,unit_price) values ($1,'CIF',12)`, [qA]);
await expectError('precio para término no pedido falla', () => q(`insert into quote_prices(quote_id,incoterm,unit_price) values ($1,'EXW',9)`, [qA]).then(() => q(`select submit_quote($1)`, [qA])));
await q(`delete from quote_prices where quote_id=$1 and incoterm='EXW'`, [qA]);
await q(`update quotes set deposit_timing='Llamar al 6000-0000' where id=$1`, [qA]);
await expectError('condiciones con datos de contacto fallan', () => q(`select submit_quote($1)`, [qA]));
await q(`update quotes set deposit_timing='Al confirmar la orden', deposit_pct=40 where id=$1`, [qA]);
await expectError('pagos que no suman 100 fallan', () => q(`select submit_quote($1)`, [qA]));
await q(`update quotes set deposit_pct=30 where id=$1`, [qA]);
await expectError('fábrica no cambia estado con UPDATE', () => q(`update quotes set status='submitted' where id=$1`, [qA]));
await q(`select submit_quote($1)`, [qA]);
check('cotización enviada y solicitud con cotizaciones', (await q(`select (select status from quotes where id=$1) as qs, (select status from rfqs where id=$2) as rs`, [qA, rfq5]))[0].rs === 'quoted');
await expectError('enviada ya no se edita', () => q(`update quotes set moq=1 where id=$1 returning 1`, [qA]).then((r) => { if (!r.length) throw new Error('0'); }));
await expectError('no puede cotizar dos veces', () => q(`insert into quotes(rfq_id,factory_company_id,created_by) values ($1,$2,$3)`, [rfq5, cA, facA]));
await asUser(pend);
check('otra fábrica no ve la cotización ajena', (await q(`select * from quotes where rfq_id=$1`, [rfq5])).length === 0);
check('otra fábrica no ve precios ajenos', (await q(`select * from quote_prices where quote_id=$1`, [qA])).length === 0);
await asUser(buyer);
check('comprador ve la cotización enviada', (await q(`select * from quotes where rfq_id=$1`, [rfq5])).length === 1);
await q(`select mark_quotes_reviewed($1)`, [rfq5]);
check('al verla queda revisada', (await q(`select status from quotes where id=$1`, [qA]))[0].status === 'reviewed');
await q(`select buyer_quote_action($1,'prefer')`, [qA]);
check('preferida abre negociación', (await q(`select status from rfqs where id=$1`, [rfq5]))[0].status === 'negotiating');
await asUser(facA);
await expectError('fábrica no marca preferida', () => q(`select buyer_quote_action($1,'prefer')`, [qA]));
await asUser(admin);
await expectError('ocultar exige motivo', () => q(`select admin_hide_quote($1,true,'')`, [qA]));
await q(`select admin_hide_quote($1,true,'Incluía datos de contacto en un adjunto')`, [qA]);
await asUser(buyer);
check('comprador no ve cotización oculta', (await q(`select * from quotes where id=$1`, [qA])).length === 0);
check('comparador sin fábricas ocultas', (await q(`select * from get_rfq_factory_profiles($1)`, [rfq5])).length === 0);
await asUser(facA);
check('fábrica ve que su cotización fue ocultada', (await q(`select status, hidden_reason from quotes where id=$1`, [qA]))[0]?.status === 'hidden');

// --- Etapa 6: mensajería ---
await asUser(pend);
await expectError('fábrica no abre conversación de solicitud no asignada', () => q(`select open_conversation($1,$2)`, [draft, cPending]));
await asUser(buyer);
const conv6 = (await q(`select open_conversation($1,$2) as id`, [rfq5, cPending]))[0].id;
check('abrir dos veces devuelve la misma conversación', (await q(`select open_conversation($1,$2) as id`, [rfq5, cPending]))[0].id === conv6);
await expectError('mensaje con correo no se envía', () => q(`insert into messages(conversation_id,sender_id,sender_kind,body) values ($1,$2,'buyer','escríbeme a ana@obra.com')`, [conv6, buyer]));
await expectError('mensaje con teléfono no se envía', () => q(`insert into messages(conversation_id,sender_id,sender_kind,body) values ($1,$2,'buyer','llámame al +507 6000-0000')`, [conv6, buyer]));
await q(`insert into messages(conversation_id,sender_id,sender_kind,body) values ($1,$2,'buyer','¿Pueden mejorar el plazo de producción?')`, [conv6, buyer]);
await asUser(pend);
const listF = await q(`select * from list_my_conversations()`);
const mine = listF.find((c) => c.id === conv6);
check('fábrica ve la conversación con 1 no leído', mine?.unread === 1);
check('fábrica no ve el nombre del comprador', mine && mine.buyer_name === null && mine.buyer_country === 'PA');
check('fábrica recibió aviso del mensaje', (await q(`select count(*)::int as n from notifications where user_id=$1 and type='message'`, [pend]))[0].n === 1);
await q(`select mark_conversation_read($1)`, [conv6]);
check('al leer, no leídos en 0', (await q(`select unread from list_my_conversations($1)`, [conv6]))[0].unread === 0);
await asUser(facA);
check('otra fábrica no ve la conversación', (await q(`select * from list_my_conversations($1)`, [conv6])).length === 0);
check('otra fábrica no ve los mensajes', (await q(`select * from messages where conversation_id=$1`, [conv6])).length === 0);
await asUser(admin);
await q(`insert into messages(conversation_id,sender_id,sender_kind,body) values ($1,$2,'buyer','Hola, soy Meridia: info@meridia.test')`, [conv6, admin]);
check('Meridia escribe con su etiqueta', (await q(`select sender_kind from messages where conversation_id=$1 order by created_at desc limit 1`, [conv6]))[0].sender_kind === 'meridia');
check('admin ve el nombre del comprador', !!(await q(`select buyer_name from list_my_conversations($1)`, [conv6]))[0].buyer_name);

// --- Etapa 7: pedidos y comisión ---
await asSuper();
const rfq7 = (await q(`insert into rfqs(buyer_company_id,created_by,status,product,category_id,description,quantity,unit_id,destination_country,deadline,incoterms,technical_specs,reference_url) values ($1,$2,'quoted','Ventanas',$3,'d',200,$4,'PA',current_date+20,'{FOB}','x','https://x.test') returning id`, [cBuyer, buyer, cat, unit]))[0].id;
await q(`insert into rfq_assignments(rfq_id,factory_company_id,assigned_by) values ($1,$2,$3)`, [rfq7, cPending, admin]);
const q7 = (await q(`insert into quotes(rfq_id,factory_company_id,created_by,status,currency,moq,production_time_days,departure_port,valid_until,deposit_pct,deposit_timing,balance_pct,balance_timing,sample_available) values ($1,$2,$3,'reviewed','USD',100,30,'Ningbo',current_date+10,30,'a',70,'b',false) returning id`, [rfq7, cPending, pend]))[0].id;
await q(`insert into quote_prices(quote_id,incoterm,unit_price) values ($1,'FOB',12.5)`, [q7]);
await asUser(facA);
await expectError('otra fábrica no genera orden', () => q(`select buyer_create_order($1,'FOB',150)`, [q7]));
await asUser(buyer);
await expectError('cantidad bajo el mínimo falla', () => q(`select buyer_create_order($1,'FOB',50)`, [q7]));
await expectError('término no cotizado falla', () => q(`select buyer_create_order($1,'CIF',150)`, [q7]));
const order7 = (await q(`select buyer_create_order($1,'FOB',150) as id`, [q7]))[0].id;
const o7 = (await q(`select total_amount, unit_price, status from orders where id=$1`, [order7]))[0];
check('orden con precio de la cotización y total', Number(o7.total_amount) === 1875 && Number(o7.unit_price) === 12.5 && o7.status === 'sent');
check('solicitud con orden generada', (await q(`select status from rfqs where id=$1`, [rfq7]))[0].status === 'order_created');
await expectError('no hay segunda orden activa', () => q(`select buyer_create_order($1,'FOB',150)`, [q7]));
check('comprador no cambia estado con UPDATE (0 filas)', (await q(`update orders set status='delivered' where id=$1 returning 1`, [order7])).length === 0);
await asUser(pend);
check('sin comisión configurada no se acepta', (await q(`select factory_order_action($1,'accept') as r`, [order7]))[0].r === 'commission_not_configured');
await q(`select factory_order_action($1,'accept')`, [order7]);
await asUser(admin);
check('Meridia recibe un solo aviso de comisión faltante', (await q(`select count(*)::int as n from notifications where user_id=$1 and type='commission_missing'`, [admin]))[0].n === 1);
await asUser(pend);
check('el pedido sigue enviado', (await q(`select status from orders where id=$1`, [order7]))[0].status === 'sent');
await asSuper();
await q(`update factory_admin set commission_rate=4 where company_id=$1`, [cPending]);
await asUser(pend);
await q(`select factory_order_action($1,'accept')`, [order7]);
const c7 = (await q(`select rate_pct, base_amount, amount, status from commissions where order_id=$1`, [order7]))[0];
check('al aceptar se registra la comisión configurada', Number(c7.rate_pct) === 4 && Number(c7.amount) === 75 && c7.status === 'registered');
await q(`select factory_order_action($1,'in_production')`, [order7]);
await q(`select factory_order_action($1,'ready_to_ship')`, [order7]);
await expectError('embarcar sin factura ni BL falla', () => q(`select factory_order_action($1,'shipped')`, [order7]));
await q(`insert into order_documents(order_id,kind,storage_path,uploaded_by) values ($1,'commercial_invoice','x/1.pdf',$2),($1,'bill_of_lading','x/2.pdf',$2)`, [order7, pend]);
await q(`select factory_order_action($1,'shipped')`, [order7]);
await expectError('fábrica no confirma recepción', () => q(`select buyer_confirm_receipt($1)`, [order7]));
await asUser(buyer);
check('comprador no ve comisiones de su pedido', (await q(`select * from commissions where order_id=$1`, [order7])).length === 0);
await q(`select buyer_confirm_receipt($1)`, [order7]);
const hist7 = (await q(`select string_agg(to_status, ',' order by id) as h from status_history where entity_type='order' and entity_id=$1`, [order7]))[0].h;
check('hitos con fecha en el historial', hist7 === 'sent,confirmed,in_production,ready_to_ship,shipped,delivered');
await asUser(facA);
check('otra fábrica no ve el pedido', (await q(`select * from orders where id=$1`, [order7])).length === 0);
await asUser(admin);
await q(`select admin_close_order($1)`, [order7]);
const comm = (await q(`select id from commissions where order_id=$1`, [order7]))[0].id;
await expectError('no se cobra sin facturar', () => q(`select admin_commission_action($1,'paid')`, [comm]));
await q(`select admin_commission_action($1,'invoice', current_date - 40, current_date - 10)`, [comm]);
await q(`select mark_overdue_commissions()`);
check('facturada con vencimiento pasado queda vencida', (await q(`select status from commissions where id=$1`, [comm]))[0].status === 'overdue');
await q(`select admin_commission_action($1,'paid')`, [comm]);
check('cobro marcado a mano', (await q(`select status from commissions where id=$1`, [comm]))[0].status === 'paid');

// --- Etapa 8: re-aceptación de textos legales ---
await asUser(appl);
check('sin textos pendientes tras aceptar', (await q(`select * from pending_legal_documents()`)).length === 0);
await asUser(admin);
await q(`insert into legal_documents(kind,version,content,is_draft) values ('terms', 2, '{"es":"Términos v2"}', false)`);
await asUser(appl);
const pendingNow = await q(`select kind, version from pending_legal_documents()`);
check('versión nueva queda pendiente', pendingNow.length === 1 && pendingNow[0].version === 2);
await q(`insert into legal_acceptances(user_id,legal_document_id) select $1, id from pending_legal_documents()`, [appl]);
check('al aceptarla ya no está pendiente', (await q(`select * from pending_legal_documents()`)).length === 0);

console.log(fails ? `\n${fails} FALLOS` : '\nTodo OK');
process.exit(fails ? 1 : 0);
