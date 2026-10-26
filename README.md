# Meridia Trade Hub

Plataforma B2B que conecta compradores latinoamericanos con fábricas validadas
(materiales de construcción y acabados).

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Supabase · Vercel · next-intl.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar con las claves de Supabase
npm run dev
```

La app arranca aunque `.env.local` esté vacío; la sesión de Supabase simplemente no existe.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:check` | Aplica todas las migraciones en un Postgres embebido y corre la prueba de humo de RLS |
| `npm run db:push` | Aplica las migraciones al proyecto de Supabase enlazado (`npx supabase link`) |
| `npm run i18n:check` | Lista las claves que faltan en cada idioma respecto a `es` |
| `npm run admin:create -- correo@dominio.com` | Crea el primer administrador (o `ADMIN_EMAIL=… npm run admin:create`). Imprime un enlace de un solo uso para definir la contraseña. `--promote` convierte una cuenta existente; `--site=https://…` cambia la URL del enlace |

## Cuentas y roles

- Un solo acceso: **Ingresar a Meridia** (`/ingresar`). Después de ingresar, `/panel` envía a cada cuenta a su inicio según su rol: `/comprador`, `/fabrica` o `/admin`.
- En **Crear cuenta** solo se elige entre comprador y fábrica. El rol de administrador solo se asigna con `npm run admin:create` (usa la clave de servicio; nunca desde el registro público).
- Protección en tres capas: el proxy redirige a quien no tiene sesión, cada área verifica el rol en el servidor y la base de datos aplica RLS.

### Configuración de Supabase Auth (panel de Supabase)

1. **Authentication → URL Configuration**: *Site URL* con la URL de la app y, en *Redirect URLs*, `http://localhost:3000/**` y `https://*-alexagonzalez88.vercel.app/**`.
2. **Correo**: el servidor de correo por defecto de Supabase solo envía a miembros del equipo y con un límite muy bajo. Para que compradores y fábricas reales reciban la confirmación y la recuperación de contraseña, configura un SMTP propio en **Authentication → Emails → SMTP Settings**.

## Registro de empresas

- Comprador: `/comprador/registro` (datos → contacto → documento → enviar). Empresa o persona natural (esta última se puede desactivar con el ajuste `allow_individual_buyers`).
- Fábrica: `/fabrica/registro` (empresa → contacto → producción → documentos → enviar).
- Cada paso se guarda; la empresa puede volver más tarde. Al enviar, la base revalida todo en `submit_company_for_review()` y la empresa pasa a **en revisión**; desde ahí ya no puede editar.
- Teléfono, correo y WeChat se guardan solo en `company_contacts` (la propia empresa y el administrador).
- Los documentos van al bucket privado `company-docs/<company_id>/…` (PDF, JPG, PNG o WEBP, máximo 10 MB).
- Textos legales: tabla `legal_documents`, versionada. Mientras `is_draft = true` se muestra el aviso de borrador.
- Sectores y categorías: listas editables (`sectors`, `categories`).

## Panel de administración (`/admin`)

- **Panel**: empresas en revisión y solicitudes sin cotizaciones. Las alertas usan umbrales en horas que define el admin; vacíos = alerta inactiva.
- **Empresas**: filtros por estado y tipo; ficha con datos, contacto (solo admin), documentos (enlace firmado de 5 min), historial y acciones: validar, pedir información (con mensaje), rechazar (con motivo), suspender y reactivar. Todo pasa por `admin_review_company()`, que deja nota en el historial y una notificación a la empresa.
- **Fábricas**: tipo VIP o estándar (una estándar validada exige el registro empresarial chino), comisión pactada (sin valor por defecto), notas internas, membresía y verificación de año de fundación y capacidad/ventas.
- **Planes**: los crea el admin (nombre, precio, moneda, periodicidad). Ningún plan puede mencionar el showroom (validado en la app y en la base).
- **Configuración**: decisiones abiertas, umbrales, textos legales versionados, sectores y categorías.

## Solicitudes de cotización

- Comprador (`/comprador/solicitudes`): crea borradores en cualquier momento; **envía** solo con la empresa validada (`submit_rfq()`). En borrador solo se exige el producto; al enviar, todo menos la modalidad de carga. Puerto de destino obligatorio con CIF.
- Términos de cotización (FOB, CIF, EXW) y modalidad de carga (FCL, LCL, aéreo, muestras, aún no sé) son campos distintos.
- Teléfonos, correos y WeChat en el texto bloquean el envío (`src/lib/contact-detection.ts` y `find_contact_info()` en la base, con las mismas reglas).
- Administrador (`/admin/solicitudes`): pedir información, cerrar (con mensaje) y asignar fábricas validadas; por defecto se proponen las de la misma categoría.
- Fábrica (`/fabrica/oportunidades`): solo ve lo asignado. Del comprador ve sector, país y verificación; el nombre solo si el admin lo habilita. Una fábrica suspendida pierde el acceso.

## Cotizaciones y comparador

- Fábrica: una cotización por solicitud, desde su oportunidad. Oferta exacta o alternativa (solo si el comprador la aceptó, con diferencias), un precio unitario por cada término pedido, cantidad mínima, tiempo de producción, puerto, vigencia, condiciones de pago propuestas por la fábrica (anticipo + saldo = 100 %, sin valor por defecto) y muestra. Se valida en `submit_quote()`; enviada ya no se edita.
- Comprador: comparador con una columna por fábrica (nombre, verificación, precio por término, tiempos, pagos, muestra, marca de alternativa). Al abrirlo las cotizaciones quedan **revisadas**; puede marcar preferida (la solicitud pasa a **en negociación**) o descartar. Vencen solas al pasar la vigencia.
- Administrador: ve todas las cotizaciones de la solicitud y puede ocultar una (con motivo) o restaurarla.

### Tipos de la base

`src/lib/supabase/database.types.ts` se genera desde Supabase. Regenéralo después de cada migración (`npx supabase gen types typescript --project-id <ref>` con el CLI enlazado).

## Estructura

- `supabase/migrations/` — esquema versionado (enums, tablas, RLS, Storage, Realtime)
- `supabase/tests/` — pruebas de base de datos
- `messages/` — textos por idioma (`es` completo, `zh-CN` pendiente de traducción)
- `src/i18n/` — configuración de idiomas; para activar chino, añadir `zh-CN` en `routing.ts`
- `src/lib/supabase/` — clientes de Supabase para navegador, servidor y proxy
- `src/app/globals.css` — tokens de marca (navy, dorado, blanco)

La guía completa de despliegue y entornos llega en la Etapa 8.
