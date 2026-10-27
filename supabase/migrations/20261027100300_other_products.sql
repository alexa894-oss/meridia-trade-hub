-- Meridia Trade Hub · Etapa 9: "Otro producto" en el perfil de compra.
-- Las categorías se amplían a medida que Meridia incorpora fábricas de otras industrias;
-- mientras tanto, el solicitante puede escribir un producto que no esté en la lista.
-- Regla: al menos una categoría o un "otro producto".

alter table public.buyer_details add column other_products text
  check (other_products is null or char_length(other_products) <= 500);

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
     or (v_is_company and (v_buyer.company_type is null or v_buyer.purchase_frequency_id is null))
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
revoke execute on function public.buyer_application_error(uuid, uuid) from public, anon, authenticated;

create or replace function public.submit_access_request(p_user uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_created timestamptz;
  v_company uuid;
  v_is_company boolean := (p_data ->> 'account_type') = 'company';
  v_error text;
  v_text text;
begin
  select * into v_profile from public.profiles where id = p_user;
  select created_at into v_created from auth.users where id = p_user;
  if v_profile.id is null or v_profile.role <> 'buyer' or v_profile.company_id is not null
     or v_created is null or v_created < now() - interval '30 minutes' then
    raise exception 'not_allowed';
  end if;
  if (p_data ->> 'account_type') not in ('company', 'individual') then raise exception 'missing:details'; end if;

  insert into public.companies (kind, country, sector_id)
  values (
    'buyer',
    upper(p_data ->> 'country'),
    case when v_is_company then nullif(p_data ->> 'sector_id', '')::uuid end
  )
  returning id into v_company;
  update public.profiles set company_id = v_company where id = p_user;

  insert into public.buyer_details (
    company_id, account_type, legal_name, trade_name, tax_id, website, economic_activity,
    full_name, id_type, id_number, company_type, representative_authorized,
    destination_country, purchase_volume, purchase_frequency_id, purchase_purpose, project_description, other_products
  ) values (
    v_company,
    (p_data ->> 'account_type')::public.buyer_account_type,
    case when v_is_company then nullif(trim(p_data ->> 'legal_name'), '') end,
    case when v_is_company then nullif(trim(p_data ->> 'trade_name'), '') end,
    case when v_is_company then nullif(trim(p_data ->> 'tax_id'), '') end,
    case when v_is_company then nullif(trim(p_data ->> 'website'), '') end,
    nullif(trim(p_data ->> 'economic_activity'), ''),
    case when not v_is_company then nullif(trim(p_data ->> 'full_name'), '') end,
    case when not v_is_company then nullif(p_data ->> 'id_type', '')::public.id_document_type end,
    case when not v_is_company then nullif(trim(p_data ->> 'id_number'), '') end,
    case when v_is_company then nullif(p_data ->> 'company_type', '')::public.buyer_company_type end,
    v_is_company and coalesce((p_data ->> 'representative_authorized')::boolean, false),
    upper(nullif(p_data ->> 'destination_country', '')),
    nullif(trim(p_data ->> 'purchase_volume'), ''),
    case when v_is_company then nullif(p_data ->> 'purchase_frequency_id', '')::uuid end,
    case when not v_is_company then nullif(trim(p_data ->> 'purchase_purpose'), '') end,
    case when v_is_company then nullif(trim(p_data ->> 'needs_description'), '') end,
    nullif(trim(p_data ->> 'other_products'), '')
  );

  -- Persona natural: el contacto es la propia persona.
  v_text := case when v_is_company then p_data ->> 'contact_name' else p_data ->> 'full_name' end;
  insert into public.company_contacts (company_id, contact_name, contact_title, email, phone, whatsapp, country, city)
  values (
    v_company,
    coalesce(nullif(trim(v_text), ''), ''),
    case when v_is_company then nullif(trim(p_data ->> 'contact_title'), '') end,
    lower(nullif(trim(p_data ->> 'contact_email'), '')),
    nullif(trim(p_data ->> 'phone'), ''),
    nullif(trim(p_data ->> 'whatsapp'), ''),
    case when v_is_company then upper(nullif(p_data ->> 'contact_country', '')) end,
    case when v_is_company then nullif(trim(p_data ->> 'city'), '') end
  );

  insert into public.buyer_categories (buyer_company_id, category_id)
  select v_company, c.id
  from public.categories c
  where c.active and c.id::text in (select jsonb_array_elements_text(coalesce(p_data -> 'category_ids', '[]'::jsonb)));

  -- Aceptación de la versión vigente de cada texto legal (el formulario la exige).
  if coalesce((p_data ->> 'accepted_legal')::boolean, false) then
    insert into public.legal_acceptances (user_id, legal_document_id)
    select p_user, d.id from public.current_legal_documents() d
    on conflict (user_id, legal_document_id) do nothing;
  end if;

  v_error := public.buyer_application_error(v_company, p_user);
  if v_error is not null then raise exception '%', v_error; end if;

  -- Sin sesión, el guard de empresas no interviene: la solicitud queda recibida.
  update public.companies set status = 'in_review', submitted_at = now() where id = v_company;

  insert into public.notifications (user_id, type, payload)
  select p.id, 'access_request', jsonb_build_object('company_id', v_company)
  from public.profiles p where p.role = 'admin';

  return v_company;
end;
$$;
revoke execute on function public.submit_access_request(uuid, jsonb) from public;
grant execute on function public.submit_access_request(uuid, jsonb) to anon, authenticated;
