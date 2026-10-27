# Meridia Trade Hub

Plataforma B2B que conecta compradores latinoamericanos con fábricas validadas
(materiales de construcción y acabados).

Stack: Next.js (App Router) · TypeScript · Tailwind CSS · Supabase · Vercel · next-intl.

## Entornos

| Entorno | Supabase (us-east-1) | Vercel | Datos |
|---|---|---|---|
| Desarrollo | `arhfwbrxgddafvszqmbs` | local (`.env.local`) y **Preview** (cada rama, p. ej. `plataforma`) | datos de prueba (`npm run seed`) |
| Producción | `sktlxvjmhbdqnwmyxqbb` | **Production** (rama `main`) | solo datos reales; nunca datos de prueba |

Las dos bases tienen el mismo esquema: todo cambio entra como migración en `supabase/migrations/` y se aplica primero en desarrollo y luego en producción.

## Instalación y desarrollo local

Requisitos: Node 24 y npm.

```bash
npm install
cp .env.example .env.local   # URL y clave publicable del proyecto de desarrollo
npm run dev                  # http://localhost:3000
```

La app arranca aunque `.env.local` esté vacío; la sesión de Supabase simplemente no existe.
Las claves públicas están en Supabase → **Project Settings → API Keys**. La clave de servicio (`SUPABASE_SERVICE_ROLE_KEY`) solo va en archivos `.env*.local` (ignorados por git) y nunca en Vercel con prefijo `NEXT_PUBLIC_`.

## Migraciones

```bash
npx supabase login
npx supabase link --project-ref <ref>   # desarrollo o producción
npm run db:push                         # aplica las migraciones pendientes
```

Antes de aplicar: `npm run db:check` corre todas las migraciones en un Postgres embebido y la prueba de humo de RLS. Después de cada migración, regenera los tipos (`src/lib/supabase/database.types.ts`).

## Primer administrador

```bash
npm run admin:create -- correo@dominio.com --site=https://url-de-la-app
```

Imprime un enlace de un solo uso para definir la contraseña. Necesita `SUPABASE_SERVICE_ROLE_KEY` del proyecto en `.env.local`.

## Datos de prueba (solo desarrollo)

```bash
SEED_PASSWORD='una-clave-larga' npm run seed   # desarrollo (.env.local)
```

Crea un admin, 3 compradores y 4 fábricas ficticias (`@seed.meridia.test`), solicitudes, cotizaciones y una conversación. Se niega a correr contra cualquier proyecto que no sea el de desarrollo y si `MERIDIA_ENV=production`. No define precios de planes ni porcentajes de comisión: eso lo hace el administrador.

## Pruebas

| Comando | Qué verifica |
|---|---|
| `npm run db:check` | Migraciones + RLS en Postgres embebido (sin red): una fábrica no ve solicitudes no asignadas, nadie ve contactos ajenos, transiciones de estado, etc. |
| `npm run check:config` | Que el código no tenga precios de membresía ni porcentajes de comisión |
| `npm run test:e2e` | Playwright (escritorio y celular) contra la base sembrada: privacidad de contactos en cada pantalla, RLS por URL y por API, formularios que nombran el campo faltante, «Verificada» solo tras validar, flujo completo solicitud → cotización → pedido, y sin desborde horizontal en celular |

Para `test:e2e`: correr antes `npm run seed` y exportar el mismo `SEED_PASSWORD`. Levanta `next dev` en el puerto 3456 (o reutiliza uno abierto).

GitHub Actions (`.github/workflows/ci.yml`) corre lint, typecheck, i18n, `check:config`, `db:check` y build en cada push y pull request.

## Despliegue (Vercel)

- Proyecto `meridia-trade-hub` (equipo `alexagonzalez88`), conectado a GitHub.
- Cada push a una rama crea un **Preview** que usa la base de desarrollo. `main` despliega **Production** con la base de producción.
- Variables por entorno (Vercel → Settings → Environment Variables): `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Development y Preview → desarrollo, Production → producción). La app no necesita la clave de servicio en Vercel.

### Configuración en el panel de Supabase (cada proyecto)

1. **Authentication → URL Configuration**: *Site URL* con la URL de ese entorno; en *Redirect URLs*: desarrollo `http://localhost:3000/**` y `https://*-alexagonzalez88.vercel.app/**` (previews), producción el dominio final.
2. **Authentication → Emails → SMTP Settings**: SMTP propio (el correo por defecto de Supabase solo llega al equipo y con límite bajo).
3. **Authentication → Attack Protection**: activar la protección contra contraseñas filtradas.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:check` | Aplica todas las migraciones en un Postgres embebido y corre la prueba de humo de RLS |
| `npm run db:push` | Aplica las migraciones al proyecto de Supabase enlazado (`npx supabase link`) |
| `npm run i18n:check` | Lista las claves que faltan en cada idioma respecto a `es` (falla solo en idiomas activos) |
| `npm run seed` | Datos de prueba (solo desarrollo) |
| `npm run test:e2e` | Pruebas de extremo a extremo con Playwright |
| `npm run check:config` | Verifica que no haya precios ni comisiones en el código |
| `npm run admin:create -- correo@dominio.com` | Crea el primer administrador (o `ADMIN_EMAIL=… npm run admin:create`). Imprime un enlace de un solo uso para definir la contraseña. `--promote` convierte una cuenta existente; `--site=https://…` cambia la URL del enlace |

## Cuentas y roles

- Un solo acceso: **Ingresar a Meridia** (`/ingresar`). Después de ingresar, `/panel` envía a cada cuenta a su inicio según su rol: `/comprador`, `/fabrica` o `/admin`.
- En **Crear cuenta** solo se elige entre comprador y fábrica. El rol de administrador solo se asigna con `npm run admin:create` (usa la clave de servicio; nunca desde el registro público).
- Protección en tres capas: el proxy redirige a quien no tiene sesión, cada área verifica el rol en el servidor y la base de datos aplica RLS.

### Configuración de Supabase Auth (panel de Supabase)

1. **Authentication → URL Configuration**: *Site URL* con la URL de la app y, en *Redirect URLs*, `http://localhost:3000/**` y `https://*-alexagonzalez88.vercel.app/**`.
2. **Correo**: el servidor de correo por defecto de Supabase solo envía a miembros del equipo y con un límite muy bajo. Para que compradores y fábricas reales reciban la confirmación y la recuperación de contraseña, configura un SMTP propio en **Authentication → Emails → SMTP Settings**.

## Acceso privado (Etapa 9)

- El registro público es **Solicitar acceso** (`/solicitar-acceso`): empresa / persona jurídica o persona natural. No existe registro público de fábricas.
- La solicitud se completa en `/comprador/solicitud/<paso>` (datos → contacto → perfil de compra → verificación) y se sigue en `/comprador/solicitud`: recibida → en revisión → aprobada · información adicional requerida · rechazada.
- Mientras no esté aprobada, la cuenta solo ve su seguimiento: solicitudes de cotización, pedidos y mensajes quedan bloqueados (en la interfaz y en la base: `rfqs_buyer_insert` exige empresa aprobada).
- Admin → **Solicitudes de acceso** (`/admin/accesos`): tabla, expediente completo, observaciones internas (`company_notes`, solo admin) y acciones: marcar en revisión, solicitar documentos o información, aprobar, rechazar.
- Los documentos del solicitante son opcionales ("cuando corresponda"); Meridia los pide si hacen falta.

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

## Mensajería

- Una conversación por solicitud y fábrica (`open_conversation()`), entre comprador, fábrica y Meridia. Se abre desde el comparador, desde la oportunidad de la fábrica o desde el panel del admin.
- Tiempo real con Supabase Realtime (respeta RLS) y adjuntos en `message-attachments/<conversación>/…` (PDF o imagen, 10 MB).
- Teléfonos, correos y WeChat: aviso inmediato y envío bloqueado; la base lo vuelve a rechazar (`check_message_contact`). Meridia está exenta.
- La base fija quién envía (`sender_kind`); nadie puede firmar como «Meridia» salvo el administrador.
- Avisos dentro de la plataforma (campana en el encabezado y `/notificaciones`) por mensajes nuevos, cotizaciones, asignaciones y revisiones.

## Textos legales

- Al publicar una versión nueva de términos o del acuerdo de no elusión, compradores y fábricas deben aceptarla al entrar (`/textos-legales`) antes de seguir usando la plataforma (`pending_legal_documents()`).

## Pedidos y comisión

- El comprador genera la orden desde una cotización (término y cantidad ≥ mínimo de la fábrica); el precio se copia de la cotización. Una orden activa por solicitud.
- La fábrica acepta o rechaza (con motivo). Al aceptar se registra la comisión con el porcentaje configurado para esa fábrica; si no hay porcentaje, no puede aceptar y Meridia recibe un aviso.
- Hitos con fecha (`status_history`): orden enviada → confirmado → en producción → listo para embarque → embarcado (exige factura comercial y BL) → entregado (lo confirma el comprador) → cerrado (Meridia). Sin mapas ni movimiento simulado.
- Comisiones (admin y fábrica; el comprador no las ve): registrada → facturada → cobrada · vencida. El cobro se marca a mano; una facturada con vencimiento pasado queda vencida.

### Tipos de la base

`src/lib/supabase/database.types.ts` se genera desde Supabase. Regenéralo después de cada migración (`npx supabase gen types typescript --project-id <ref>` con el CLI enlazado).

## Estructura

- `supabase/migrations/` — esquema versionado (enums, tablas, RLS, Storage, Realtime)
- `supabase/tests/` — pruebas de base de datos
- `messages/` — textos por idioma (`es` completo, `zh-CN` pendiente de traducción)
- `src/i18n/` — configuración de idiomas; para activar chino, añadir `zh-CN` en `routing.ts`
- `src/lib/supabase/` — clientes de Supabase para navegador, servidor y proxy
- `src/app/globals.css` — tokens de marca (navy, dorado, blanco)

- `e2e/` — pruebas de extremo a extremo (Playwright)
- `scripts/` — administrador, datos de prueba y verificaciones
