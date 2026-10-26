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

## Estructura

- `supabase/migrations/` — esquema versionado (enums, tablas, RLS, Storage, Realtime)
- `supabase/tests/` — pruebas de base de datos
- `messages/` — textos por idioma (`es` completo, `zh-CN` pendiente de traducción)
- `src/i18n/` — configuración de idiomas; para activar chino, añadir `zh-CN` en `routing.ts`
- `src/lib/supabase/` — clientes de Supabase para navegador, servidor y proxy
- `src/app/globals.css` — tokens de marca (navy, dorado, blanco)

La guía completa de despliegue y entornos llega en la Etapa 8.
