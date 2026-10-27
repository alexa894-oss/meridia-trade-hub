-- Meridia Trade Hub · Etapa 9 (Parte B): red de fabricantes administrada por Meridia.
-- Las fábricas las da de alta el administrador; pueden existir sin cuenta. Solo las
-- invitadas y habilitadas entran a su panel y responden las solicitudes asignadas.

-- ---------------------------------------------------------------------------
-- Ficha interna del fabricante (datos que carga Meridia)
-- ---------------------------------------------------------------------------
alter table public.factory_details
  alter column legal_name_zh drop not null,
  alter column city drop not null,
  alter column province drop not null,
  add column trade_name text,
  add column address text,
  add column registration_number text,
  add column products text,
  add column moq text,
  add column export_markets text,
  add column certifications text,
  add column commercial_terms text;

-- Tres verificaciones independientes (las marca Meridia; quién y cuándo).
alter table public.factory_admin
  add column identity_verified boolean not null default false,
  add column identity_verified_at timestamptz,
  add column identity_verified_by uuid references auth.users (id),
  add column capacity_verified boolean not null default false,
  add column capacity_verified_at timestamptz,
  add column capacity_verified_by uuid references auth.users (id),
  add column history_verified boolean not null default false,
  add column history_verified_at timestamptz,
  add column history_verified_by uuid references auth.users (id);

-- "Verificada" para el comprador: las tres verificaciones completas.
create or replace function public.factory_is_verified(p_company uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select fa.identity_verified and fa.capacity_verified and fa.history_verified
    from public.factory_admin fa where fa.company_id = p_company
  ), false);
$$;
revoke execute on function public.factory_is_verified(uuid) from public, anon;
grant execute on function public.factory_is_verified(uuid) to authenticated;

create or replace function public.get_rfq_factory_profiles(p_rfq uuid)
returns table (
  company_id uuid,
  legal_name_en text,
  legal_name_zh text,
  city text,
  province text,
  is_verified boolean,
  founded_year int,
  annual_capacity_or_sales text,
  tier public.factory_tier,
  category_ids uuid[]
)
language sql stable security definer
set search_path = ''
as $$
  select
    c.id,
    coalesce(fd.trade_name, fd.legal_name_en),
    fd.legal_name_zh,
    fd.city,
    fd.province,
    c.status = 'validated' and public.factory_is_verified(c.id),
    case when fd.founded_year_verified then fd.founded_year end,
    case when fd.annual_figure_verified then fd.annual_capacity_or_sales end,
    case
      when public.is_admin() or coalesce((public.setting('buyer_sees_factory_tier'))::boolean, false)
        then fa.tier
    end,
    array(select fc.category_id from public.factory_categories fc where fc.factory_company_id = c.id)
  from public.companies c
  join public.factory_details fd on fd.company_id = c.id
  left join public.factory_admin fa on fa.company_id = c.id
  where (public.is_admin() or public.owns_rfq(p_rfq))
    and exists (
      select 1 from public.quotes q
      where q.rfq_id = p_rfq
        and q.factory_company_id = c.id
        and q.status not in ('draft', 'hidden')
    );
$$;

-- La fábrica ya no edita su ficha: la mantiene Meridia (la fábrica solo la lee).
drop policy factory_details_own_write on public.factory_details;
drop policy factory_categories_own_write on public.factory_categories;

-- ---------------------------------------------------------------------------
-- Invitación privada a la plataforma. Se guarda solo el hash del enlace.
-- ---------------------------------------------------------------------------
create table public.factory_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token_hash text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  revoked_at timestamptz
);
create index factory_invitations_company_idx on public.factory_invitations (company_id, created_at desc);
alter table public.factory_invitations enable row level security;
create policy admin_all on public.factory_invitations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.invitation_hash(p_token text)
returns text
language sql immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;
revoke execute on function public.invitation_hash(text) from public, anon, authenticated;

-- Lo que ve quien abre el enlace: el nombre de la fábrica y el correo invitado.
create or replace function public.get_factory_invitation(p_token text)
returns table (company_name text, email text)
language sql stable security definer
set search_path = ''
as $$
  select coalesce(fd.trade_name, fd.legal_name_en), i.email
  from public.factory_invitations i
  join public.factory_details fd on fd.company_id = i.company_id
  where i.token_hash = public.invitation_hash(p_token)
    and i.accepted_at is null and i.revoked_at is null;
$$;
revoke execute on function public.get_factory_invitation(text) from public;
grant execute on function public.get_factory_invitation(text) to anon, authenticated;

-- Acepta la invitación: la cuenta recién creada con el correo invitado queda
-- como cuenta de esa fábrica. Un solo uso.
create or replace function public.accept_factory_invitation(p_token text, p_user uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inv public.factory_invitations;
  v_profile public.profiles;
  v_user auth.users;
begin
  select * into v_inv from public.factory_invitations
  where token_hash = public.invitation_hash(p_token) and accepted_at is null and revoked_at is null
  for update;
  if v_inv.id is null then raise exception 'invitation_invalid'; end if;

  select * into v_user from auth.users where id = p_user;
  select * into v_profile from public.profiles where id = p_user;
  if v_user.id is null or v_profile.id is null
     or v_profile.company_id is not null or v_profile.role <> 'buyer'
     or v_user.created_at < now() - interval '30 minutes' then
    raise exception 'not_allowed';
  end if;
  if lower(v_user.email) <> lower(v_inv.email) then raise exception 'email_mismatch'; end if;

  update public.profiles set role = 'factory', company_id = v_inv.company_id where id = p_user;
  update public.factory_invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;

  insert into public.notifications (user_id, type, payload)
  select p.id, 'factory_joined', jsonb_build_object('company_id', v_inv.company_id)
  from public.profiles p where p.role = 'admin';
  return v_inv.company_id;
end;
$$;
revoke execute on function public.accept_factory_invitation(text, uuid) from public;
grant execute on function public.accept_factory_invitation(text, uuid) to anon, authenticated;
