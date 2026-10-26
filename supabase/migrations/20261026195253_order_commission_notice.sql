-- Meridia Trade Hub · Etapa 7: el aviso de comisión faltante no debe perderse

drop function public.factory_order_action(uuid, text, text);
-- La fábrica acepta (se registra la comisión), rechaza o avanza los hitos.
create function public.factory_order_action(p_order uuid, p_action text, p_reason text default null)
returns text
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
      -- Aviso a Meridia (una vez mientras siga sin leer). Se devuelve un código en vez
      -- de lanzar un error: una excepción desharía también el aviso.
      insert into public.notifications (user_id, type, payload)
      select p.id, 'commission_missing', jsonb_build_object('order_id', p_order, 'company_id', v_order.factory_company_id)
      from public.profiles p
      where p.role = 'admin'
        and not exists (
          select 1 from public.notifications n
          where n.user_id = p.id and n.type = 'commission_missing' and n.read_at is null
            and n.payload ->> 'order_id' = p_order::text
        );
      return 'commission_not_configured';
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
  return 'ok';
end;
$$;
revoke execute on function public.factory_order_action(uuid, text, text) from public, anon;
grant execute on function public.factory_order_action(uuid, text, text) to authenticated;
