-- Meridia Trade Hub · Datos que cruzan entre partes, Storage y Realtime

-- ---------------------------------------------------------------------------
-- Lo que la fábrica ve del comprador de una solicitud asignada:
-- sector y país; el nombre solo si el administrador lo habilita.
-- Nunca hay columnas de contacto.
-- ---------------------------------------------------------------------------
create or replace function public.get_rfq_buyer_profile(p_rfq uuid)
returns table (
  country text,
  sector text,
  is_verified boolean,
  display_name text
)
language sql stable security definer
set search_path = ''
as $$
  select
    c.country,
    c.sector,
    c.status = 'validated',
    case
      when public.is_admin() or coalesce((public.setting('factory_sees_buyer_name'))::boolean, false)
        then coalesce(bd.legal_name, bd.full_name)
    end
  from public.rfqs r
  join public.companies c on c.id = r.buyer_company_id
  left join public.buyer_details bd on bd.company_id = c.id
  where r.id = p_rfq
    and (public.is_admin() or public.is_assigned(p_rfq) or public.owns_rfq(p_rfq));
$$;

-- ---------------------------------------------------------------------------
-- Lo que el comprador ve de las fábricas que cotizaron su solicitud.
-- Año y ventas solo si están verificados; tipo VIP solo si el admin lo habilita.
-- ---------------------------------------------------------------------------
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
    fd.legal_name_en,
    fd.legal_name_zh,
    fd.city,
    fd.province,
    c.status = 'validated',
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

-- Ajustes públicos (p. ej. si se aceptan personas naturales en el registro).
create or replace function public.get_public_settings()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from public.platform_settings where is_public;
$$;

revoke execute on function public.get_rfq_buyer_profile(uuid) from public, anon;
revoke execute on function public.get_rfq_factory_profiles(uuid) from public, anon;
grant execute on function public.get_rfq_buyer_profile(uuid) to authenticated;
grant execute on function public.get_rfq_factory_profiles(uuid) to authenticated;
grant execute on function public.get_public_settings() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage privado. Convención de rutas: <id de la entidad dueña>/<archivo>
--   company-docs/<company_id>/...
--   rfq-attachments/<rfq_id>/...
--   message-attachments/<conversation_id>/...
--   shipping-docs/<order_id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('company-docs', 'company-docs', false),
  ('rfq-attachments', 'rfq-attachments', false),
  ('message-attachments', 'message-attachments', false),
  ('shipping-docs', 'shipping-docs', false)
on conflict (id) do nothing;

create or replace function public.storage_owner_id(p_name text)
returns uuid
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := split_part(p_name, '/', 1);
begin
  if v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v::uuid;
  end if;
  return null;
end;
$$;

create policy storage_admin_all on storage.objects for all to authenticated
  using (
    bucket_id in ('company-docs', 'rfq-attachments', 'message-attachments', 'shipping-docs')
    and public.is_admin()
  )
  with check (
    bucket_id in ('company-docs', 'rfq-attachments', 'message-attachments', 'shipping-docs')
    and public.is_admin()
  );

create policy storage_company_docs_own_read on storage.objects for select to authenticated
  using (bucket_id = 'company-docs' and public.storage_owner_id(name) = public.my_company_id());
create policy storage_company_docs_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'company-docs' and public.storage_owner_id(name) = public.my_company_id());

create policy storage_rfq_read on storage.objects for select to authenticated
  using (
    bucket_id = 'rfq-attachments'
    and (public.owns_rfq(public.storage_owner_id(name)) or public.is_assigned(public.storage_owner_id(name)))
  );
create policy storage_rfq_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'rfq-attachments' and public.owns_rfq(public.storage_owner_id(name)));

create policy storage_message_read on storage.objects for select to authenticated
  using (bucket_id = 'message-attachments' and public.can_access_conversation(public.storage_owner_id(name)));
create policy storage_message_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'message-attachments' and public.can_access_conversation(public.storage_owner_id(name)));

create policy storage_shipping_read on storage.objects for select to authenticated
  using (
    bucket_id = 'shipping-docs'
    and exists (select 1 from public.orders o where o.id = public.storage_owner_id(name))
  );
create policy storage_shipping_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shipping-docs'
    and exists (
      select 1 from public.orders o
      where o.id = public.storage_owner_id(name) and o.factory_company_id = public.my_company_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime (respeta RLS): mensajes y notificaciones
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
