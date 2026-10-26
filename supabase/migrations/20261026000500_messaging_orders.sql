-- Meridia Trade Hub · Mensajería, notificaciones, pedidos y comisiones

-- ---------------------------------------------------------------------------
-- Una conversación por solicitud y fábrica (comprador + fábrica + Meridia)
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  factory_company_id uuid not null references public.companies (id) on delete restrict,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (rfq_id, factory_company_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id),
  sender_kind public.message_sender_kind not null,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- sender_kind lo calcula la base según el rol; nadie se hace pasar por "Meridia".
create or replace function public.set_message_sender()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  new.sender_id := auth.uid();
  select role into v_role from public.profiles where id = auth.uid();
  new.sender_kind := case v_role
    when 'admin' then 'meridia'
    when 'buyer' then 'buyer'
    when 'factory' then 'factory'
  end::public.message_sender_kind;
  if new.sender_kind is null then
    raise exception 'Unknown sender';
  end if;
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_set_sender before insert on public.messages
  for each row execute function public.set_message_sender();

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index message_attachments_message_idx on public.message_attachments (message_id);

create table public.conversation_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

-- ---------------------------------------------------------------------------
-- Pedidos. Precio copiado de la cotización al crear la orden (no se recalcula).
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes (id) on delete restrict,
  rfq_id uuid not null references public.rfqs (id) on delete restrict,
  buyer_company_id uuid not null references public.companies (id) on delete restrict,
  factory_company_id uuid not null references public.companies (id) on delete restrict,
  created_by uuid not null references auth.users (id),
  status public.order_status not null default 'sent',
  incoterm public.incoterm not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price numeric(14, 4) not null check (unit_price >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  total_amount numeric(16, 2) not null check (total_amount >= 0),
  rejection_reason text,
  received_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_company_id);
create index orders_factory_idx on public.orders (factory_company_id);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind public.order_document_kind not null,
  storage_path text not null,
  file_name text,
  uploaded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index order_documents_order_idx on public.order_documents (order_id);

-- ---------------------------------------------------------------------------
-- Comisiones: solo se registran; la plataforma no cobra.
-- rate_pct se copia de factory_admin al aceptar la orden.
-- ---------------------------------------------------------------------------
create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  factory_company_id uuid not null references public.companies (id) on delete restrict,
  status public.commission_status not null default 'registered',
  rate_pct numeric(5, 2) not null check (rate_pct between 0 and 100),
  base_amount numeric(16, 2) not null check (base_amount >= 0),
  amount numeric(16, 2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  invoiced_at timestamptz,
  due_date date,
  paid_at timestamptz,
  paid_marked_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index commissions_factory_idx on public.commissions (factory_company_id);
create trigger commissions_updated_at before update on public.commissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auditoría: cada cambio de estado guarda quién y cuándo (vía trigger).
-- ---------------------------------------------------------------------------
create table public.status_history (
  id bigint generated always as identity primary key,
  entity_type public.audited_entity not null,
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users (id),
  note text,
  created_at timestamptz not null default now()
);
create index status_history_entity_idx on public.status_history (entity_type, entity_id, created_at);

create or replace function public.log_status_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return new;
    end if;
    v_old := old.status::text;
  end if;

  insert into public.status_history (entity_type, entity_id, from_status, to_status, actor_id, note)
  values (
    tg_argv[0]::public.audited_entity,
    new.id,
    v_old,
    new.status::text,
    auth.uid(),
    nullif(current_setting('meridia.status_note', true), '')
  );
  return new;
end;
$$;

create trigger companies_status_log after insert or update of status on public.companies
  for each row execute function public.log_status_change('company');
create trigger rfqs_status_log after insert or update of status on public.rfqs
  for each row execute function public.log_status_change('rfq');
create trigger quotes_status_log after insert or update of status on public.quotes
  for each row execute function public.log_status_change('quote');
create trigger orders_status_log after insert or update of status on public.orders
  for each row execute function public.log_status_change('order');
create trigger commissions_status_log after insert or update of status on public.commissions
  for each row execute function public.log_status_change('commission');
