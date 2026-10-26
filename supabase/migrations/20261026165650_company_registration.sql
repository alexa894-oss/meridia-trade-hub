-- Meridia Trade Hub · Etapa 2: registro de empresas

-- ---------------------------------------------------------------------------
-- Sectores del comprador (lista editable por el administrador)
-- ---------------------------------------------------------------------------
create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  names jsonb not null, -- {"es": "...", "zh-CN": "..."}
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.sectors enable row level security;
create policy admin_all on public.sectors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy sectors_read on public.sectors for select to anon, authenticated using (active);

insert into public.sectors (slug, names, sort_order) values
  ('construction', '{"es": "Construcción"}', 10),
  ('architecture-design', '{"es": "Arquitectura y diseño"}', 20),
  ('distribution-hardware', '{"es": "Distribución y ferretería"}', 30),
  ('real-estate', '{"es": "Desarrollo inmobiliario"}', 40),
  ('hospitality', '{"es": "Hotelería"}', 50),
  ('other', '{"es": "Otro"}', 99);

-- El sector pasa de texto libre a la lista.
alter table public.companies drop column sector;
alter table public.companies add column sector_id uuid references public.sectors (id);

-- Categorías base (editables por el administrador).
insert into public.categories (slug, names, sort_order) values
  ('doors', '{"es": "Puertas"}', 10),
  ('windows', '{"es": "Ventanas"}', 20),
  ('flooring', '{"es": "Pisos"}', 30),
  ('wall-cladding', '{"es": "Revestimientos"}', 40),
  ('ceramics-porcelain', '{"es": "Cerámica y porcelanato"}', 50),
  ('sanitary-faucets', '{"es": "Sanitarios y grifería"}', 60),
  ('lighting', '{"es": "Iluminación"}', 70),
  ('kitchen-cabinets', '{"es": "Gabinetes y muebles de cocina"}', 80)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Textos legales: versión 1 en borrador hasta que exista el definitivo.
-- No es texto legal: solo marca el lugar mientras se redacta.
-- ---------------------------------------------------------------------------
insert into public.legal_documents (kind, version, content, is_draft) values
  ('terms', 1, '{"es": "Texto en preparación. Meridia publicará aquí los términos de uso definitivos."}', true),
  ('non_circumvention', 1, '{"es": "Texto en preparación. Meridia publicará aquí el acuerdo de no elusión definitivo."}', true)
on conflict (kind, version) do nothing;

create or replace function public.current_legal_documents()
returns setof public.legal_documents
language sql stable
set search_path = ''
as $$
  select distinct on (kind) * from public.legal_documents order by kind, version desc;
$$;
grant execute on function public.current_legal_documents() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: límites del bucket de documentos de empresa
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
where id = 'company-docs';

-- ---------------------------------------------------------------------------
-- Edición del registro: solo mientras la empresa está registrada o con
-- información pedida. En revisión, validada o rechazada queda bloqueada.
-- ---------------------------------------------------------------------------
create or replace function public.my_company_editable()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies
    where id = public.my_company_id() and status in ('registered', 'info_requested')
  );
$$;
revoke execute on function public.my_company_editable() from public, anon;
grant execute on function public.my_company_editable() to authenticated;

drop policy buyer_details_own on public.buyer_details;
create policy buyer_details_own_select on public.buyer_details for select to authenticated
  using (company_id = public.my_company_id());
create policy buyer_details_own_write on public.buyer_details for all to authenticated
  using (company_id = public.my_company_id() and public.my_company_editable())
  with check (company_id = public.my_company_id() and public.my_company_editable());

drop policy factory_details_own on public.factory_details;
create policy factory_details_own_select on public.factory_details for select to authenticated
  using (company_id = public.my_company_id());
create policy factory_details_own_write on public.factory_details for all to authenticated
  using (company_id = public.my_company_id() and public.my_company_editable())
  with check (company_id = public.my_company_id() and public.my_company_editable());

drop policy factory_categories_own on public.factory_categories;
create policy factory_categories_own_select on public.factory_categories for select to authenticated
  using (factory_company_id = public.my_company_id());
create policy factory_categories_own_write on public.factory_categories for all to authenticated
  using (factory_company_id = public.my_company_id() and public.my_company_editable())
  with check (factory_company_id = public.my_company_id() and public.my_company_editable());

drop policy company_contacts_own on public.company_contacts;
create policy company_contacts_own_select on public.company_contacts for select to authenticated
  using (company_id = public.my_company_id());
create policy company_contacts_own_write on public.company_contacts for all to authenticated
  using (company_id = public.my_company_id() and public.my_company_editable())
  with check (company_id = public.my_company_id() and public.my_company_editable());

drop policy company_documents_own_insert on public.company_documents;
create policy company_documents_own_insert on public.company_documents for insert to authenticated
  with check (company_id = public.my_company_id() and uploaded_by = auth.uid() and public.my_company_editable());
create policy company_documents_own_delete on public.company_documents for delete to authenticated
  using (company_id = public.my_company_id() and public.my_company_editable());

drop policy storage_company_docs_own_insert on storage.objects;
create policy storage_company_docs_own_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'company-docs'
    and public.storage_owner_id(name) = public.my_company_id()
    and public.my_company_editable()
  );

-- ---------------------------------------------------------------------------
-- Alta de la empresa: crea la fila y la vincula al perfil (el usuario no
-- puede escribir profiles.company_id directamente).
-- ---------------------------------------------------------------------------
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
  if v_profile.id is null or v_profile.role not in ('buyer', 'factory') then
    raise exception 'not_allowed';
  end if;
  if v_profile.company_id is not null then
    return v_profile.company_id;
  end if;

  insert into public.companies (kind, country)
  values (v_profile.role::text::public.company_kind, upper(p_country))
  returning id into v_company;

  update public.profiles set company_id = v_company where id = v_profile.id;
  return v_company;
end;
$$;
revoke execute on function public.register_company(text) from public, anon;
grant execute on function public.register_company(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Envío a revisión: el único camino de "registrada" a "en revisión".
-- Revalida en la base lo que la interfaz ya validó.
-- ---------------------------------------------------------------------------
create or replace function public.submit_company_for_review()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_buyer public.buyer_details;
  v_factory public.factory_details;
  v_contact public.company_contacts;
begin
  select * into v_company from public.companies where id = public.my_company_id();
  if v_company.id is null then raise exception 'missing:company'; end if;
  if v_company.status not in ('registered', 'info_requested') then raise exception 'not_editable'; end if;

  select * into v_contact from public.company_contacts where company_id = v_company.id;
  if v_contact.company_id is null
     or nullif(trim(v_contact.phone), '') is null
     or nullif(trim(v_contact.email), '') is null then
    raise exception 'missing:contact';
  end if;

  if v_company.kind = 'buyer' then
    select * into v_buyer from public.buyer_details where company_id = v_company.id;
    if v_buyer.company_id is null then raise exception 'missing:details'; end if;
    if v_buyer.account_type = 'individual'
       and not coalesce((public.setting('allow_individual_buyers'))::boolean, false) then
      raise exception 'individuals_not_allowed';
    end if;
    if v_buyer.account_type = 'company' and v_company.sector_id is null then
      raise exception 'missing:sector';
    end if;
    if not exists (
      select 1 from public.company_documents
      where company_id = v_company.id
        and kind = case v_buyer.account_type when 'company' then 'tax_registration' else 'id_document' end::public.company_document_kind
    ) then
      raise exception 'missing:document';
    end if;
  else
    select * into v_factory from public.factory_details where company_id = v_company.id;
    if v_factory.company_id is null then raise exception 'missing:details'; end if;
    if nullif(trim(v_contact.wechat), '') is null then raise exception 'missing:wechat'; end if;
    if nullif(trim(v_factory.capacity), '') is null or nullif(trim(v_factory.departure_port), '') is null then
      raise exception 'missing:production';
    end if;
    if not exists (select 1 from public.factory_categories where factory_company_id = v_company.id) then
      raise exception 'missing:categories';
    end if;
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
end;
$$;
revoke execute on function public.submit_company_for_review() from public, anon;
grant execute on function public.submit_company_for_review() to authenticated;

-- La empresa ya no puede pasar a revisión con un UPDATE directo: solo vía
-- submit_company_for_review (que activa meridia.submitting).
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

  if new.status is distinct from old.status then
    if not (
      old.status in ('registered', 'info_requested')
      and new.status = 'in_review'
      -- coalesce: sin la variable, current_setting devuelve NULL y "not (… NULL)" no dispararía la excepción.
      and coalesce(current_setting('meridia.submitting', true), '') = 'on'
    ) then
      raise exception 'Invalid company status change';
    end if;
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfil del comprador visible para la fábrica: sector desde la lista.
-- ---------------------------------------------------------------------------
drop function public.get_rfq_buyer_profile(uuid);
create function public.get_rfq_buyer_profile(p_rfq uuid)
returns table (
  country text,
  sector_slug text,
  sector_names jsonb,
  is_verified boolean,
  display_name text
)
language sql stable security definer
set search_path = ''
as $$
  select
    c.country,
    s.slug,
    s.names,
    c.status = 'validated',
    case
      when public.is_admin() or coalesce((public.setting('factory_sees_buyer_name'))::boolean, false)
        then coalesce(bd.legal_name, bd.full_name)
    end
  from public.rfqs r
  join public.companies c on c.id = r.buyer_company_id
  left join public.sectors s on s.id = c.sector_id
  left join public.buyer_details bd on bd.company_id = c.id
  where r.id = p_rfq
    and (public.is_admin() or public.is_assigned(p_rfq) or public.owns_rfq(p_rfq));
$$;
revoke execute on function public.get_rfq_buyer_profile(uuid) from public, anon;
grant execute on function public.get_rfq_buyer_profile(uuid) to authenticated;
