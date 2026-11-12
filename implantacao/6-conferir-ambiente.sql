-- PASSO 6 — Conferir o ambiente montado (passos 2, 3 e 5).
--
-- Só LÊ. Rode no SQL Editor do Supabase do ambiente. Resultado esperado: todas as linhas com
-- ok = true (as do passo 5 só depois de ligá-lo). A coluna "passo" diz qual script refazer.

WITH
tabelas(t) AS (VALUES ('envios'), ('usuarios'), ('alteracoes'), ('inscricoes_push')),
privilegio(tabela, priv) AS (
  VALUES ('public.pv_products', 'SELECT'), ('public.pv_product_units', 'SELECT'),
         ('public.pv_product_groups', 'SELECT'), ('public.pv_stores', 'SELECT'),
         ('command.orders', 'SELECT'), ('command.orders', 'INSERT'),
         ('command.order_items', 'SELECT'), ('command.order_items', 'INSERT'),
         ('cardapio.envios', 'SELECT'), ('cardapio.envios', 'INSERT'), ('cardapio.envios', 'UPDATE'),
         ('cardapio.usuarios', 'SELECT'), ('cardapio.usuarios', 'INSERT'), ('cardapio.usuarios', 'UPDATE'),
         ('cardapio.alteracoes', 'SELECT'), ('cardapio.alteracoes', 'INSERT'),
         ('cardapio.inscricoes_push', 'SELECT'), ('cardapio.inscricoes_push', 'INSERT'),
         ('cardapio.inscricoes_push', 'UPDATE'), ('cardapio.inscricoes_push', 'DELETE')
),
coluna_atualizavel(tabela, coluna) AS (
  VALUES ('command.orders', 'updated_at'),
         ('command.order_items', 'quantity'), ('command.order_items', 'subtotal'),
         ('command.order_items', 'status'), ('command.order_items', 'updated_at')
),
policy(tabela, nome) AS (
  VALUES ('public.pv_products', 'easymenu_api_le'), ('public.pv_product_units', 'easymenu_api_le'),
         ('public.pv_product_groups', 'easymenu_api_le'), ('public.pv_stores', 'easymenu_api_le'),
         ('command.orders', 'easymenu_api_rw'), ('command.order_items', 'easymenu_api_rw'),
         ('cardapio.envios', 'easymenu_api_rw'), ('cardapio.usuarios', 'easymenu_api_rw'),
         ('cardapio.alteracoes', 'easymenu_api_rw'), ('cardapio.inscricoes_push', 'easymenu_api_rw')
),
gatilho(tabela, nome) AS (
  VALUES ('command.orders', 'trg_cardapio_orders_ecb_sync_outbox'),
         ('command.order_items', 'trg_cardapio_order_items_ecb_sync_outbox'),
         ('cardapio.envios', 'trg_cardapio_envios_ecb_sync_outbox')
),
checagens(passo, o_que, ok) AS (
  SELECT '2', 'tabela cardapio.' || t, to_regclass('cardapio.' || t) IS NOT NULL FROM tabelas
  UNION ALL
  SELECT '2', 'RLS ligada em cardapio.' || t,
         coalesce((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('cardapio.' || t)), false)
    FROM tabelas
  UNION ALL
  SELECT '2', 'anon/authenticated sem acesso a cardapio.' || t,
         NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants g
                      WHERE g.table_schema = 'cardapio' AND g.table_name = t
                        AND g.grantee IN ('anon', 'authenticated'))
    FROM tabelas
  UNION ALL
  SELECT '2', 'status "entregue" e colunas do garçom em cardapio.envios (0003)',
         (SELECT count(*) = 2 FROM information_schema.columns
           WHERE table_schema = 'cardapio' AND table_name = 'envios' AND column_name IN ('entregue_em', 'garcom_id'))
  UNION ALL
  SELECT '3', 'usuário easymenu_api existe e faz login',
         EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'easymenu_api' AND rolcanlogin)
  UNION ALL
  SELECT '3', 'usuário easymenu_api NÃO é superusuário nem ignora RLS',
         NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'easymenu_api' AND (rolsuper OR rolbypassrls))
  UNION ALL
  SELECT '3', 'easymenu_api pode ' || p.priv || ' em ' || p.tabela,
         EXISTS (SELECT 1 FROM information_schema.role_table_grants g
                  WHERE g.grantee = 'easymenu_api' AND g.table_schema || '.' || g.table_name = p.tabela
                    AND g.privilege_type = p.priv)
    FROM privilegio p
  UNION ALL
  SELECT '3', 'easymenu_api pode UPDATE só em ' || a.tabela || '.' || a.coluna,
         EXISTS (SELECT 1 FROM information_schema.column_privileges g
                  WHERE g.grantee = 'easymenu_api' AND g.table_schema || '.' || g.table_name = a.tabela
                    AND g.column_name = a.coluna AND g.privilege_type = 'UPDATE')
    FROM coluna_atualizavel a
  UNION ALL
  SELECT '3', 'easymenu_api NÃO pode DELETE em comandas',
         NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants g
                      WHERE g.grantee = 'easymenu_api' AND g.table_schema = 'command' AND g.privilege_type = 'DELETE')
  UNION ALL
  SELECT '3', 'policy ' || p.nome || ' em ' || p.tabela,
         EXISTS (SELECT 1 FROM pg_policies x
                  WHERE x.schemaname || '.' || x.tablename = p.tabela AND x.policyname = p.nome)
    FROM policy p
  UNION ALL
  SELECT '5', 'gatilho ' || g.nome,
         EXISTS (SELECT 1 FROM pg_trigger tg
                  WHERE tg.tgrelid = to_regclass(g.tabela) AND tg.tgname = g.nome AND NOT tg.tgisinternal)
    FROM gatilho g
  UNION ALL
  SELECT '-', 'há pelo menos uma loja ativa (para gerar QR codes)',
         EXISTS (SELECT 1 FROM public.pv_stores WHERE is_active AND NOT coalesce(is_deleted, false))
)
SELECT passo, o_que, ok FROM checagens ORDER BY ok, passo, o_que;
