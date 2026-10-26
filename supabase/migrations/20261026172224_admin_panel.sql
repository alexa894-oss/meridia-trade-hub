-- Meridia Trade Hub · Etapa 3: panel de administración

-- ---------------------------------------------------------------------------
-- Revisión de empresas: validar, pedir información, rechazar, suspender.
-- Una sola función para que el cambio de estado, el registro de la revisión,
-- la nota en el historial y la notificación ocurran juntos.
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

  if p_action = 'validate' then
    if v_company.status not in ('in_review', 'suspended') then raise exception 'invalid_transition'; end if;
    if v_company.kind = 'factory' then
      select tier into v_tier from public.factory_admin where company_id = p_company;
      v_tier := coalesce(p_tier, v_tier);
      if v_tier is null then raise exception 'tier_required'; end if;
      -- Decisión de la Etapa 2: el registro empresarial chino se exige al validar como estándar.
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
    if v_company.status <> 'in_review' then raise exception 'invalid_transition'; end if;
    if v_message is null then raise exception 'message_required'; end if;
    v_new := 'info_requested';
  elsif p_action = 'reject' then
    if v_company.status not in ('in_review', 'info_requested') then raise exception 'invalid_transition'; end if;
    if v_message is null then raise exception 'message_required'; end if;
    v_new := 'rejected';
  elsif p_action = 'suspend' then
    if v_company.status <> 'validated' then raise exception 'invalid_transition'; end if;
    if v_message is null then raise exception 'message_required'; end if;
    v_new := 'suspended';
  end if;

  -- La nota queda en status_history (la lee log_status_change).
  perform set_config('meridia.status_note', coalesce(v_message, ''), true);
  update public.companies
  set status = v_new,
      validated_at = case when v_new = 'validated' then now() else validated_at end,
      validated_by = case when v_new = 'validated' then auth.uid() else validated_by end
  where id = p_company;
  perform set_config('meridia.status_note', '', true);

  insert into public.company_reviews (company_id, action, message, actor_id)
  values (p_company, p_action, v_message, auth.uid());

  -- Aviso dentro de la plataforma para las cuentas de la empresa.
  insert into public.notifications (user_id, type, payload)
  select p.id, 'company_review', jsonb_build_object('action', p_action, 'status', v_new)
  from public.profiles p where p.company_id = p_company;
end;
$$;
revoke execute on function public.admin_review_company(uuid, public.company_review_action, text, public.factory_tier) from public, anon;
grant execute on function public.admin_review_company(uuid, public.company_review_action, text, public.factory_tier) to authenticated;

-- Una fábrica validada no puede quedar como estándar sin registro empresarial chino.
create or replace function public.check_factory_tier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tier = 'standard'
     and exists (select 1 from public.companies where id = new.company_id and status = 'validated')
     and not exists (
       select 1 from public.company_documents where company_id = new.company_id and kind = 'cn_business_license'
     ) then
    raise exception 'license_required';
  end if;
  return new;
end;
$$;
create trigger factory_admin_tier_check before insert or update of tier on public.factory_admin
  for each row execute function public.check_factory_tier();
revoke execute on function public.check_factory_tier() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Alertas del panel. Sin umbral configurado, la alerta queda inactiva.
-- "Sin respuesta": solicitud asignada a fábricas que no recibió ninguna
-- cotización enviada dentro del umbral (contado desde la primera asignación).
-- ---------------------------------------------------------------------------
create or replace function public.admin_alerts()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_company_hours numeric := (public.setting('pending_company_alert_hours') #>> '{}')::numeric; -- JSON null → NULL
  v_rfq_hours numeric := (public.setting('unanswered_rfq_alert_hours') #>> '{}')::numeric;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  return jsonb_build_object(
    'pending_company_hours', v_company_hours,
    'unanswered_rfq_hours', v_rfq_hours,
    'companies_in_review', (select count(*) from public.companies where status = 'in_review'),
    'companies_overdue', case when v_company_hours is null then null else (
      select count(*) from public.companies
      where status = 'in_review' and submitted_at < now() - make_interval(secs => v_company_hours * 3600)
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
revoke execute on function public.admin_alerts() from public, anon;
grant execute on function public.admin_alerts() to authenticated;

-- Los umbrales deben ser horas positivas o null.
alter table public.platform_settings add constraint platform_settings_thresholds check (
  key not in ('pending_company_alert_hours', 'unanswered_rfq_alert_hours')
  or value = 'null'::jsonb
  or (jsonb_typeof(value) = 'number' and (value)::text::numeric > 0)
);
alter table public.platform_settings add constraint platform_settings_booleans check (
  key not in ('factory_sees_buyer_name', 'buyer_sees_factory_tier', 'allow_individual_buyers')
  or jsonb_typeof(value) = 'boolean'
);
