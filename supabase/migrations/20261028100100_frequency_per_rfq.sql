-- La frecuencia de compra sale del registro inicial y pasa a cada pedido (RFQ): depende del
-- producto. La solicitud de acceso ya no la exige; las solicitudes que la tenían la conservan.

alter table public.rfqs add column purchase_frequency_id uuid references public.purchase_frequencies (id);

update public.purchase_frequencies set names = '{"es": "Una sola vez"}' where slug = 'one-time';

create or replace function public.buyer_application_error(p_company uuid, p_user uuid)
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_buyer public.buyer_details;
  v_contact public.company_contacts;
  v_is_company boolean;
begin
  select * into v_company from public.companies where id = p_company;
  if v_company.id is null then return 'missing:company'; end if;
  if v_company.kind <> 'buyer' then return 'not_allowed'; end if;

  select * into v_buyer from public.buyer_details where company_id = v_company.id;
  if v_buyer.company_id is null then return 'missing:details'; end if;
  v_is_company := v_buyer.account_type = 'company';
  if not v_is_company and not coalesce((public.setting('allow_individual_buyers'))::boolean, false) then
    return 'individuals_not_allowed';
  end if;

  if v_is_company then
    if nullif(trim(coalesce(v_buyer.legal_name, '')), '') is null
       or nullif(trim(coalesce(v_buyer.trade_name, '')), '') is null
       or nullif(trim(coalesce(v_buyer.tax_id, '')), '') is null
       or nullif(trim(coalesce(v_buyer.economic_activity, '')), '') is null
       or v_company.sector_id is null then
      return 'missing:details';
    end if;
  elsif nullif(trim(coalesce(v_buyer.full_name, '')), '') is null
     or v_buyer.id_type is null
     or nullif(trim(coalesce(v_buyer.id_number, '')), '') is null
     or nullif(trim(coalesce(v_buyer.economic_activity, '')), '') is null then
    return 'missing:details';
  end if;

  select * into v_contact from public.company_contacts where company_id = v_company.id;
  if v_contact.company_id is null
     or nullif(trim(coalesce(v_contact.phone, '')), '') is null
     or nullif(trim(coalesce(v_contact.email, '')), '') is null
     or nullif(trim(coalesce(v_contact.whatsapp, '')), '') is null then
    return 'missing:contact';
  end if;
  if v_is_company and (
    nullif(trim(coalesce(v_contact.contact_title, '')), '') is null
    or nullif(trim(coalesce(v_contact.city, '')), '') is null
    or v_contact.country is null
    or not v_buyer.representative_authorized
  ) then
    return 'missing:contact';
  end if;

  if v_buyer.destination_country is null
     or nullif(trim(coalesce(v_buyer.purchase_volume, '')), '') is null
     or (
       not exists (select 1 from public.buyer_categories where buyer_company_id = v_company.id)
       and nullif(trim(coalesce(v_buyer.other_products, '')), '') is null
     )
     or (v_is_company and v_buyer.company_type is null)
     or (not v_is_company and nullif(trim(coalesce(v_buyer.purchase_purpose, '')), '') is null) then
    return 'missing:profile';
  end if;

  if exists (
    select 1 from public.current_legal_documents() d
    where not exists (
      select 1 from public.legal_acceptances a where a.legal_document_id = d.id and a.user_id = p_user
    )
  ) then
    return 'missing:legal';
  end if;

  return null;
end;
$$;
