-- Meridia Trade Hub · Etapa 5: cotizaciones y comparador

-- Una cotización por fábrica y solicitud.
create unique index quotes_rfq_factory_idx on public.quotes (rfq_id, factory_company_id);

-- Muestra: si hay muestra, costo y envío (gratis o con monto) son obligatorios.
alter table public.quotes add constraint quote_sample_details check (
  status = 'draft' or sample_available = false or (
    sample_cost is not null and sample_shipping_free is not null
    and (sample_shipping_free or sample_shipping_cost is not null)
  )
);
alter table public.quotes add column reviewed_at timestamptz;

-- ---------------------------------------------------------------------------
-- El estado de la cotización solo cambia por estas funciones.
-- ---------------------------------------------------------------------------
create or replace function public.guard_quote_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;
  if new.rfq_id is distinct from old.rfq_id or new.factory_company_id is distinct from old.factory_company_id then
    raise exception 'not_allowed';
  end if;
  if new.status is distinct from old.status
     and coalesce(current_setting('meridia.quote_transition', true), '') <> 'on' then
    raise exception 'Invalid quote status change';
  end if;
  return new;
end;
$$;
create trigger quotes_guard before update on public.quotes
  for each row execute function public.guard_quote_update();
revoke execute on function public.guard_quote_update() from public, anon, authenticated;

-- La fábrica envía su cotización. Se valida contra lo que pidió el comprador.
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
  update public.quotes set status = 'submitted', submitted_at = now() where id = p_quote;
  perform set_config('meridia.quote_transition', '', true);

  if v_rfq.status = 'assigned' then
    perform set_config('meridia.rfq_transition', 'on', true);
    update public.rfqs set status = 'quoted' where id = v_rfq.id;
    perform set_config('meridia.rfq_transition', '', true);
  end if;

  insert into public.notifications (user_id, type, payload)
  select p.id, 'quote_received', jsonb_build_object('rfq_id', v_rfq.id, 'number', v_rfq.number)
  from public.profiles p where p.company_id = v_rfq.buyer_company_id;
end;
$$;
revoke execute on function public.submit_quote(uuid) from public, anon;
grant execute on function public.submit_quote(uuid) to authenticated;

-- Vencimiento: se marca al leer (no hay tareas programadas en la fase 1).
create or replace function public.expire_quotes(p_rfq uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.owns_rfq(p_rfq) or public.is_assigned(p_rfq)) then return; end if;
  perform set_config('meridia.quote_transition', 'on', true);
  update public.quotes set status = 'expired'
  where rfq_id = p_rfq and status in ('submitted', 'reviewed', 'preferred') and valid_until < current_date;
  perform set_config('meridia.quote_transition', '', true);
end;
$$;
revoke execute on function public.expire_quotes(uuid) from public, anon;
grant execute on function public.expire_quotes(uuid) to authenticated;

-- "Revisada" = el comprador ya la vio en el comparador.
create or replace function public.mark_quotes_reviewed(p_rfq uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.owns_rfq(p_rfq) then return; end if;
  perform set_config('meridia.quote_transition', 'on', true);
  update public.quotes set status = 'reviewed', reviewed_at = now()
  where rfq_id = p_rfq and status = 'submitted';
  perform set_config('meridia.quote_transition', '', true);
end;
$$;
revoke execute on function public.mark_quotes_reviewed(uuid) from public, anon;
grant execute on function public.mark_quotes_reviewed(uuid) to authenticated;

-- Acciones del comprador: marcar preferida, quitar preferencia o descartar.
create or replace function public.buyer_quote_action(p_quote uuid, p_action text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_rfq public.rfqs;
  v_new public.quote_status;
begin
  select * into v_quote from public.quotes where id = p_quote for update;
  if v_quote.id is null or not public.owns_rfq(v_quote.rfq_id) then raise exception 'not_found'; end if;
  select * into v_rfq from public.rfqs where id = v_quote.rfq_id for update;
  if v_rfq.status in ('closed', 'order_created') then raise exception 'rfq_closed'; end if;

  if p_action = 'prefer' and v_quote.status in ('submitted', 'reviewed') then
    v_new := 'preferred';
  elsif p_action = 'unprefer' and v_quote.status = 'preferred' then
    v_new := 'reviewed';
  elsif p_action = 'discard' and v_quote.status in ('submitted', 'reviewed', 'preferred') then
    v_new := 'discarded';
  else
    raise exception 'invalid_transition';
  end if;

  perform set_config('meridia.quote_transition', 'on', true);
  update public.quotes set status = v_new, reviewed_at = coalesce(reviewed_at, now()) where id = p_quote;
  perform set_config('meridia.quote_transition', '', true);

  -- Marcar una preferida abre la negociación.
  if v_new = 'preferred' and v_rfq.status = 'quoted' then
    perform set_config('meridia.rfq_transition', 'on', true);
    update public.rfqs set status = 'negotiating' where id = v_rfq.id;
    perform set_config('meridia.rfq_transition', '', true);
  end if;
end;
$$;
revoke execute on function public.buyer_quote_action(uuid, text) from public, anon;
grant execute on function public.buyer_quote_action(uuid, text) to authenticated;

-- El administrador oculta cotizaciones que incumplen reglas (con motivo) o las restaura.
create or replace function public.admin_hide_quote(p_quote uuid, p_hide boolean, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into v_quote from public.quotes where id = p_quote for update;
  if v_quote.id is null then raise exception 'not_found'; end if;

  perform set_config('meridia.status_note', coalesce(v_reason, ''), true);
  if p_hide then
    if v_quote.status in ('draft', 'hidden', 'accepted') then raise exception 'invalid_transition'; end if;
    if v_reason is null then raise exception 'message_required'; end if;
    update public.quotes set status = 'hidden', hidden_reason = v_reason, hidden_by = auth.uid() where id = p_quote;
    insert into public.notifications (user_id, type, payload)
    select p.id, 'quote_hidden', jsonb_build_object('rfq_id', v_quote.rfq_id)
    from public.profiles p where p.company_id = v_quote.factory_company_id;
  else
    if v_quote.status <> 'hidden' then raise exception 'invalid_transition'; end if;
    update public.quotes set status = 'submitted', hidden_reason = null, hidden_by = null where id = p_quote;
  end if;
  perform set_config('meridia.status_note', '', true);
end;
$$;
revoke execute on function public.admin_hide_quote(uuid, boolean, text) from public, anon;
grant execute on function public.admin_hide_quote(uuid, boolean, text) to authenticated;

-- La cotización enviada ya no se edita: precios solo en borrador (política existente)
-- y la fábrica solo actualiza su borrador.
drop policy quotes_factory_update on public.quotes;
create policy quotes_factory_update on public.quotes for update to authenticated
  using (factory_company_id = public.my_company_id() and public.is_assigned(rfq_id) and status = 'draft')
  with check (factory_company_id = public.my_company_id());
