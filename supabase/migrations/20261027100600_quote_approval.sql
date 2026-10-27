-- Meridia Trade Hub · Etapa 9 (Parte C): Meridia revisa cada cotización antes de
-- presentarla al comprador. Enviada por la fábrica → "en revisión de Meridia" →
-- aprobada (el comprador la ve) u oculta con motivo.

alter table public.quotes
  add column approved_at timestamptz,
  add column approved_by uuid references auth.users (id);

create or replace function public.submit_quote(p_quote uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_rfq public.rfqs;
  v_found text;
begin
  select * into v_quote from public.quotes where id = p_quote for update;
  if v_quote.id is null or v_quote.factory_company_id is distinct from public.my_company_id() then raise exception 'not_found'; end if;
  if not public.is_assigned(v_quote.rfq_id) then raise exception 'not_found'; end if;
  if v_quote.status <> 'draft' then raise exception 'not_editable'; end if;

  select * into v_rfq from public.rfqs where id = v_quote.rfq_id for update;
  if v_rfq.status not in ('assigned', 'quoted', 'negotiating') then raise exception 'rfq_closed'; end if;

  -- Alternativa solo si el comprador la aceptó.
  if v_quote.offer_type = 'alternative' and not v_rfq.accepts_alternatives then raise exception 'alternative_not_accepted'; end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then raise exception 'validity_past'; end if;

  -- Un precio unitario por cada término que pidió el comprador (ni más ni menos).
  if exists (select unnest(v_rfq.incoterms) except select incoterm from public.quote_prices where quote_id = p_quote)
     or exists (select incoterm from public.quote_prices where quote_id = p_quote except select unnest(v_rfq.incoterms)) then
    raise exception 'prices_mismatch';
  end if;

  v_found := coalesce(
    public.find_contact_info(v_quote.alternative_differences),
    public.find_contact_info(v_quote.departure_port),
    public.find_contact_info(v_quote.deposit_timing),
    public.find_contact_info(v_quote.balance_timing)
  );
  if v_found is not null then raise exception 'contact_info:%', v_found; end if;

  perform set_config('meridia.quote_transition', 'on', true);
  -- Los CHECK de la tabla validan campos, pagos que suman 100 % y muestra.
  -- Queda en revisión de Meridia: el comprador todavía no la ve.
  update public.quotes set status = 'pending_approval', submitted_at = now() where id = p_quote;
  perform set_config('meridia.quote_transition', '', true);

  insert into public.notifications (user_id, type, payload)
  select p.id, 'quote_pending', jsonb_build_object('rfq_id', v_rfq.id, 'number', v_rfq.number)
  from public.profiles p where p.role = 'admin';
end;
$$;
revoke execute on function public.submit_quote(uuid) from public, anon;
grant execute on function public.submit_quote(uuid) to authenticated;

-- Meridia aprueba: la cotización pasa al comprador y la solicitud queda "con cotizaciones".
create or replace function public.admin_approve_quote(p_quote uuid, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_rfq public.rfqs;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into v_quote from public.quotes where id = p_quote for update;
  if v_quote.id is null then raise exception 'not_found'; end if;
  if v_quote.status <> 'pending_approval' then raise exception 'invalid_transition'; end if;
  select * into v_rfq from public.rfqs where id = v_quote.rfq_id for update;
  if v_rfq.status not in ('assigned', 'quoted', 'negotiating') then raise exception 'rfq_closed'; end if;

  perform set_config('meridia.status_note', coalesce(nullif(trim(p_note), ''), ''), true);
  perform set_config('meridia.quote_transition', 'on', true);
  update public.quotes set status = 'submitted', approved_at = now(), approved_by = auth.uid() where id = p_quote;
  perform set_config('meridia.quote_transition', '', true);
  perform set_config('meridia.status_note', '', true);

  if v_rfq.status = 'assigned' then
    perform set_config('meridia.rfq_transition', 'on', true);
    update public.rfqs set status = 'quoted' where id = v_rfq.id;
    perform set_config('meridia.rfq_transition', '', true);
  end if;

  insert into public.notifications (user_id, type, payload)
  select p.id, 'quote_received', jsonb_build_object('rfq_id', v_rfq.id, 'number', v_rfq.number)
  from public.profiles p where p.company_id = v_rfq.buyer_company_id;
  insert into public.notifications (user_id, type, payload)
  select p.id, 'quote_approved', jsonb_build_object('rfq_id', v_rfq.id, 'number', v_rfq.number)
  from public.profiles p where p.company_id = v_quote.factory_company_id;
end;
$$;
revoke execute on function public.admin_approve_quote(uuid, text) from public, anon;
grant execute on function public.admin_approve_quote(uuid, text) to authenticated;

-- El comprador nunca ve una cotización en revisión de Meridia.
drop policy quotes_buyer_select on public.quotes;
create policy quotes_buyer_select on public.quotes for select to authenticated
  using (public.owns_rfq(rfq_id) and status not in ('draft', 'hidden', 'pending_approval'));

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
        and q.status not in ('draft', 'hidden', 'pending_approval')
    );
$$;

-- Vencimiento: también las que esperan revisión.
create or replace function public.expire_quotes(p_rfq uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.owns_rfq(p_rfq) or public.is_assigned(p_rfq)) then return; end if;
  perform set_config('meridia.quote_transition', 'on', true);
  update public.quotes set status = 'expired'
  where rfq_id = p_rfq and status in ('pending_approval', 'submitted', 'reviewed', 'preferred') and valid_until < current_date;
  perform set_config('meridia.quote_transition', '', true);
end;
$$;

-- Alertas: cotizaciones esperando la revisión de Meridia.
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
    'rfqs_to_assign', (select count(*) from public.rfqs where status = 'submitted'),
    'quotes_pending', (select count(*) from public.quotes where status = 'pending_approval')
  );
end;
$$;
