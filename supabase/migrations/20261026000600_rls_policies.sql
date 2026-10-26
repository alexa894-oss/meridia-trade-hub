-- Meridia Trade Hub · Row Level Security
-- Regla general: cada tabla con RLS activo; el administrador ve todo;
-- comprador y fábrica solo ven lo suyo. Lo que cruza entre partes pasa por
-- funciones que exponen columnas seguras (ver 20261026000700).

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.buyer_details enable row level security;
alter table public.categories enable row level security;
alter table public.factory_details enable row level security;
alter table public.factory_categories enable row level security;
alter table public.company_contacts enable row level security;
alter table public.factory_admin enable row level security;
alter table public.company_documents enable row level security;
alter table public.company_reviews enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.platform_settings enable row level security;
alter table public.membership_plans enable row level security;
alter table public.factory_memberships enable row level security;
alter table public.rfqs enable row level security;
alter table public.rfq_assignments enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_prices enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.notifications enable row level security;
alter table public.orders enable row level security;
alter table public.order_documents enable row level security;
alter table public.commissions enable row level security;
alter table public.status_history enable row level security;

-- ---------------------------------------------------------------------------
-- Administrador: acceso total a todas las tablas
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'profiles', 'buyer_details', 'categories', 'factory_details',
    'factory_categories', 'company_contacts', 'factory_admin', 'company_documents',
    'company_reviews', 'legal_documents', 'legal_acceptances', 'platform_settings',
    'membership_plans', 'factory_memberships', 'rfqs', 'rfq_assignments', 'quotes',
    'quote_prices', 'conversations', 'messages', 'message_attachments',
    'conversation_reads', 'notifications', 'orders', 'order_documents', 'commissions',
    'status_history'
  ] loop
    execute format(
      'create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfiles y empresas
-- ---------------------------------------------------------------------------
create policy profiles_own_select on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy companies_own_select on public.companies for select to authenticated
  using (id = public.my_company_id());
-- Solo editable mientras no esté validada ni rechazada (lo demás lo protege el trigger guard).
create policy companies_own_update on public.companies for update to authenticated
  using (id = public.my_company_id() and status in ('registered', 'info_requested'))
  with check (id = public.my_company_id());

create policy buyer_details_own on public.buyer_details for all to authenticated
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

create policy factory_details_own on public.factory_details for all to authenticated
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

create policy factory_categories_own on public.factory_categories for all to authenticated
  using (factory_company_id = public.my_company_id())
  with check (factory_company_id = public.my_company_id());

-- 🔒 Contacto: la propia empresa lo gestiona; la otra parte nunca lo ve.
create policy company_contacts_own on public.company_contacts for all to authenticated
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- 🔒 factory_admin: sin política para no-admin → sin acceso.

create policy company_documents_own_select on public.company_documents for select to authenticated
  using (company_id = public.my_company_id());
create policy company_documents_own_insert on public.company_documents for insert to authenticated
  with check (company_id = public.my_company_id() and uploaded_by = auth.uid());

create policy company_reviews_own_select on public.company_reviews for select to authenticated
  using (company_id = public.my_company_id());

create policy categories_read on public.categories for select to anon, authenticated
  using (active);

-- ---------------------------------------------------------------------------
-- Legal, configuración y planes
-- ---------------------------------------------------------------------------
create policy legal_documents_read on public.legal_documents for select to anon, authenticated
  using (true);

create policy legal_acceptances_own on public.legal_acceptances for select to authenticated
  using (user_id = auth.uid());
create policy legal_acceptances_insert on public.legal_acceptances for insert to authenticated
  with check (user_id = auth.uid());

create policy platform_settings_public on public.platform_settings for select to anon, authenticated
  using (is_public);

-- Planes y membresías: la fábrica ve su propia membresía y el plan correspondiente.
create policy factory_memberships_own on public.factory_memberships for select to authenticated
  using (factory_company_id = public.my_company_id());
create policy membership_plans_own on public.membership_plans for select to authenticated
  using (exists (
    select 1 from public.factory_memberships m
    where m.plan_id = membership_plans.id and m.factory_company_id = public.my_company_id()
  ));

-- ---------------------------------------------------------------------------
-- Solicitudes
-- ---------------------------------------------------------------------------
create policy rfqs_buyer_select on public.rfqs for select to authenticated
  using (buyer_company_id = public.my_company_id());
create policy rfqs_buyer_insert on public.rfqs for insert to authenticated
  with check (
    buyer_company_id = public.my_company_id()
    and created_by = auth.uid()
    and status = 'draft'
    and public.my_role() = 'buyer'
  );
create policy rfqs_buyer_update on public.rfqs for update to authenticated
  using (buyer_company_id = public.my_company_id() and status in ('draft', 'info_requested'))
  with check (buyer_company_id = public.my_company_id() and status in ('draft', 'info_requested', 'submitted'));
create policy rfqs_buyer_delete_draft on public.rfqs for delete to authenticated
  using (buyer_company_id = public.my_company_id() and status = 'draft');

-- Una fábrica solo ve solicitudes que Meridia le asignó.
create policy rfqs_factory_select on public.rfqs for select to authenticated
  using (public.is_assigned(id));

create policy rfq_assignments_factory_select on public.rfq_assignments for select to authenticated
  using (factory_company_id = public.my_company_id());

-- ---------------------------------------------------------------------------
-- Cotizaciones
-- ---------------------------------------------------------------------------
create policy quotes_factory_select on public.quotes for select to authenticated
  using (factory_company_id = public.my_company_id() and public.is_assigned(rfq_id));
create policy quotes_factory_insert on public.quotes for insert to authenticated
  with check (
    factory_company_id = public.my_company_id()
    and created_by = auth.uid()
    and public.is_assigned(rfq_id)
    and status = 'draft'
  );
create policy quotes_factory_update on public.quotes for update to authenticated
  using (factory_company_id = public.my_company_id() and public.is_assigned(rfq_id) and status = 'draft')
  with check (factory_company_id = public.my_company_id() and status in ('draft', 'submitted'));

-- El comprador ve las cotizaciones enviadas a sus solicitudes (no borradores ni ocultas).
create policy quotes_buyer_select on public.quotes for select to authenticated
  using (public.owns_rfq(rfq_id) and status not in ('draft', 'hidden'));

create policy quote_prices_select on public.quote_prices for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_prices.quote_id));
create policy quote_prices_factory_write on public.quote_prices for all to authenticated
  using (exists (
    select 1 from public.quotes q
    where q.id = quote_prices.quote_id
      and q.factory_company_id = public.my_company_id()
      and q.status = 'draft'
  ))
  with check (exists (
    select 1 from public.quotes q
    where q.id = quote_prices.quote_id
      and q.factory_company_id = public.my_company_id()
      and q.status = 'draft'
  ));

-- ---------------------------------------------------------------------------
-- Mensajería
-- ---------------------------------------------------------------------------
create or replace function public.can_access_conversation(p_conversation uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation
      and (
        public.is_admin()
        or public.owns_rfq(c.rfq_id)
        or (c.factory_company_id = public.my_company_id() and public.is_assigned(c.rfq_id))
      )
  );
$$;

create policy conversations_party_select on public.conversations for select to authenticated
  using (public.can_access_conversation(id));

create policy messages_party_select on public.messages for select to authenticated
  using (public.can_access_conversation(conversation_id));
create policy messages_party_insert on public.messages for insert to authenticated
  with check (public.can_access_conversation(conversation_id));

create policy message_attachments_select on public.message_attachments for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_attachments.message_id));
create policy message_attachments_insert on public.message_attachments for insert to authenticated
  with check (exists (
    select 1 from public.messages m
    where m.id = message_attachments.message_id and m.sender_id = auth.uid()
  ));

create policy conversation_reads_own on public.conversation_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_access_conversation(conversation_id));

create policy notifications_own_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Pedidos y comisiones (las escrituras llegarán por funciones en la Etapa 7)
-- ---------------------------------------------------------------------------
create policy orders_party_select on public.orders for select to authenticated
  using (buyer_company_id = public.my_company_id() or factory_company_id = public.my_company_id());

create policy order_documents_party_select on public.order_documents for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_documents.order_id));
create policy order_documents_factory_insert on public.order_documents for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_documents.order_id and o.factory_company_id = public.my_company_id()
    )
  );

-- El comprador no ve comisiones; la fábrica ve las suyas.
create policy commissions_factory_select on public.commissions for select to authenticated
  using (factory_company_id = public.my_company_id());

-- ---------------------------------------------------------------------------
-- Historial: visible si la entidad es visible para quien consulta
-- ---------------------------------------------------------------------------
create policy status_history_party_select on public.status_history for select to authenticated
  using (
    case entity_type
      when 'company' then entity_id = public.my_company_id()
      when 'rfq' then exists (select 1 from public.rfqs r where r.id = status_history.entity_id)
      when 'quote' then exists (select 1 from public.quotes q where q.id = status_history.entity_id)
      when 'order' then exists (select 1 from public.orders o where o.id = status_history.entity_id)
      when 'commission' then exists (select 1 from public.commissions c where c.id = status_history.entity_id)
      else false
    end
  );
