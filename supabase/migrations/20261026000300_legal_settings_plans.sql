-- Meridia Trade Hub · Textos legales, configuración y membresías

-- ---------------------------------------------------------------------------
-- Textos legales editables y versionados
-- ---------------------------------------------------------------------------
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.legal_document_kind not null,
  version int not null check (version > 0),
  content jsonb not null, -- {"es": "...", "zh-CN": "..."}
  is_draft boolean not null default true,
  published_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (kind, version)
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legal_document_id uuid not null references public.legal_documents (id) on delete restrict,
  accepted_at timestamptz not null default now(),
  unique (user_id, legal_document_id)
);

-- ---------------------------------------------------------------------------
-- Configuración de plataforma (clave → valor). Sin precios ni porcentajes.
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false, -- legible sin ser admin (p. ej. en el registro)
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- Valores iniciales tomados de "Decisiones abiertas". Los umbrales quedan en null:
-- la alerta no se dispara hasta que el administrador los configure.
insert into public.platform_settings (key, value, is_public) values
  ('factory_sees_buyer_name', 'false'::jsonb, false),
  ('buyer_sees_factory_tier', 'false'::jsonb, false),
  ('allow_individual_buyers', 'true'::jsonb, true),
  ('unanswered_rfq_alert_hours', 'null'::jsonb, false),
  ('pending_company_alert_hours', 'null'::jsonb, false);

create or replace function public.setting(p_key text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select value from public.platform_settings where key = p_key;
$$;
revoke execute on function public.setting(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Planes de membresía: la tabla nace vacía; los define el administrador.
-- Ningún plan puede mencionar el showroom (proyecto 2027).
-- ---------------------------------------------------------------------------
create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  benefits text[] not null default '{}',
  price numeric(12, 2) not null check (price >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  billing_period public.billing_period not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_no_showroom check (
    name !~* 'showroom'
    and coalesce(description, '') !~* 'showroom'
    and array_to_string(benefits, ' ') !~* 'showroom'
  )
);
create trigger membership_plans_updated_at before update on public.membership_plans
  for each row execute function public.set_updated_at();

create table public.factory_memberships (
  id uuid primary key default gen_random_uuid(),
  factory_company_id uuid not null references public.companies (id) on delete cascade,
  plan_id uuid not null references public.membership_plans (id) on delete restrict,
  starts_at date not null,
  ends_at date,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index factory_memberships_factory_idx on public.factory_memberships (factory_company_id);
