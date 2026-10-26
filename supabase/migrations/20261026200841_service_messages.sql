-- Meridia Trade Hub · Etapa 8: mensajes insertados con la clave de servicio
-- (datos de prueba, tareas internas): sin sesión, se respetan remitente y etiqueta.

create or replace function public.set_message_sender()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  if auth.uid() is not null then
    new.sender_id := auth.uid();
    select role into v_role from public.profiles where id = auth.uid();
    new.sender_kind := case v_role
      when 'admin' then 'meridia'
      when 'buyer' then 'buyer'
      when 'factory' then 'factory'
    end::public.message_sender_kind;
    if new.sender_kind is null then
      raise exception 'Unknown sender';
    end if;
  end if;
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end;
$$;
