-- Meridia Trade Hub · Etapa 2: registro por pasos
-- "Web o brochure" deja de ser un CHECK de la tabla (impedía guardar el primer
-- paso) y se exige al enviar a revisión. El brochure es un documento subido.

alter table public.factory_details drop constraint factory_web_or_brochure;

create or replace function public.submit_company_for_review()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_buyer public.buyer_details;
  v_factory public.factory_details;
  v_contact public.company_contacts;
begin
  select * into v_company from public.companies where id = public.my_company_id();
  if v_company.id is null then raise exception 'missing:company'; end if;
  if v_company.status not in ('registered', 'info_requested') then raise exception 'not_editable'; end if;

  select * into v_contact from public.company_contacts where company_id = v_company.id;
  if v_contact.company_id is null
     or nullif(trim(v_contact.phone), '') is null
     or nullif(trim(v_contact.email), '') is null then
    raise exception 'missing:contact';
  end if;

  if v_company.kind = 'buyer' then
    select * into v_buyer from public.buyer_details where company_id = v_company.id;
    if v_buyer.company_id is null then raise exception 'missing:details'; end if;
    if v_buyer.account_type = 'individual'
       and not coalesce((public.setting('allow_individual_buyers'))::boolean, false) then
      raise exception 'individuals_not_allowed';
    end if;
    if v_buyer.account_type = 'company' and v_company.sector_id is null then
      raise exception 'missing:sector';
    end if;
    if not exists (
      select 1 from public.company_documents
      where company_id = v_company.id
        and kind = case v_buyer.account_type when 'company' then 'tax_registration' else 'id_document' end::public.company_document_kind
    ) then
      raise exception 'missing:document';
    end if;
  else
    select * into v_factory from public.factory_details where company_id = v_company.id;
    if v_factory.company_id is null then raise exception 'missing:details'; end if;
    if nullif(trim(v_contact.wechat), '') is null then raise exception 'missing:wechat'; end if;
    if nullif(trim(v_factory.capacity), '') is null or nullif(trim(v_factory.departure_port), '') is null then
      raise exception 'missing:production';
    end if;
    if not exists (select 1 from public.factory_categories where factory_company_id = v_company.id) then
      raise exception 'missing:categories';
    end if;
    if nullif(trim(v_factory.website), '') is null and not exists (
      select 1 from public.company_documents where company_id = v_company.id and kind = 'brochure'
    ) then
      raise exception 'missing:web_or_brochure';
    end if;
  end if;

  -- Debe haber aceptado la versión vigente de cada texto legal.
  if exists (
    select 1 from public.current_legal_documents() d
    where not exists (
      select 1 from public.legal_acceptances a where a.legal_document_id = d.id and a.user_id = auth.uid()
    )
  ) then
    raise exception 'missing:legal';
  end if;

  perform set_config('meridia.submitting', 'on', true);
  update public.companies set status = 'in_review' where id = v_company.id;
  perform set_config('meridia.submitting', 'off', true);
end;
$$;
revoke execute on function public.submit_company_for_review() from public, anon;
grant execute on function public.submit_company_for_review() to authenticated;
