// Crea el primer administrador de Meridia (nunca desde el registro público).
//
// Uso:
//   npm run admin:create -- persona@meridia.com
//   ADMIN_EMAIL=persona@meridia.com npm run admin:create
//
// Opciones:
//   --site=https://...   URL de la app para el enlace (por defecto NEXT_PUBLIC_SITE_URL o http://localhost:3000)
//   --promote            Convierte en administrador una cuenta que ya existe
//   --open               Abre el enlace directamente en el navegador (macOS) en vez de imprimirlo
//
// Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local. El rol "admin" se guarda en
// app_metadata, que solo la clave de servicio puede escribir; el trigger
// handle_new_user lo lee al crear el perfil.
//
// No se imprime ni se pide contraseña: el script genera un enlace de un solo uso
// para que la persona defina la suya en /restablecer.

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name) => flag(name)?.split("=").slice(1).join("=");

const email = (args.find((a) => !a.startsWith("--")) ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const promote = Boolean(flag("promote"));
const site = (flagValue("site") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Indica un correo válido (argumento o ADMIN_EMAIL).");
if (!url || !serviceKey) fail("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUserByEmail(target) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`No se pudo consultar usuarios: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found || data.users.length < 200) return found ?? null;
  }
}

const existing = await findUserByEmail(email);

if (existing) {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", existing.id).maybeSingle();
  if (profile?.role === "admin") {
    console.log(`• ${email} ya es administrador.`);
  } else if (!promote) {
    fail(`${email} ya existe con rol "${profile?.role ?? "desconocido"}". Usa --promote para convertirla en administrador.`);
  } else {
    const { error: metaError } = await supabase.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, role: "admin" },
    });
    if (metaError) fail(metaError.message);
    const { error: roleError } = await supabase.from("profiles").update({ role: "admin", company_id: null }).eq("id", existing.id);
    if (roleError) fail(roleError.message);
    console.log(`✓ ${email} ahora es administrador.`);
  }
} else {
  // Auth inserta el usuario antes de guardar app_metadata, así que el trigger
  // handle_new_user no ve todavía el rol "admin": la cuenta nace con un perfil
  // provisorio y se promueve enseguida (solo la clave de servicio puede hacerlo).
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role: "admin" },
    user_metadata: { full_name: "Meridia", signup_role: "buyer" },
  });
  if (error) fail(`No se pudo crear la cuenta: ${error.message}`);
  const { error: roleError } = await supabase.from("profiles").update({ role: "admin", company_id: null }).eq("id", created.user.id);
  if (roleError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    fail(`No se pudo asignar el rol de administrador: ${roleError.message}`);
  }
  console.log(`✓ Administrador creado: ${email}`);
}

// Enlace de un solo uso para definir la contraseña.
const { data: link, error: linkError } = await supabase.auth.admin.generateLink({ type: "recovery", email });
if (linkError) fail(`No se pudo generar el enlace: ${linkError.message}`);

const setPasswordUrl = `${site}/auth/confirm?token_hash=${link.properties.hashed_token}&type=recovery&next=/restablecer`;
if (flag("open")) {
  execFileSync("open", [setPasswordUrl]);
  console.log("\n✓ Se abrió el navegador en la página para definir la contraseña (enlace de un solo uso).");
} else {
  console.log("\nAbre este enlace (un solo uso) para definir la contraseña:");
  console.log(setPasswordUrl);
}
console.log("\nTambién puedes usar «¿Olvidaste tu contraseña?» en /ingresar.");
