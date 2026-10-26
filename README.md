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

## Estructura

- `supabase/migrations/` — esquema versionado (enums, tablas, RLS, Storage, Realtime)
- `supabase/tests/` — pruebas de base de datos
- `messages/` — textos por idioma (`es` completo, `zh-CN` pendiente de traducción)
- `src/i18n/` — configuración de idiomas; para activar chino, añadir `zh-CN` en `routing.ts`
- `src/lib/supabase/` — clientes de Supabase para navegador, servidor y proxy
- `src/app/globals.css` — tokens de marca (navy, dorado, blanco)

La guía completa de despliegue y entornos llega en la Etapa 8.
