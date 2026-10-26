-- Meridia Trade Hub · Cuentas, empresas y datos privados

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Empresas (datos comunes; nunca contacto)
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  kind public.company_kind not null,
  status public.company_status not null default 'registered',
  country text not null check (country ~ '^[A-Z]{2}$'), -- ISO 3166-1 alfa-2
  sector text,                                          -- solo compradores
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  validated_at timestamptz,
  validated_by uuid references auth.users (id)
);
create index companies_kind_status_idx on public.companies (kind, status);
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users). El rol lo determina la cuenta.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  company_id uuid references public.companies (id) on delete set null,
  full_name text,
  locale text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_company_idx on public.profiles (company_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funciones auxiliares para RLS (security definer evita recursión entre políticas)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.my_company_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.my_role()
returns public.user_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Alta de perfil al registrarse.
-- 'admin' solo llega por app_metadata (solo la service role puede escribirla),
-- nunca desde el registro público.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin' then
    v_role := 'admin';
  elsif coalesce(new.raw_user_meta_data ->> 'signup_role', '') in ('buyer', 'factory') then
    v_role := (new.raw_user_meta_data ->> 'signup_role')::public.user_role;
  else
    raise exception 'signup_role must be buyer or factory';
  end if;

  insert into public.profiles (id, role, full_name, locale)
  values (
    new.id,
    v_role,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'es')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Detalles por tipo de empresa
-- ---------------------------------------------------------------------------
create table public.buyer_details (
  company_id uuid primary key references public.companies (id) on delete cascade,
  account_type public.buyer_account_type not null,
  -- empresa
  legal_name text,
  tax_id text,
  website text,
  -- persona natural
  full_name text,
  project_description text,
  updated_at timestamptz not null default now(),
  constraint buyer_company_required check (
    account_type <> 'company' or (legal_name is not null and tax_id is not null)
  ),
  constraint buyer_individual_required check (
    account_type <> 'individual'
    or (full_name is not null and char_length(coalesce(project_description, '')) >= 50)
  )
);
create trigger buyer_details_updated_at before update on public.buyer_details
  for each row execute function public.set_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  names jsonb not null, -- {"es": "...", "zh-CN": "..."}
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.factory_details (
  company_id uuid primary key references public.companies (id) on delete cascade,
  legal_name_zh text not null,
  legal_name_en text not null,
  city text not null,
  province text not null,
  website text,
  brochure_path text,
  capacity text,
  departure_port text,
  founded_year int check (founded_year between 1800 and 2100),
  founded_year_verified boolean not null default false,
  annual_capacity_or_sales text,
  annual_figure_verified boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint factory_web_or_brochure check (website is not null or brochure_path is not null)
);
create trigger factory_details_updated_at before update on public.factory_details
  for each row execute function public.set_updated_at();

create table public.factory_categories (
  factory_company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (factory_company_id, category_id)
);
create index factory_categories_category_idx on public.factory_categories (category_id);

-- ---------------------------------------------------------------------------
-- 🔒 Contacto privado: nunca se expone a la otra parte.
-- ---------------------------------------------------------------------------
create table public.company_contacts (
  company_id uuid primary key references public.companies (id) on delete cascade,
  contact_name text not null,
  contact_title text,
  phone text,
  email text,
  wechat text,
  updated_at timestamptz not null default now()
);
create trigger company_contacts_updated_at before update on public.company_contacts
  for each row execute function public.set_updated_at();

-- 🔒 Datos internos de fábrica (solo admin). Sin valores por defecto de comisión.
create table public.factory_admin (
  company_id uuid primary key references public.companies (id) on delete cascade,
  tier public.factory_tier,
  commission_rate numeric(5, 2) check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 100)),
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create trigger factory_admin_updated_at before update on public.factory_admin
  for each row execute function public.set_updated_at();

create table public.company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind public.company_document_kind not null,
  storage_path text not null,
  file_name text,
  uploaded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index company_documents_company_idx on public.company_documents (company_id);

create table public.company_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  action public.company_review_action not null,
  message text,
  actor_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint review_message_required check (
    action not in ('request_info', 'reject') or nullif(trim(message), '') is not null
  )
);
create index company_reviews_company_idx on public.company_reviews (company_id);

-- ---------------------------------------------------------------------------
-- Guardas: campos que solo cambia el administrador
-- ---------------------------------------------------------------------------
create or replace function public.guard_company_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if new.kind is distinct from old.kind
     or new.validated_at is distinct from old.validated_at
     or new.validated_by is distinct from old.validated_by then
    raise exception 'Only an administrator can change these fields';
  end if;

  -- La empresa solo puede enviarse a revisión; validar, rechazar, etc. es del admin.
  if new.status is distinct from old.status then
    if not (old.status in ('registered', 'info_requested') and new.status = 'in_review') then
      raise exception 'Invalid company status change';
    end if;
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create trigger companies_guard before update on public.companies
  for each row execute function public.guard_company_update();

create or replace function public.guard_factory_verified_flags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.founded_year_verified := false;
    new.annual_figure_verified := false;
  else
    -- Si la fábrica cambia el dato, deja de estar verificado.
    new.founded_year_verified := old.founded_year_verified
      and new.founded_year is not distinct from old.founded_year;
    new.annual_figure_verified := old.annual_figure_verified
      and new.annual_capacity_or_sales is not distinct from old.annual_capacity_or_sales;
  end if;
  return new;
end;
$$;

create trigger factory_details_guard before insert or update on public.factory_details
  for each row execute function public.guard_factory_verified_flags();

-- El rol y la empresa del perfil no los cambia el usuario.
revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, locale) on public.profiles to authenticated;
