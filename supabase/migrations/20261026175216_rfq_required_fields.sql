-- Meridia Trade Hub · Etapa 4: campos obligatorios al enviar la solicitud

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
  -- Solo la modalidad de carga es opcional: se exigen especificaciones e imagen (archivo o enlace).
  if nullif(trim(coalesce(v_rfq.technical_specs, '')), '') is null then raise exception 'missing:technical_specs'; end if;
  if v_rfq.reference_image_path is null and nullif(trim(coalesce(v_rfq.reference_url, '')), '') is null then
    raise exception 'missing:reference';
  end if;

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
