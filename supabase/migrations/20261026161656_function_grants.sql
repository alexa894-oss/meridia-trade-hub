-- Meridia Trade Hub · Permisos de ejecución de funciones
-- Supabase concede EXECUTE a anon y authenticated por defecto. Lo restringimos:
--   * Funciones de trigger: nadie las llama por RPC (el trigger se ejecuta igual).
--   * Auxiliares de RLS: solo usuarios con sesión (las políticas las evalúan como el usuario).
--   * get_public_settings: pública a propósito (formulario de registro).

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_status_change() from public, anon, authenticated;
revoke execute on function public.set_message_sender() from public, anon, authenticated;
revoke execute on function public.guard_company_update() from public, anon, authenticated;
revoke execute on function public.guard_factory_verified_flags() from public, anon, authenticated;
revoke execute on function public.check_assignment_factory() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.my_company_id() from public, anon;
revoke execute on function public.my_role() from public, anon;
revoke execute on function public.owns_rfq(uuid) from public, anon;
revoke execute on function public.is_assigned(uuid) from public, anon;
revoke execute on function public.can_access_conversation(uuid) from public, anon;
revoke execute on function public.storage_owner_id(text) from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_company_id() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.owns_rfq(uuid) to authenticated;
grant execute on function public.is_assigned(uuid) to authenticated;
grant execute on function public.can_access_conversation(uuid) to authenticated;
grant execute on function public.storage_owner_id(text) to authenticated;
