-- Meridia Trade Hub · Etapa 8: volver a aceptar textos legales nuevos
-- Textos vigentes que el usuario actual todavía no aceptó.

create or replace function public.pending_legal_documents()
returns setof public.legal_documents
language sql stable security definer
set search_path = ''
as $$
  select d.* from public.current_legal_documents() d
  where auth.uid() is not null
    and not exists (
      select 1 from public.legal_acceptances a where a.legal_document_id = d.id and a.user_id = auth.uid()
    );
$$;
revoke execute on function public.pending_legal_documents() from public, anon;
grant execute on function public.pending_legal_documents() to authenticated;
