-- PASSO 5 — Liga a descida dos pedidos do cardápio para a loja (nuvem → loja, pelo Sync V2).
--
-- CÓPIA de easyFoodSyncV2/sql/120_supabase_cardapio_comandas_outbox.sql (a fonte é lá; se ela
-- mudar, copie de novo). Rode no SQL Editor do Supabase do ambiente, como postgres.
--
-- ► SÓ DEPOIS de o Sync V2 estar instalado e rodando em TODAS as lojas que vão usar o cardápio.
--   Com estes gatilhos, a nuvem passa a enfileirar as comandas do cardápio para a loja; um Sync
--   antigo na loja não sabe aplicar e o evento fica com erro. Ordem em
--   easyFoodSyncV2/docs/fase-2-cardapio.md ("Ordem para ligar").
-- ► Depois do passo 2 (o gatilho de cardapio.envios precisa da tabela).
--
-- Sem este passo o cardápio funciona na nuvem (Manager, cozinha e garçom veem tudo), mas os pedidos
-- não chegam ao Postgres da loja nem ao caixa (Firebird).

-- =============================================================================
-- SUPABASE: comandas do CARDAPIO DIGITAL (e seus envios) -> ecb_sync.outbox (nuvem -> loja).
-- Fase 2 do cardapio digital (reuniao de 05/11/2026).
--
-- O QUE MUDA
--   O cardapio digital (EasyMenu) grava o pedido do cliente DIRETO na nuvem, em
--   command.orders / command.order_items, com totem_name = 'CARDAPIO-DIGITAL'. Ate aqui o
--   fluxo de comandas era so loja -> nuvem: a loja nunca ficava sabendo desses pedidos, e a
--   cozinha/caixa (que leem o PG local e o Firebird) nao os viam.
--
--   Estes gatilhos enfileiram na outbox da NUVEM as mudancas dessas comandas. O Sync da
--   loja ja baixa a outbox da nuvem a cada ciclo (pull, filtrado pelo tenant da loja) e
--   agora tem os aplicadores de command.orders / command.order_items no apply local.
--
-- O QUE NAO MUDA
--   * Comanda de totem/POS (qualquer outro totem_name) continua SO loja -> nuvem. Os
--     gatilhos olham o totem_name da comanda e saem sem fazer nada nos demais casos.
--   * Anti-loop: quando o apply da nuvem grava o que veio da loja (incluindo a volta destas
--     mesmas comandas, ja com fb_id/synced_to_fb), a transacao tem
--     `ecb_sync.applying_remote = 'true'` e os gatilhos nao re-enfileiram.
--
-- SECURITY DEFINER: quem grava a comanda e' o role restrito do cardapio (easymenu_api), que
-- nao tem (nem deve ter) escrita em ecb_sync.outbox. Mesmo padrao das sql/070 e 078.
--
-- IDEMPOTENTE. Rodar como postgres (dono de ecb_sync) no SQL Editor do projeto.
-- =============================================================================

CREATE OR REPLACE FUNCTION ecb_sync.fn_cardapio_orders_outbox_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row jsonb;
  v_op  text;
BEGIN
  IF current_setting('ecb_sync.applying_remote', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_op  := 'D';
    v_row := to_jsonb(OLD);
  ELSE
    v_op  := CASE TG_OP WHEN 'INSERT' THEN 'I' ELSE 'U' END;
    v_row := to_jsonb(NEW);
  END IF;

  IF COALESCE(v_row ->> 'totem_name', '') <> 'CARDAPIO-DIGITAL' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- UPDATE que nao mudou nada nao vira evento.
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN
    RETURN NEW;
  END IF;

  INSERT INTO ecb_sync.outbox (entity_name, entity_id, op, payload, company_id, store_id)
  VALUES (
    'command.orders',
    (v_row ->> 'id')::uuid,
    v_op,
    v_row,
    (v_row ->> 'company_id')::uuid,
    (v_row ->> 'store_id')::uuid
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION ecb_sync.fn_cardapio_orders_outbox_enqueue() IS
  'command.orders do cardapio digital (totem_name=CARDAPIO-DIGITAL) -> ecb_sync.outbox (nuvem->loja). Skip com ecb_sync.applying_remote=true. sql/120.';

DROP TRIGGER IF EXISTS trg_cardapio_orders_ecb_sync_outbox ON command.orders;
CREATE TRIGGER trg_cardapio_orders_ecb_sync_outbox
  AFTER INSERT OR UPDATE OR DELETE ON command.orders
  FOR EACH ROW
  EXECUTE FUNCTION ecb_sync.fn_cardapio_orders_outbox_enqueue();


CREATE OR REPLACE FUNCTION ecb_sync.fn_cardapio_order_items_outbox_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row   jsonb;
  v_op    text;
  v_totem text;
BEGIN
  IF current_setting('ecb_sync.applying_remote', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_op  := 'D';
    v_row := to_jsonb(OLD);
  ELSE
    v_op  := CASE TG_OP WHEN 'INSERT' THEN 'I' ELSE 'U' END;
    v_row := to_jsonb(NEW);
  END IF;

  -- O item nao sabe de onde veio: quem diz e' a comanda. Chave completa (tabela particionada).
  SELECT o.totem_name
    INTO v_totem
    FROM command.orders o
   WHERE o.id = (v_row ->> 'order_id')::uuid
     AND o.created_at = (v_row ->> 'order_created_at')::timestamptz;

  IF COALESCE(v_totem, '') <> 'CARDAPIO-DIGITAL' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN
    RETURN NEW;
  END IF;

  -- O id do produto na nuvem pode ser o CANONICO (identidade por chave natural), diferente do
  -- id do produto na loja. O codigo legado (o do Firebird) e' o mesmo dos dois lados: vai junto
  -- para a loja achar o produto dela quando o id nao bater.
  IF v_op <> 'D' THEN
    v_row := v_row || jsonb_build_object(
      'product_legacy_code',
      (SELECT p.legacy_code FROM public.pv_products p WHERE p.id = (v_row ->> 'product_id')::uuid)
    );
  END IF;

  INSERT INTO ecb_sync.outbox (entity_name, entity_id, op, payload, company_id, store_id)
  VALUES (
    'command.order_items',
    (v_row ->> 'id')::uuid,
    v_op,
    v_row,
    (v_row ->> 'company_id')::uuid,
    (v_row ->> 'store_id')::uuid
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION ecb_sync.fn_cardapio_order_items_outbox_enqueue() IS
  'command.order_items de comanda do cardapio digital -> ecb_sync.outbox (nuvem->loja). Skip com ecb_sync.applying_remote=true. sql/120.';

-- Gatilho na tabela PARTICIONADA: o Postgres o propaga para todas as particoes, inclusive
-- as criadas depois.
DROP TRIGGER IF EXISTS trg_cardapio_order_items_ecb_sync_outbox ON command.order_items;
CREATE TRIGGER trg_cardapio_order_items_ecb_sync_outbox
  AFTER INSERT OR UPDATE OR DELETE ON command.order_items
  FOR EACH ROW
  EXECUTE FUNCTION ecb_sync.fn_cardapio_order_items_outbox_enqueue();


-- -----------------------------------------------------------------------------
-- cardapio.envios -> ecb_sync.outbox (nuvem -> loja)
--
-- As tabelas de comanda nao tem onde guardar o que so o cardapio sabe: o nome de quem pediu,
-- a observacao do pedido, a de cada item ("sem cebola") e o andamento na cozinha. O EasyMenu
-- grava isso em cardapio.envios, na mesma transacao da comanda. Este gatilho leva a linha
-- inteira para a loja, que a guarda em cardapio.envios local (sql/122) — sem acrescentar
-- coluna em nenhuma tabela de comanda, nem na nuvem nem na loja.
--
-- So desce: a loja nao tem gatilho de outbox nessa tabela. O status da cozinha (fase 3) e'
-- atualizado na nuvem e chega a loja como UPDATE.
--
-- Projeto sem o EasyMenu instalado (sem cardapio.envios): o bloco nao faz nada.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ecb_sync.fn_cardapio_envios_outbox_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row jsonb;
  v_op  text;
BEGIN
  IF current_setting('ecb_sync.applying_remote', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_op  := 'D';
    v_row := to_jsonb(OLD);
  ELSE
    v_op  := CASE TG_OP WHEN 'INSERT' THEN 'I' ELSE 'U' END;
    v_row := to_jsonb(NEW);
  END IF;

  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN
    RETURN NEW;
  END IF;

  INSERT INTO ecb_sync.outbox (entity_name, entity_id, op, payload, company_id, store_id)
  VALUES (
    'cardapio.envios',
    (v_row ->> 'id')::uuid,
    v_op,
    v_row,
    (v_row ->> 'company_id')::uuid,
    (v_row ->> 'store_id')::uuid
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION ecb_sync.fn_cardapio_envios_outbox_enqueue() IS
  'cardapio.envios (cliente, observacoes, status da cozinha) -> ecb_sync.outbox (nuvem->loja). Skip com ecb_sync.applying_remote=true. sql/120.';

DO $$
BEGIN
  IF to_regclass('cardapio.envios') IS NULL THEN
    RAISE NOTICE 'cardapio.envios nao existe neste projeto: gatilho de envios nao criado';
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS trg_cardapio_envios_ecb_sync_outbox ON cardapio.envios;
  CREATE TRIGGER trg_cardapio_envios_ecb_sync_outbox
    AFTER INSERT OR UPDATE OR DELETE ON cardapio.envios
    FOR EACH ROW
    EXECUTE FUNCTION ecb_sync.fn_cardapio_envios_outbox_enqueue();
END $$;
