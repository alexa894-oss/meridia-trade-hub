-- Meridia Trade Hub · Enums
-- Los identificadores van en inglés; las etiquetas visibles salen de messages/<locale>.json.

create type public.user_role as enum ('buyer', 'factory', 'admin');
create type public.company_kind as enum ('buyer', 'factory');
create type public.buyer_account_type as enum ('company', 'individual');

create type public.company_status as enum (
  'registered', 'in_review', 'validated', 'info_requested', 'rejected', 'suspended'
);

create type public.factory_tier as enum ('vip', 'standard');

-- Términos de cotización y modalidad de carga son tipos distintos a propósito.
create type public.incoterm as enum ('FOB', 'CIF', 'EXW');
create type public.shipping_mode as enum ('FCL', 'LCL', 'air', 'samples', 'undecided');

create type public.rfq_status as enum (
  'draft', 'submitted', 'assigned', 'quoted', 'negotiating',
  'order_created', 'info_requested', 'no_response', 'closed'
);

create type public.quote_status as enum (
  'draft', 'submitted', 'reviewed', 'preferred', 'accepted', 'discarded', 'hidden', 'expired'
);

create type public.offer_type as enum ('exact', 'alternative');

create type public.order_status as enum (
  'sent', 'confirmed', 'in_production', 'ready_to_ship', 'shipped', 'delivered', 'closed', 'rejected'
);

create type public.commission_status as enum ('registered', 'invoiced', 'paid', 'overdue');

create type public.company_document_kind as enum (
  'tax_registration', 'id_document', 'cn_business_license', 'brochure', 'other'
);

create type public.company_review_action as enum ('validate', 'request_info', 'reject', 'suspend');
create type public.legal_document_kind as enum ('terms', 'non_circumvention');
create type public.billing_period as enum ('monthly', 'quarterly', 'semiannual', 'annual', 'one_time');
create type public.order_document_kind as enum ('commercial_invoice', 'bill_of_lading', 'other');
create type public.message_sender_kind as enum ('buyer', 'factory', 'meridia');
create type public.audited_entity as enum ('company', 'rfq', 'quote', 'order', 'commission');
