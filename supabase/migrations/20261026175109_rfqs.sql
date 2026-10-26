-- Meridia Trade Hub · Etapa 4: solicitudes de cotización

-- ---------------------------------------------------------------------------
-- Unidades (lista editable por el administrador)
-- ---------------------------------------------------------------------------
create table public.units (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  names jsonb not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.units enable row level security;
create policy admin_all on public.units for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy units_read on public.units for select to anon, authenticated using (active);

insert into public.units (slug, names, sort_order) values
  ('units', '{"es": "Unidades"}', 10),
  ('pieces', '{"es": "Piezas"}', 20),
  ('square-meters', '{"es": "m²"}', 30),
  ('linear-meters', '{"es": "Metros lineales"}', 40),
  ('sets', '{"es": "Juegos"}', 50),
  ('containers', '{"es": "Contenedores"}', 60);

-- La unidad pasa de texto libre a la lista; número legible para referirse a la solicitud.
alter table public.rfqs drop constraint rfq_required_when_submitted;
alter table public.rfqs drop column unit;
alter table public.rfqs add column unit_id uuid references public.units (id);
alter table public.rfqs add column number bigint generated always as identity;
create unique index rfqs_number_idx on public.rfqs (number);
alter table public.rfqs add constraint rfq_required_when_submitted check (
  status = 'draft' or (
    product is not null and category_id is not null and description is not null
    and quantity is not null and unit_id is not null and destination_country is not null
    and deadline is not null and cardinality(incoterms) >= 1
  )
);
alter table public.rfqs add constraint rfq_product_present check (nullif(trim(product), '') is not null);

-- Adjuntos de solicitudes: imágenes o PDF, máximo 10 MB.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
where id = 'rfq-attachments';

create policy storage_rfq_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'rfq-attachments'
    and public.owns_rfq(public.storage_owner_id(name))
    and exists (
      select 1 from public.rfqs r
      where r.id = public.storage_owner_id(name) and r.status in ('draft', 'info_requested')
    )
  );

-- ---------------------------------------------------------------------------
-- Datos de contacto en texto libre (teléfono, correo, WeChat).
-- La interfaz usa la misma lógica (src/lib/contact-detection.ts).
-- ---------------------------------------------------------------------------
create or replace function public.find_contact_info(p_text text)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  m text[];
begin
  if p_text is null then return null; end if;
  -- Correo
  m := regexp_match(p_text, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}');
  if m is not null then return m[1]; end if;
  -- WeChat
  m := regexp_match(p_text, '((微信|wechat|weixin|wxid_)[^\n]{0,30})', 'i');
  if m is not null then return m[1]; end if;
  m := regexp_match(p_text, '(\m(wx|vx)\s*[:：]\s*\S+)', 'i');
  if m is not null then return m[1]; end if;
  -- Teléfono: 8 a 15 dígitos con separadores habituales. Se descartan fechas
  -- (2026-12-31) y cantidades con punto o coma (1.200.000), salvo que empiece con +.
  for m in select regexp_matches(p_text, '(\+?\d[\d\s().-]{6,}\d)', 'g') loop
    if length(regexp_replace(m[1], '\D', '', 'g')) between 8 and 15
       and (
         m[1] like '+%'
         or (m[1] !~ '[.,]' and m[1] !~ '^\d{4}-\d{1,2}-\d{1,2}$')
       ) then
      return m[1];
    end if;
  end loop;
  return null;
end;
$$;
grant execute on function public.find_contact_info(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Una fábrica suspendida pierde acceso a sus oportunidades.
-- ---------------------------------------------------------------------------
create or replace function public.is_assigned(p_rfq uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rfq_assignments a
    join public.companies c on c.id = a.factory_company_id
    where a.rfq_id = p_rfq and a.factory_company_id = public.my_company_id() and c.status = 'validated'
  );
$$;

-- ---------------------------------------------------------------------------
-- El estado de la solicitud solo cambia por estas funciones.
-- ---------------------------------------------------------------------------
create or replace function public.guard_rfq_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;
  if new.buyer_company_id is distinct from old.buyer_company_id or new.created_by is distinct from old.created_by then
    raise exception 'not_allowed';
  end if;
  if new.status is distinct from old.status
     and coalesce(current_setting('meridia.rfq_transition', true), '') <> 'on' then
    raise exception 'Invalid request status change';
  end if;
  return new;
end;
$$;
create trigger rfqs_guard before update on public.rfqs
  for each row execute function public.guard_rfq_update();
revoke execute on function public.guard_rfq_update() from public, anon, authenticated;

-- El comprador envía su solicitud a Meridia (solo con la empresa validada).
create or replace function public.submit_rfq(p_rfq uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rfq public.rfqs;
  v_found text;
begin
  select * into v_rfq from public.rfqs where id = p_rfq for update;
  if v_rfq.id is null or v_rfq.buyer_company_id is distinct from public.my_company_id() then raise exception 'not_found'; end if;
  if v_rfq.status not in ('draft', 'info_requested') then raise exception 'not_editable'; end if;
  if not exists (select 1 from public.companies where id = v_rfq.buyer_company_id and status = 'validated') then
    raise exception 'company_not_validated';
  end if;
  if v_rfq.deadline is not null and v_rfq.deadline <= current_date then raise exception 'deadline_past'; end if;

  v_found := coalesce(
    public.find_contact_info(v_rfq.product),
    public.find_contact_info(v_rfq.description),
    public.find_contact_info(v_rfq.technical_specs),
    public.find_contact_info(v_rfq.destination_port)
  );
  if v_found is not null then raise exception 'contact_info:%', v_found; end if;

  perform set_config('meridia.rfq_transition', 'on', true);
  -- Los CHECK de la tabla validan los campos obligatorios al salir de borrador.
  update public.rfqs set status = 'submitted', submitted_at = now() where id = p_rfq;
  perform set_config('meridia.rfq_transition', '', true);
end;
$$;
revoke execute on function public.submit_rfq(uuid) from public, anon;
grant execute on function public.submit_rfq(uuid) to authenticated;

-- Acciones del administrador: pedir información o cerrar (con mensaje).
create or replace function public.admin_rfq_action(p_rfq uuid, p_action text, p_message text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rfq public.rfqs;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_new public.rfq_status;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into v_rfq from public.rfqs where id = p_rfq for update;
  if v_rfq.id is null then raise exception 'not_found'; end if;
  if v_message is null then raise exception 'message_required'; end if;

  if p_action = 'request_info' then
    if v_rfq.status <> 'submitted' then raise exception 'invalid_transition'; end if;
    v_new := 'info_requested';
  elsif p_action = 'close' then
    if v_rfq.status in ('closed', 'draft') then raise exception 'invalid_transition'; end if;
    v_new := 'closed';
  else
    raise exception 'invalid_transition';
  end if;

  perform set_config('meridia.status_note', v_message, true);
  update public.rfqs set status = v_new where id = p_rfq;
  perform set_config('meridia.status_note', '', true);

  insert into public.notifications (user_id, type, payload)
  select p.id, 'rfq_status', jsonb_build_object('rfq_id', p_rfq, 'number', v_rfq.number, 'status', v_new)
  from public.profiles p where p.company_id = v_rfq.buyer_company_id;
end;
$$;
revoke execute on function public.admin_rfq_action(uuid, text, text) from public, anon;
grant execute on function public.admin_rfq_action(uuid, text, text) to authenticated;

-- El administrador asigna fábricas validadas. La primera asignación pasa la
-- solicitud a "asignada"; las fábricas reciben la oportunidad y un aviso.
create or replace function public.admin_assign_rfq(p_rfq uuid, p_factories uuid[])
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rfq public.rfqs;
  v_added int;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into v_rfq from public.rfqs where id = p_rfq for update;
  if v_rfq.id is null then raise exception 'not_found'; end if;
  if v_rfq.status in ('draft', 'info_requested', 'closed', 'order_created') then raise exception 'invalid_transition'; end if;
  if coalesce(cardinality(p_factories), 0) = 0 then raise exception 'factories_required'; end if;

  with inserted as (
    insert into public.rfq_assignments (rfq_id, factory_company_id, assigned_by)
    select p_rfq, f, auth.uid() from unnest(p_factories) as f
    on conflict (rfq_id, factory_company_id) do nothing
    returning factory_company_id
  ), notified as (
    insert into public.notifications (user_id, type, payload)
    select p.id, 'rfq_assigned', jsonb_build_object('rfq_id', p_rfq, 'number', v_rfq.number)
    from public.profiles p join inserted i on i.factory_company_id = p.company_id
    returning 1
  )
  select count(*) into v_added from inserted;

  if v_rfq.status = 'submitted' and v_added > 0 then
    update public.rfqs set status = 'assigned' where id = p_rfq;
  end if;
  return v_added;
end;
$$;
revoke execute on function public.admin_assign_rfq(uuid, uuid[]) from public, anon;
grant execute on function public.admin_assign_rfq(uuid, uuid[]) to authenticated;

-- Quitar una asignación mientras esa fábrica no haya cotizado.
create or replace function public.admin_unassign_rfq(p_rfq uuid, p_factory uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if exists (select 1 from public.quotes where rfq_id = p_rfq and factory_company_id = p_factory and status <> 'draft') then
    raise exception 'has_quote';
  end if;
  delete from public.quotes where rfq_id = p_rfq and factory_company_id = p_factory and status = 'draft';
  delete from public.rfq_assignments where rfq_id = p_rfq and factory_company_id = p_factory;
  if not exists (select 1 from public.rfq_assignments where rfq_id = p_rfq) then
    update public.rfqs set status = 'submitted' where id = p_rfq and status = 'assigned';
  end if;
end;
$$;
revoke execute on function public.admin_unassign_rfq(uuid, uuid) from public, anon;
grant execute on function public.admin_unassign_rfq(uuid, uuid) to authenticated;

-- El borrador se puede borrar; el comprador no puede crear con otro estado.
drop policy rfqs_buyer_update on public.rfqs;
create policy rfqs_buyer_update on public.rfqs for update to authenticated
  using (buyer_company_id = public.my_company_id() and status in ('draft', 'info_requested'))
  with check (buyer_company_id = public.my_company_id());
