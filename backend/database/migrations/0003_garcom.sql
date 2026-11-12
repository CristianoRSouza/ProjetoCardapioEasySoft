-- EasyMenu — app do garçom (fase 4).
--
-- O garçom:
--   * é avisado quando a cozinha marca um pedido como pronto (na tela e por push no celular) e
--     marca "entregue" quando leva à mesa;
--   * lança pedido para uma mesa (com o mesmo cardápio do cliente);
--   * corrige quantidade ou cancela item, SÓ enquanto a cozinha não começou e o item não foi
--     lançado no caixa (Firebird). Cada correção fica registrada em cardapio.alteracoes.
--
-- Aditiva e idempotente. Em tabela do EasyFood só há GRANT: a API passa a poder alterar
-- quantidade, subtotal e status dos itens (nada além disso, e a policy existente só aceita
-- item de origem 'totem'). Nenhuma coluna nova em command.*.
--
-- A loja não precisa de nada: o Sync V2 copia de cardapio.envios só as colunas que a tabela da
-- loja tem (sql/122) e lá o status é texto livre.

-- 1. Envio: status "entregue", quem lançou (garçom) e quando foi entregue -------------------------
ALTER TABLE cardapio.envios DROP CONSTRAINT IF EXISTS envios_status_check;
ALTER TABLE cardapio.envios
  ADD CONSTRAINT envios_status_check CHECK (status IN ('recebido', 'em_preparo', 'pronto', 'entregue'));
ALTER TABLE cardapio.envios ADD COLUMN IF NOT EXISTS entregue_em timestamptz;
-- Preenchido quando o pedido foi lançado pelo app do garçom (e não pelo QR do cliente).
ALTER TABLE cardapio.envios ADD COLUMN IF NOT EXISTS garcom_id uuid REFERENCES cardapio.usuarios(id) ON DELETE SET NULL;

-- Prontos esperando o garçom levar.
CREATE INDEX IF NOT EXISTS idx_envios_prontos ON cardapio.envios (store_id, pronto_em) WHERE status = 'pronto';

-- 2. Correções feitas pelo garçom (quantidade nova; 0 = cancelou o item) ---------------------------
CREATE TABLE IF NOT EXISTS cardapio.alteracoes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES public.pv_companies(id) ON DELETE CASCADE,
  store_id           uuid NOT NULL REFERENCES public.pv_stores(id) ON DELETE RESTRICT,
  envio_id           uuid NOT NULL REFERENCES cardapio.envios(id) ON DELETE CASCADE,
  order_item_id      uuid NOT NULL,
  usuario_id         uuid REFERENCES cardapio.usuarios(id) ON DELETE SET NULL,
  produto            varchar(200) NOT NULL,
  quantidade_antes   integer NOT NULL,
  quantidade_depois  integer NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alteracoes_envio ON cardapio.alteracoes (envio_id);

-- 3. Celulares dos garçons inscritos para receber push (Web Push) ---------------------------------
CREATE TABLE IF NOT EXISTS cardapio.inscricoes_push (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES cardapio.usuarios(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES public.pv_stores(id) ON DELETE CASCADE,
  -- Endereço do serviço de push do navegador (Google, Mozilla, Apple). Único por aparelho.
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inscricoes_push_loja ON cardapio.inscricoes_push (store_id);

-- Sem policy para anon/authenticated: ninguém lê pelo PostgREST. Só a API e o service_role.
ALTER TABLE cardapio.alteracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cardapio.inscricoes_push ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cardapio.alteracoes, cardapio.inscricoes_push FROM anon, authenticated;

-- 4. Permissões do role da API, quando ele existe neste banco (implantacao/3-usuario-da-api.sql) ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'easymenu_api') THEN
    -- Correção de item pelo garçom. A policy easymenu_api_rw de command.order_items já exige
    -- origin = 'totem', e a API só mexe em item de comanda do cardápio.
    GRANT UPDATE (quantity, subtotal, status, updated_at) ON command.order_items TO easymenu_api;

    -- Histórico: grava e lê, não altera nem apaga.
    GRANT SELECT, INSERT ON cardapio.alteracoes TO easymenu_api;
    DROP POLICY IF EXISTS easymenu_api_rw ON cardapio.alteracoes;
    CREATE POLICY easymenu_api_rw ON cardapio.alteracoes FOR ALL TO easymenu_api USING (true) WITH CHECK (true);

    -- Inscrição de push: o aparelho que sai ou expira é apagado.
    GRANT SELECT, INSERT, UPDATE, DELETE ON cardapio.inscricoes_push TO easymenu_api;
    DROP POLICY IF EXISTS easymenu_api_rw ON cardapio.inscricoes_push;
    CREATE POLICY easymenu_api_rw ON cardapio.inscricoes_push FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
  END IF;
END $$;
