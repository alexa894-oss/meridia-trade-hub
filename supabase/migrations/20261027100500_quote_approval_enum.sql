-- Meridia Trade Hub · Etapa 9 (Parte C): estado nuevo de cotización.
-- Migración propia: un valor nuevo de enum no se usa en la misma transacción.
alter type public.quote_status add value if not exists 'pending_approval' after 'draft';
