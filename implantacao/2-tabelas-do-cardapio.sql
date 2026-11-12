-- PASSO 2 — Tabelas do cardápio (schema `cardapio`). GERADO: não edite à mão.
--
-- Junta backend/database/migrations/*.sql em ordem (`npm run implantacao:gerar` no backend).
-- Rode no SQL Editor do Supabase do ambiente, como postgres. Idempotente: rodar de novo não muda
-- nada. Alternativa pela linha de comando: `npm run db:migrar` no backend, com o DATABASE_URL do
-- usuário postgres (não o da API).

-- ==========================================================================================
-- backend/database/migrations/0001_cardapio.sql
-- ==========================================================================================

-- EasyMenu (cardápio digital da mesa) — dados que NÃO cabem em command.orders/order_items.
--
-- O pedido em si vai para as tabelas do EasyFood (command.orders + command.order_items), que é o
-- que o Manager e o sincronizador já entendem. Aqui fica só o que elas não têm onde guardar:
--   * quem pediu (cada pessoa da mesa informa o nome) e a observação para a cozinha;
--   * a observação de cada item;
--   * o andamento na cozinha (recebido → em preparo → pronto), que a tela da cozinha (fase 3)
--     vai atualizar e o celular do cliente acompanha.
--
-- Schema próprio, aditivo e idempotente: não altera nenhuma tabela do EasyFood.

CREATE SCHEMA IF NOT EXISTS cardapio;

CREATE TABLE IF NOT EXISTS cardapio.envios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            bigint GENERATED ALWAYS AS IDENTITY (START WITH 101) UNIQUE,
  company_id        uuid NOT NULL REFERENCES public.pv_companies(id) ON DELETE CASCADE,
  store_id          uuid NOT NULL REFERENCES public.pv_stores(id) ON DELETE RESTRICT,
  order_id          uuid NOT NULL,
  order_created_at  timestamptz NOT NULL,
  mesa              varchar(20) NOT NULL,
  cliente           varchar(60) NOT NULL,
  observacao        varchar(300),
  -- Retrato do que foi enviado: [{order_item_id, product_id, nome, quantidade, preco_unitario, observacao}]
  itens             jsonb NOT NULL,
  total             numeric(10,2) NOT NULL,
  status            text NOT NULL DEFAULT 'recebido'
                    CHECK (status IN ('recebido', 'em_preparo', 'pronto')),
  iniciado_em       timestamptz,
  pronto_em         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, order_created_at)
    REFERENCES command.orders (id, created_at) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_envios_loja_mesa ON cardapio.envios (store_id, mesa, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_envios_comanda ON cardapio.envios (order_id, order_created_at);
CREATE INDEX IF NOT EXISTS idx_envios_cozinha ON cardapio.envios (store_id, created_at)
  WHERE status <> 'pronto';

-- Sem policy de propósito: ninguém lê pelo PostgREST com a chave anon/authenticated.
-- Só a API (role easymenu_api, ver implantacao/3-usuario-da-api.sql) e o service_role acessam.
ALTER TABLE cardapio.envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cardapio.envios FROM anon, authenticated;

-- ==========================================================================================
-- backend/database/migrations/0002_equipe.sql
-- ==========================================================================================

-- EasyMenu — equipe do restaurante (fase 3: cozinha; fase 4: garçom).
--
-- Quem entra na tela da cozinha (e, depois, no app do garçom) tem usuário e senha próprios,
-- cadastrados pela tela /admin/equipe. Não usa os usuários do Manager: o cozinheiro não precisa
-- de acesso ao Manager, e o chefe pediu para não mexer no EasyFood.
--
-- Schema próprio, aditivo e idempotente: não altera nenhuma tabela do EasyFood.

CREATE TABLE IF NOT EXISTS cardapio.usuarios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.pv_companies(id) ON DELETE CASCADE,
  store_id       uuid NOT NULL REFERENCES public.pv_stores(id) ON DELETE RESTRICT,
  nome           varchar(60) NOT NULL,
  login          varchar(40) NOT NULL,
  -- scrypt$N$r$p$sal$hash (ver backend/src/modules/equipe/domain/senha.ts). Nunca a senha.
  senha_hash     text NOT NULL,
  papel          text NOT NULL CHECK (papel IN ('cozinha', 'garcom')),
  ativo          boolean NOT NULL DEFAULT true,
  -- Sobe ao trocar a senha ou desativar: as sessões abertas com a versão antiga deixam de valer.
  sessao_versao  integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Login único no sistema todo (sem diferenciar maiúsculas): a sessão já diz de qual loja é.
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_login ON cardapio.usuarios (lower(login));
CREATE INDEX IF NOT EXISTS idx_usuarios_loja ON cardapio.usuarios (store_id);

-- Sem policy para anon/authenticated: ninguém lê pelo PostgREST. Só a API e o service_role.
ALTER TABLE cardapio.usuarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cardapio.usuarios FROM anon, authenticated;

-- Permissão do role da API, quando ele já existe neste banco (implantacao/3-usuario-da-api.sql).
-- Sem DELETE: usuário sai desativado, não apagado.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'easymenu_api') THEN
    GRANT SELECT, INSERT, UPDATE ON cardapio.usuarios TO easymenu_api;
    DROP POLICY IF EXISTS easymenu_api_rw ON cardapio.usuarios;
    CREATE POLICY easymenu_api_rw ON cardapio.usuarios FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ==========================================================================================
-- backend/database/migrations/0003_garcom.sql
-- ==========================================================================================

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
