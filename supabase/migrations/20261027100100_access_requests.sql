-- Meridia Trade Hub · Etapa 9: solicitudes de acceso de compradores
-- El registro público solo permite solicitar acceso como empresa o persona natural.
-- Las fábricas las incorpora Meridia (ver la migración de red de fabricantes).

-- ---------------------------------------------------------------------------
-- Datos nuevos de la solicitud
-- ---------------------------------------------------------------------------
alter table public.buyer_details
  add column trade_name text,
  add column economic_activity text,
  add column company_type public.buyer_company_type,
  add column representative_authorized boolean not null default false,
  add column id_type public.id_document_type,
  add column id_number text,
  add column purchase_purpose text,
  add column destination_country text check (destination_country is null or destination_country ~ '^[A-Z]{2}$'),
  add column purchase_volume text;

-- La descripción mínima de 50 caracteres de la persona natural deja de ser regla
-- de tabla: ahora se piden otros datos y se validan al enviar.
alter table public.buyer_details drop constraint buyer_individual_required;

alter table public.company_contacts
  add column whatsapp text,
  add column city text,
  add column country text check (country is null or country ~ '^[A-Z]{2}$');

-- Frecuencia de compra: lista editable por el administrador.
create table public.purchase_frequencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  names jsonb not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.purchase_frequencies enable row level security;
create policy admin_all on public.purchase_frequencies for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy purchase_frequencies_read on public.purchase_frequencies for select to anon, authenticated using (active);

insert into public.purchase_frequencies (slug, names, sort_order) values
  ('one-time', '{"es": "Compra única"}', 10),
  ('per-project', '{"es": "Por proyecto"}', 20),
  ('monthly', '{"es": "Mensual"}', 30),
  ('quarterly', '{"es": "Trimestral"}', 40),
  ('semiannual', '{"es": "Semestral"}', 50),
  ('annual', '{"es": "Anual"}', 60);

alter table public.buyer_details add column purchase_frequency_id uuid references public.purchase_frequencies (id);

-- Categorías de interés del comprador.
create table public.buyer_categories (
  buyer_company_id uuid not null references public.companies (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (buyer_company_id, category_id)
);
create index buyer_categories_category_idx on public.buyer_categories (category_id);
alter table public.buyer_categories enable row level security;
create policy admin_all on public.buyer_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy buyer_categories_own_select on public.buyer_categories for select to authenticated
  using (buyer_company_id = public.my_company_id());
create policy buyer_categories_own_write on public.buyer_categories for all to authenticated
  using (buyer_company_id = public.my_company_id() and public.my_company_editable())
  with check (buyer_company_id = public.my_company_id() and public.my_company_editable());

-- 🔒 Observaciones internas del expediente: solo el administrador.
create table public.company_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  author_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index company_notes_company_idx on public.company_notes (company_id, created_at);
alter table public.company_notes enable row level security;
create policy admin_all on public.company_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Política de privacidad: versión 1 en borrador hasta que exista el texto definitivo.
insert into public.legal_documents (kind, version, content, is_draft) values
  ('privacy', 1, '{"es": "Texto en preparación. Meridia publicará aquí la política de privacidad definitiva."}', true)
on conflict (kind, version) do nothing;

-- ---------------------------------------------------------------------------
-- Registro público: toda cuenta nueva es compradora (solicitante).
-- 'admin' llega solo por app_metadata; las fábricas las crea Meridia por invitación.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role public.user_role := 'buyer';
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin' then
    v_role := 'admin';
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

-- Solo los compradores crean su propia ficha; la de una fábrica la crea Meridia.
create or replace function public.register_company(p_country text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_company uuid;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.role <> 'buyer' then
    raise exception 'not_allowed';
  end if;
  if v_profile.company_id is not null then
    return v_profile.company_id;
  end if;

  insert into public.companies (kind, country)
  values ('buyer', upper(p_country))
  returning id into v_company;

  update public.profiles set company_id = v_company where id = v_profile.id;
  return v_company;
end;
$$;

-- ---------------------------------------------------------------------------
-- Envío de la solicitud de acceso. Revalida en la base lo que la interfaz validó.
-- Los documentos son opcionales ("cuando corresponda"): Meridia los pide si hacen falta.
-- ---------------------------------------------------------------------------
create or replace function public.submit_company_for_review()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_buyer public.buyer_details;
  v_contact public.company_contacts;
  v_is_company boolean;
begin
  select * into v_company from public.companies where id = public.my_company_id();
  if v_company.id is null then raise exception 'missing:company'; end if;
  if v_company.kind <> 'buyer' then raise exception 'not_allowed'; end if;
  if v_company.status not in ('registered', 'info_requested') then raise exception 'not_editable'; end if;

  select * into v_buyer from public.buyer_details where company_id = v_company.id;
  if v_buyer.company_id is null then raise exception 'missing:details'; end if;
  v_is_company := v_buyer.account_type = 'company';
  if not v_is_company and not coalesce((public.setting('allow_individual_buyers'))::boolean, false) then
    raise exception 'individuals_not_allowed';
  end if;

  if v_is_company then
    if nullif(trim(coalesce(v_buyer.legal_name, '')), '') is null
       or nullif(trim(coalesce(v_buyer.trade_name, '')), '') is null
       or nullif(trim(coalesce(v_buyer.tax_id, '')), '') is null
       or nullif(trim(coalesce(v_buyer.economic_activity, '')), '') is null
       or v_company.sector_id is null then
      raise exception 'missing:details';
    end if;
  elsif nullif(trim(coalesce(v_buyer.full_name, '')), '') is null
     or v_buyer.id_type is null
     or nullif(trim(coalesce(v_buyer.id_number, '')), '') is null
     or nullif(trim(coalesce(v_buyer.economic_activity, '')), '') is null then
    raise exception 'missing:details';
  end if;

  select * into v_contact from public.company_contacts where company_id = v_company.id;
  if v_contact.company_id is null
     or nullif(trim(coalesce(v_contact.phone, '')), '') is null
     or nullif(trim(coalesce(v_contact.email, '')), '') is null
     or nullif(trim(coalesce(v_contact.whatsapp, '')), '') is null then
    raise exception 'missing:contact';
  end if;
  if v_is_company and (
    nullif(trim(coalesce(v_contact.contact_title, '')), '') is null
    or nullif(trim(coalesce(v_contact.city, '')), '') is null
    or v_contact.country is null
    or not v_buyer.representative_authorized
  ) then
    raise exception 'missing:contact';
  end if;

  if v_buyer.destination_country is null
     or nullif(trim(coalesce(v_buyer.purchase_volume, '')), '') is null
     or not exists (select 1 from public.buyer_categories where buyer_company_id = v_company.id)
     or (v_is_company and (v_buyer.company_type is null or v_buyer.purchase_frequency_id is null))
     or (not v_is_company and nullif(trim(coalesce(v_buyer.purchase_purpose, '')), '') is null) then
    raise exception 'missing:profile';
  end if;

  -- Debe haber aceptado la versión vigente de cada texto legal.
  if exists (
    select 1 from public.current_legal_documents() d
    where not exists (
      select 1 from public.legal_acceptances a where a.legal_document_id = d.id and a.user_id = auth.uid()
    )
  ) then
    raise exception 'missing:legal';
  end if;

  perform set_config('meridia.submitting', 'on', true);
  update public.companies set status = 'in_review' where id = v_company.id;
  perform set_config('meridia.submitting', 'off', true);

  -- Aviso a Meridia: nueva solicitud de acceso.
  insert into public.notifications (user_id, type, payload)
  select p.id, 'access_request', jsonb_build_object('company_id', v_company.id)
  from public.profiles p where p.role = 'admin';
end;
$$;
revoke execute on function public.submit_company_for_review() from public, anon;
grant execute on function public.submit_company_for_review() to authenticated;

-- ---------------------------------------------------------------------------
-- Revisión: recibida → en revisión → aprobada / información adicional / rechazada.
-- ---------------------------------------------------------------------------
create or replace function public.admin_review_company(
  p_company uuid,
  p_action public.company_review_action,
  p_message text default null,
  p_tier public.factory_tier default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_tier public.factory_tier;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_new public.company_status;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  select * into v_company from public.companies where id = p_company for update;
  if v_company.id is null then raise exception 'not_found'; end if;

  if p_action = 'start_review' then
    if v_company.status <> 'in_review' then raise exception 'invalid_transition'; end if;
    v_new := 'reviewing';
  elsif p_action = 'validate' then
    if v_company.status not in ('in_review', 'reviewing', 'suspended')
       and not (v_company.kind = 'factory' and v_company.status = 'registered') then
      raise exception 'invalid_transition';
    end if;
    if v_company.kind = 'factory' then
      select tier into v_tier from public.factory_admin where company_id = p_company;
      v_tier := coalesce(p_tier, v_tier);
      if v_tier is null then raise exception 'tier_required'; end if;
      if v_tier = 'standard' and not exists (
        select 1 from public.company_documents where company_id = p_company and kind = 'cn_business_license'
      ) then
        raise exception 'license_required';
      end if;
      insert into public.factory_admin (company_id, tier, updated_by)
      values (p_company, v_tier, auth.uid())
      on conflict (company_id) do update set tier = excluded.tier, updated_by = excluded.updated_by;
    end if;
    v_new := 'validated';
  elsif p_action = 'request_info' then
    if v_company.status not in ('in_review', 'reviewing') then raise exception 'invalid_transition'; end if;
    if v_message is null then raise exception 'message_required'; end if;
    v_new := 'info_requested';
  elsif p_action = 'reject' then
    if v_company.status not in ('in_review', 'reviewing', 'info_requested') then raise exception 'invalid_transition'; end if;
    if v_message is null then raise exception 'message_required'; end if;
    v_new := 'rejected';
  elsif p_action = 'suspend' then
    if v_company.status <> 'validated' then raise exception 'invalid_transition'; end if;
    if v_message is null then raise exception 'message_required'; end if;
    v_new := 'suspended';
  end if;

  perform set_config('meridia.status_note', coalesce(v_message, ''), true);
  update public.companies
  set status = v_new,
      validated_at = case when v_new = 'validated' then now() else validated_at end,
      validated_by = case when v_new = 'validated' then auth.uid() else validated_by end
  where id = p_company;
  perform set_config('meridia.status_note', '', true);

  insert into public.company_reviews (company_id, action, message, actor_id)
  values (p_company, p_action, v_message, auth.uid());

  insert into public.notifications (user_id, type, payload)
  select p.id, 'company_review', jsonb_build_object('action', p_action, 'status', v_new)
  from public.profiles p where p.company_id = p_company;
end;
$$;
revoke execute on function public.admin_review_company(uuid, public.company_review_action, text, public.factory_tier) from public, anon;
grant execute on function public.admin_review_company(uuid, public.company_review_action, text, public.factory_tier) to authenticated;

-- Alertas: "por revisar" incluye recibidas y en revisión.
create or replace function public.admin_alerts()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_company_hours numeric := (public.setting('pending_company_alert_hours') #>> '{}')::numeric;
  v_rfq_hours numeric := (public.setting('unanswered_rfq_alert_hours') #>> '{}')::numeric;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  return jsonb_build_object(
    'pending_company_hours', v_company_hours,
    'unanswered_rfq_hours', v_rfq_hours,
    'companies_in_review', (select count(*) from public.companies where status in ('in_review', 'reviewing')),
    'companies_overdue', case when v_company_hours is null then null else (
      select count(*) from public.companies
      where status in ('in_review', 'reviewing') and submitted_at < now() - make_interval(secs => v_company_hours * 3600)
    ) end,
    'rfqs_awaiting_quotes', (
      select count(*) from public.rfqs r
      where r.status = 'assigned'
        and not exists (select 1 from public.quotes q where q.rfq_id = r.id and q.status <> 'draft')
    ),
    'rfqs_overdue', case when v_rfq_hours is null then null else (
      select count(*) from public.rfqs r
      where r.status = 'assigned'
        and not exists (select 1 from public.quotes q where q.rfq_id = r.id and q.status <> 'draft')
        and (select min(a.assigned_at) from public.rfq_assignments a where a.rfq_id = r.id)
            < now() - make_interval(secs => v_rfq_hours * 3600)
    ) end,
    'rfqs_to_assign', (select count(*) from public.rfqs where status = 'submitted')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Un solicitante pendiente de aprobación no opera: no crea solicitudes de cotización.
-- ---------------------------------------------------------------------------
create or replace function public.my_company_validated()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies where id = public.my_company_id() and status = 'validated'
  );
$$;
revoke execute on function public.my_company_validated() from public, anon;
grant execute on function public.my_company_validated() to authenticated;

drop policy rfqs_buyer_insert on public.rfqs;
create policy rfqs_buyer_insert on public.rfqs for insert to authenticated
  with check (
    buyer_company_id = public.my_company_id()
    and created_by = auth.uid()
    and status = 'draft'
    and public.my_role() = 'buyer'
    and public.my_company_validated()
  );
