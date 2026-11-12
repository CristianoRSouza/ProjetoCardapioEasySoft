-- PASSO 1 — Conferir se o banco do ambiente já tem o que o EasyMenu usa do EasyFood.
--
-- Só LÊ. Rode no SQL Editor do Supabase do ambiente (homologação ou produção).
-- Resultado esperado: todas as linhas com ok = true. Se alguma vier false, PARE: o EasyMenu se
-- apoia nas tabelas do EasyFood (comandas, produtos, lojas) e no ecb_sync do Sync; elas vêm das
-- migrações do Manager (easyfoodmanagerWEB/supabase/migrations) e do Sync (easyFoodSyncV2/sql).

WITH esperado(tabela, coluna) AS (
  VALUES
    -- comandas (o pedido do cardápio vira comanda + itens, igual ao totem)
    ('command.orders', 'id'), ('command.orders', 'created_at'), ('command.orders', 'updated_at'),
    ('command.orders', 'company_id'), ('command.orders', 'store_id'), ('command.orders', 'barcode'),
    ('command.orders', 'customer_name'), ('command.orders', 'status'), ('command.orders', 'table_name'),
    ('command.orders', 'totem_name'),
    ('command.order_items', 'id'), ('command.order_items', 'order_id'), ('command.order_items', 'order_created_at'),
    ('command.order_items', 'company_id'), ('command.order_items', 'store_id'), ('command.order_items', 'product_id'),
    ('command.order_items', 'product_name'), ('command.order_items', 'product_barcode'),
    ('command.order_items', 'quantity'), ('command.order_items', 'unit_price'), ('command.order_items', 'subtotal'),
    ('command.order_items', 'origin'), ('command.order_items', 'status'), ('command.order_items', 'unit_id'),
    ('command.order_items', 'unit_code'), ('command.order_items', 'synced_to_fb'), ('command.order_items', 'updated_at'),
    -- cadastro (cardápio e preço vêm daqui)
    ('public.pv_companies', 'id'),
    ('public.pv_stores', 'id'), ('public.pv_stores', 'company_id'), ('public.pv_stores', 'trade_name'),
    ('public.pv_stores', 'legal_name'), ('public.pv_stores', 'is_active'), ('public.pv_stores', 'is_deleted'),
    ('public.pv_products', 'id'), ('public.pv_products', 'store_id'), ('public.pv_products', 'barcode'),
    ('public.pv_products', 'legacy_code'), ('public.pv_products', 'description'), ('public.pv_products', 'ecommerce_name'),
    ('public.pv_products', 'ecommerce_description'), ('public.pv_products', 'sale_price'), ('public.pv_products', 'image_url'),
    ('public.pv_products', 'group_id'), ('public.pv_products', 'unit_id'), ('public.pv_products', 'is_active'),
    ('public.pv_products', 'is_deleted'),
    ('public.pv_product_groups', 'id'), ('public.pv_product_groups', 'name'), ('public.pv_product_groups', 'is_active'),
    ('public.pv_product_units', 'id'), ('public.pv_product_units', 'legacy_code'),
    -- fila do Sync (o passo 5 põe gatilhos que escrevem nela)
    ('ecb_sync.outbox', 'entity_name'), ('ecb_sync.outbox', 'entity_id'), ('ecb_sync.outbox', 'op'),
    ('ecb_sync.outbox', 'payload'), ('ecb_sync.outbox', 'company_id'), ('ecb_sync.outbox', 'store_id')
)
SELECT 'coluna ' || e.tabela || '.' || e.coluna AS o_que,
       EXISTS (
         SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema || '.' || c.table_name = e.tabela AND c.column_name = e.coluna
       ) AS ok
  FROM esperado e
UNION ALL
SELECT 'enum command.item_origin aceita ''totem''',
       EXISTS (SELECT 1 FROM pg_enum en JOIN pg_type t ON t.oid = en.enumtypid
                 JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'command' AND t.typname = 'item_origin' AND en.enumlabel = 'totem')
UNION ALL
SELECT 'roles anon e authenticated do Supabase',
       (SELECT count(*) = 2 FROM pg_roles WHERE rolname IN ('anon', 'authenticated'))
UNION ALL
SELECT 'Postgres 13+ (gen_random_uuid nativo)',
       current_setting('server_version_num')::int >= 130000
ORDER BY ok, o_que;
