-- Meridia Trade Hub · Etapa 9: valores nuevos de enums para la solicitud de acceso.
-- Van en una migración propia: un valor nuevo de enum no puede usarse en la misma
-- transacción en que se agrega.

-- "Solicitud recibida" sigue siendo in_review; "En revisión" es reviewing.
alter type public.company_status add value if not exists 'reviewing' after 'in_review';
alter type public.company_review_action add value if not exists 'start_review';
alter type public.company_document_kind add value if not exists 'representation';
alter type public.legal_document_kind add value if not exists 'privacy';

create type public.buyer_company_type as enum (
  'construction', 'importer', 'distributor', 'retail', 'manufacturer', 'other'
);
create type public.id_document_type as enum (
  'national_id', 'passport', 'residence_permit', 'other'
);
