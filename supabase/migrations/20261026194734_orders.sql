-- Meridia Trade Hub · Etapa 7: pedidos y comisión
-- Meridia no procesa pagos: la comisión solo se registra y el cobro se marca a mano.

-- Adjuntos de embarque: PDF o imagen, máximo 10 MB.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
where id = 'shipping-docs';

-- La fábrica puede quitar un documento suyo mientras el pedido no esté embarcado.
create policy order_documents_factory_delete on public.order_documents for delete to authenticated
  using (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_documents.order_id and o.factory_company_id = public.my_company_id()
        and o.status in ('confirmed', 'in_production', 'ready_to_ship')
    )
  );
create policy storage_shipping_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'shipping-docs'
    and exists (
      select 1 from public.orders o
      where o.id = public.storage_owner_id(name) and o.factory_company_id = public.my_company_id()
        and o.status in ('confirmed', 'in_production', 'ready_to_ship')
    )
  );

-- Una sola orden activa por solicitud (una rechazada libera la solicitud).
create unique index orders_one_active_per_rfq on public.orders (rfq_id) where status <> 'rejected';

-- ---------------------------------------------------------------------------
-- El estado del pedido y de la comisión solo cambia por estas funciones.
-- ---------------------------------------------------------------------------
create or replace function public.guard_order_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;
  if coalesce(current_setting('meridia.order_transition', true), '') <> 'on' then
    raise exception 'Orders change only through their actions';
  end if;
  return new;
end;
$$;
create trigger orders_guard before update on public.orders
  for each row execute function public.guard_order_update();
revoke execute on function public.guard_order_update() from public, anon, authenticated;

-- Aviso a todas las cuentas de una empresa (se usa desde las funciones de pedidos).
create or replace function public.notify_company(p_company uuid, p_type text, p_payload jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.notifications (user_id, type, payload)
  select p.id, p_type, p_payload from public.profiles p where p.company_id = p_company;
$$;
revoke execute on function public.notify_company(uuid, text, jsonb) from public, anon, authenticated;

-- El comprador genera la orden desde la cotización elegida.
create or replace function public.buyer_create_order(p_quote uuid, p_incoterm public.incoterm, p_quantity numeric)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_rfq public.rfqs;
  v_price numeric;
  v_order uuid;
begin
  select * into v_quote from public.quotes where id = p_quote for update;
  if v_quote.id is null or not public.owns_rfq(v_quote.rfq_id) then raise exception 'not_found'; end if;
  if v_quote.status not in ('submitted', 'reviewed', 'preferred') then raise exception 'quote_not_available'; end if;
  if v_quote.valid_until < current_date then raise exception 'quote_expired'; end if;

  select * into v_rfq from public.rfqs where id = v_quote.rfq_id for update;
  if v_rfq.status not in ('quoted', 'negotiating') then raise exception 'rfq_not_open'; end if;
  if exists (select 1 from public.orders where rfq_id = v_rfq.id and status <> 'rejected') then raise exception 'order_exists'; end if;

  select unit_price into v_price from public.quote_prices where quote_id = p_quote and incoterm = p_incoterm;
  if v_price is null then raise exception 'incoterm_not_quoted'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if v_quote.moq is not null and p_quantity < v_quote.moq then raise exception 'below_moq'; end if;

  insert into public.orders (quote_id, rfq_id, buyer_company_id, factory_company_id, created_by, incoterm, quantity, unit_price, currency, total_amount)
  values (p_quote, v_rfq.id, v_rfq.buyer_company_id, v_quote.factory_company_id, auth.uid(), p_incoterm, p_quantity, v_price, v_quote.currency, round(p_quantity * v_price, 2))
  returning id into v_order;

  perform set_config('meridia.quote_transition', 'on', true);
  update public.quotes set status = 'accepted' where id = p_quote;
  perform set_config('meridia.quote_transition', '', true);
  perform set_config('meridia.rfq_transition', 'on', true);
  update public.rfqs set status = 'order_created' where id = v_rfq.id;
  perform set_config('meridia.rfq_transition', '', true);

  perform public.notify_company(v_quote.factory_company_id, 'order_created', jsonb_build_object('order_id', v_order, 'number', v_rfq.number));
  return v_order;
end;
$$;
revoke execute on function public.buyer_create_order(uuid, public.incoterm, numeric) from public, anon;
grant execute on function public.buyer_create_order(uuid, public.incoterm, numeric) to authenticated;

-- La fábrica acepta (se registra la comisión), rechaza o avanza los hitos.
create or replace function public.factory_order_action(p_order uuid, p_action text, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_rate numeric;
  v_new public.order_status;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_number bigint;
begin
  select * into v_order from public.orders where id = p_order for update;
  if v_order.id is null or v_order.factory_company_id is distinct from public.my_company_id() then raise exception 'not_found'; end if;
  if not exists (select 1 from public.companies where id = v_order.factory_company_id and status = 'validated') then raise exception 'not_found'; end if;
  select number into v_number from public.rfqs where id = v_order.rfq_id;

  if p_action = 'accept' and v_order.status = 'sent' then
    select commission_rate into v_rate from public.factory_admin where company_id = v_order.factory_company_id;
    if v_rate is null then
      -- Aviso a Meridia: falta configurar la comisión pactada con esta fábrica.
      insert into public.notifications (user_id, type, payload)
      select p.id, 'commission_missing', jsonb_build_object('order_id', p_order, 'company_id', v_order.factory_company_id)
      from public.profiles p where p.role = 'admin';
      raise exception 'commission_not_configured';
    end if;
    v_new := 'confirmed';
    insert into public.commissions (order_id, factory_company_id, rate_pct, base_amount, amount, currency)
    values (p_order, v_order.factory_company_id, v_rate, v_order.total_amount, round(v_order.total_amount * v_rate / 100, 2), v_order.currency);
  elsif p_action = 'reject' and v_order.status = 'sent' then
    if v_reason is null then raise exception 'reason_required'; end if;
    v_new := 'rejected';
  elsif p_action = 'in_production' and v_order.status = 'confirmed' then
    v_new := 'in_production';
  elsif p_action = 'ready_to_ship' and v_order.status = 'in_production' then
    v_new := 'ready_to_ship';
  elsif p_action = 'shipped' and v_order.status = 'ready_to_ship' then
    if not exists (select 1 from public.order_documents where order_id = p_order and kind = 'commercial_invoice')
       or not exists (select 1 from public.order_documents where order_id = p_order and kind = 'bill_of_lading') then
      raise exception 'documents_required';
    end if;
    v_new := 'shipped';
  else
    raise exception 'invalid_transition';
  end if;

  perform set_config('meridia.status_note', coalesce(v_reason, ''), true);
  perform set_config('meridia.order_transition', 'on', true);
  update public.orders set status = v_new, rejection_reason = case when v_new = 'rejected' then v_reason else rejection_reason end where id = p_order;
  perform set_config('meridia.order_transition', '', true);
  perform set_config('meridia.status_note', '', true);

  -- Rechazada: la cotización y la solicitud vuelven a negociación.
  if v_new = 'rejected' then
    perform set_config('meridia.quote_transition', 'on', true);
    update public.quotes set status = 'discarded' where id = v_order.quote_id;
    perform set_config('meridia.quote_transition', '', true);
    perform set_config('meridia.rfq_transition', 'on', true);
    update public.rfqs set status = 'negotiating' where id = v_order.rfq_id;
    perform set_config('meridia.rfq_transition', '', true);
  end if;

  perform public.notify_company(v_order.buyer_company_id, 'order_status', jsonb_build_object('order_id', p_order, 'number', v_number, 'status', v_new));
end;
$$;
revoke execute on function public.factory_order_action(uuid, text, text) from public, anon;
grant execute on function public.factory_order_action(uuid, text, text) to authenticated;

-- El comprador confirma la recepción.
create or replace function public.buyer_confirm_receipt(p_order uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order for update;
  if v_order.id is null or v_order.buyer_company_id is distinct from public.my_company_id() then raise exception 'not_found'; end if;
  if v_order.status <> 'shipped' then raise exception 'invalid_transition'; end if;
  perform set_config('meridia.order_transition', 'on', true);
  update public.orders set status = 'delivered', received_confirmed_at = now() where id = p_order;
  perform set_config('meridia.order_transition', '', true);
  perform public.notify_company(v_order.factory_company_id, 'order_status', jsonb_build_object('order_id', p_order, 'status', 'delivered'));
end;
$$;
revoke execute on function public.buyer_confirm_receipt(uuid) from public, anon;
grant execute on function public.buyer_confirm_receipt(uuid) to authenticated;

-- Meridia cierra el pedido entregado.
create or replace function public.admin_close_order(p_order uuid, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.orders where id = p_order and status = 'delivered') then raise exception 'invalid_transition'; end if;
  perform set_config('meridia.status_note', coalesce(nullif(trim(p_note), ''), ''), true);
  update public.orders set status = 'closed' where id = p_order;
  perform set_config('meridia.status_note', '', true);
end;
$$;
revoke execute on function public.admin_close_order(uuid, text) from public, anon;
grant execute on function public.admin_close_order(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Comisiones: registrada → facturada → cobrada · vencida (marcadas a mano por
-- Meridia; "vencida" también se marca sola al pasar la fecha de vencimiento).
-- ---------------------------------------------------------------------------
create or replace function public.admin_commission_action(p_commission uuid, p_action text, p_invoiced_on date default null, p_due_date date default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_c public.commissions;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into v_c from public.commissions where id = p_commission for update;
  if v_c.id is null then raise exception 'not_found'; end if;

  if p_action = 'invoice' and v_c.status = 'registered' then
    update public.commissions set status = 'invoiced', invoiced_at = coalesce(p_invoiced_on, current_date)::timestamptz, due_date = p_due_date where id = p_commission;
  elsif p_action = 'paid' and v_c.status in ('invoiced', 'overdue') then
    update public.commissions set status = 'paid', paid_at = now(), paid_marked_by = auth.uid() where id = p_commission;
  elsif p_action = 'overdue' and v_c.status = 'invoiced' then
    update public.commissions set status = 'overdue' where id = p_commission;
  else
    raise exception 'invalid_transition';
  end if;
end;
$$;
revoke execute on function public.admin_commission_action(uuid, text, date, date) from public, anon;
grant execute on function public.admin_commission_action(uuid, text, date, date) to authenticated;

create or replace function public.mark_overdue_commissions()
returns void
language sql security definer
set search_path = ''
as $$
  update public.commissions set status = 'overdue'
  where status = 'invoiced' and due_date < current_date
    and (public.is_admin() or factory_company_id = public.my_company_id());
$$;
revoke execute on function public.mark_overdue_commissions() from public, anon;
grant execute on function public.mark_overdue_commissions() to authenticated;
