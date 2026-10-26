-- Meridia Trade Hub · Etapa 2: la empresa puede quitar archivos propios
-- mientras su registro es editable (para reemplazar un documento equivocado).

create policy storage_company_docs_own_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'company-docs'
    and public.storage_owner_id(name) = public.my_company_id()
    and public.my_company_editable()
  );
