-- Meridia Trade Hub · Solicitudes de cotización, asignaciones y cotizaciones

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  buyer_company_id uuid not null references public.companies (id) on delete restrict,
  created_by uuid not null references auth.users (id),
  status public.rfq_status not null default 'draft',
  product text,
  category_id uuid references public.categories (id),
  description text,
  quantity numeric(14, 3) check (quantity is null or quantity > 0),
  unit text,
  destination_country text check (destination_country is null or destination_country ~ '^[A-Z]{2}$'),
  technical_specs text,
  deadline date,
  reference_image_path text,
  reference_url text,
  accepts_alternatives boolean not null default true,
  needs_sample boolean not null default false,
  incoterms public.incoterm[] not null default '{}',
  destination_port text,
  shipping_modes public.shipping_mode[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  -- Un borrador puede estar incompleto; al enviarse, los obligatorios deben estar.
  constraint rfq_required_when_submitted check (
    status = 'draft' or (
      product is not null and category_id is not null and description is not null
      and quantity is not null and unit is not null and destination_country is not null
      and deadline is not null and cardinality(incoterms) >= 1
    )
  ),
  constraint rfq_cif_needs_port check (
    not ('CIF' = any (incoterms)) or nullif(trim(destination_port), '') is not null
  )
);
create index rfqs_buyer_idx on public.rfqs (buyer_company_id);
create index rfqs_status_idx on public.rfqs (status);
create trigger rfqs_updated_at before update on public.rfqs
  for each row execute function public.set_updated_at();

create table public.rfq_assignments (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  factory_company_id uuid not null references public.companies (id) on delete restrict,
  assigned_by uuid not null references auth.users (id),
  assigned_at timestamptz not null default now(),
  unique (rfq_id, factory_company_id)
);
create index rfq_assignments_factory_idx on public.rfq_assignments (factory_company_id);

-- Solo se asigna a fábricas validadas.
create or replace function public.check_assignment_factory()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.companies
    where id = new.factory_company_id and kind = 'factory' and status = 'validated'
  ) then
    raise exception 'Requests can only be assigned to validated factories';
  end if;
  return new;
end;
$$;
create trigger rfq_assignments_check before insert or update on public.rfq_assignments
  for each row execute function public.check_assignment_factory();

create or replace function public.owns_rfq(p_rfq uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rfqs
    where id = p_rfq and buyer_company_id = public.my_company_id()
  );
$$;

create or replace function public.is_assigned(p_rfq uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rfq_assignments
    where rfq_id = p_rfq and factory_company_id = public.my_company_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- Cotizaciones. La fábrica pone su precio; Meridia no lo modifica.
-- Condiciones de pago sin valor por defecto.
-- ---------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  factory_company_id uuid not null references public.companies (id) on delete restrict,
  created_by uuid not null references auth.users (id),
  status public.quote_status not null default 'draft',
  offer_type public.offer_type not null default 'exact',
  alternative_differences text,
  currency char(3) check (currency is null or currency ~ '^[A-Z]{3}$'),
  moq numeric(14, 3) check (moq is null or moq > 0),
  moq_unit text,
  production_time_days int check (production_time_days is null or production_time_days > 0),
  departure_port text,
  valid_until date,
  deposit_pct numeric(5, 2) check (deposit_pct is null or deposit_pct between 0 and 100),
  deposit_timing text,
  balance_pct numeric(5, 2) check (balance_pct is null or balance_pct between 0 and 100),
  balance_timing text,
  sample_available boolean,
  sample_cost numeric(12, 2) check (sample_cost is null or sample_cost >= 0),
  sample_shipping_free boolean,
  sample_shipping_cost numeric(12, 2) check (sample_shipping_cost is null or sample_shipping_cost >= 0),
  hidden_reason text,
  hidden_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  constraint quote_alternative_needs_diff check (
    offer_type <> 'alternative' or nullif(trim(alternative_differences), '') is not null
  ),
  constraint quote_required_when_submitted check (
    status = 'draft' or (
      currency is not null and moq is not null and production_time_days is not null
      and departure_port is not null and valid_until is not null
      and deposit_pct is not null and balance_pct is not null
      and deposit_pct + balance_pct = 100
      and sample_available is not null
    )
  ),
  constraint quote_hidden_reason check (status <> 'hidden' or hidden_reason is not null)
);
create index quotes_rfq_idx on public.quotes (rfq_id);
create index quotes_factory_idx on public.quotes (factory_company_id);
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

create table public.quote_prices (
  quote_id uuid not null references public.quotes (id) on delete cascade,
  incoterm public.incoterm not null,
  unit_price numeric(14, 4) not null check (unit_price >= 0),
  primary key (quote_id, incoterm)
);
