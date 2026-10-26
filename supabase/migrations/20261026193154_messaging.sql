-- Meridia Trade Hub · Etapa 6: mensajería

-- ---------------------------------------------------------------------------
-- Abrir (o recuperar) la conversación de una solicitud con una fábrica.
-- Participan el comprador, la fábrica asignada y Meridia.
-- ---------------------------------------------------------------------------
create or replace function public.open_conversation(p_rfq uuid, p_factory uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.rfq_assignments where rfq_id = p_rfq and factory_company_id = p_factory) then
    raise exception 'not_assigned';
  end if;
  if not (
    public.is_admin()
    or public.owns_rfq(p_rfq)
    or (p_factory = public.my_company_id() and public.is_assigned(p_rfq))
  ) then
    raise exception 'not_allowed';
  end if;

  insert into public.conversations (rfq_id, factory_company_id)
  values (p_rfq, p_factory)
  on conflict (rfq_id, factory_company_id) do nothing;
  select id into v_id from public.conversations where rfq_id = p_rfq and factory_company_id = p_factory;
  return v_id;
end;
$$;
revoke execute on function public.open_conversation(uuid, uuid) from public, anon;
grant execute on function public.open_conversation(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ningún teléfono, correo ni WeChat en mensajes de comprador o fábrica.
-- (Meridia puede escribir lo que necesite.)
-- ---------------------------------------------------------------------------
create or replace function public.check_message_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_found text;
begin
  if public.is_admin() then return new; end if;
  v_found := public.find_contact_info(new.body);
  if v_found is not null then raise exception 'contact_info:%', v_found; end if;
  return new;
end;
$$;
create trigger messages_check_contact before insert or update of body on public.messages
  for each row execute function public.check_message_contact();
revoke execute on function public.check_message_contact() from public, anon, authenticated;

-- Aviso dentro de la plataforma para los demás participantes.
create or replace function public.notify_new_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_rfq public.rfqs;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  select * into v_rfq from public.rfqs where id = v_conv.rfq_id;

  insert into public.notifications (user_id, type, payload)
  select p.id, 'message', jsonb_build_object(
    'conversation_id', v_conv.id, 'rfq_id', v_rfq.id, 'number', v_rfq.number, 'from', new.sender_kind
  )
  from public.profiles p
  where p.id <> new.sender_id
    and (p.company_id = v_rfq.buyer_company_id or p.company_id = v_conv.factory_company_id);
  return new;
end;
$$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_new_message();
revoke execute on function public.notify_new_message() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lista de conversaciones con nombres seguros según quién mira:
--   comprador → nombre de la fábrica; fábrica → comprador según configuración
--   (por defecto solo sector y país); Meridia → ambos. Nunca datos de contacto.
-- ---------------------------------------------------------------------------
create or replace function public.list_my_conversations(p_conversation uuid default null)
returns table (
  id uuid,
  rfq_id uuid,
  rfq_number bigint,
  rfq_product text,
  rfq_status public.rfq_status,
  factory_company_id uuid,
  factory_name text,
  buyer_name text,
  buyer_country text,
  buyer_sector jsonb,
  last_message_at timestamptz,
  last_message text,
  last_sender public.message_sender_kind,
  unread int
)
language sql stable security definer
set search_path = ''
as $$
  select
    c.id,
    r.id,
    r.number,
    r.product,
    r.status,
    c.factory_company_id,
    case when public.is_admin() or public.owns_rfq(r.id) or c.factory_company_id = public.my_company_id()
      then fd.legal_name_en end,
    case
      when public.is_admin() or public.owns_rfq(r.id)
        or coalesce((public.setting('factory_sees_buyer_name'))::boolean, false)
      then coalesce(bd.legal_name, bd.full_name)
    end,
    bc.country,
    s.names,
    c.last_message_at,
    lm.body,
    lm.sender_kind,
    (
      select count(*)::int from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(
          (select cr.last_read_at from public.conversation_reads cr where cr.conversation_id = c.id and cr.user_id = auth.uid()),
          '-infinity'::timestamptz
        )
    )
  from public.conversations c
  join public.rfqs r on r.id = c.rfq_id
  join public.companies bc on bc.id = r.buyer_company_id
  left join public.sectors s on s.id = bc.sector_id
  left join public.buyer_details bd on bd.company_id = bc.id
  left join public.factory_details fd on fd.company_id = c.factory_company_id
  left join lateral (
    select m.body, m.sender_kind from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where public.can_access_conversation(c.id)
    and (p_conversation is null or c.id = p_conversation)
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;
revoke execute on function public.list_my_conversations(uuid) from public, anon;
grant execute on function public.list_my_conversations(uuid) to authenticated;

-- Marcar como leída (para el contador de no leídos).
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.can_access_conversation(p_conversation) then return; end if;
  insert into public.conversation_reads (user_id, conversation_id, last_read_at)
  values (auth.uid(), p_conversation, now())
  on conflict (user_id, conversation_id) do update set last_read_at = excluded.last_read_at;
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and type = 'message'
    and payload ->> 'conversation_id' = p_conversation::text;
end;
$$;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Adjuntos: imágenes o PDF, máximo 10 MB.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
where id = 'message-attachments';
