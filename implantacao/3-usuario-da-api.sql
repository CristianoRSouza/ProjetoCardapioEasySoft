-- PASSO 3 — Usuário de banco da API do EasyMenu (role easymenu_api), com o mínimo de permissão.
--
-- Rode no SQL Editor do Supabase do ambiente, como postgres, DEPOIS do passo 2 (dá permissão nas
-- tabelas que ele cria).
--
-- ► TROQUE A SENHA na linha marcada abaixo antes de rodar (16+ caracteres, sem aspas simples).
--   Ela vai no DATABASE_URL da API:
--   postgresql://easymenu_api.<ref-do-projeto>:<SENHA>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
--   (o pooler do Supabase pede o usuário com o ref do projeto; 5432 é o modo sessão, usado na homologação)
--
-- Pode rodar de novo: permissões e policies são refeitas iguais. Rodando de novo com a senha ainda
-- em 'TROQUE-ESTA-SENHA', o usuário já existente MANTÉM a senha atual (a API no ar não cai).
-- Rodando com uma senha nova, ela é TROCADA: atualize o DATABASE_URL da API junto.
--
-- O que a API pode, e nada além disso:
--   * LER produtos, unidades, grupos e lojas (montar o cardápio e validar o preço);
--   * CRIAR comanda e itens em command.orders / command.order_items (status 'open', origem 'totem');
--   * CORRIGIR quantidade / cancelar item de origem 'totem' (app do garçom);
--   * LER/ESCREVER as tabelas do schema cardapio.
-- Não pode apagar comanda, mexer em transação/PIX, NFC-e ou em qualquer tabela de cadastro.

DO $$
DECLARE
  senha constant text := 'TROQUE-ESTA-SENHA';  -- ◄◄◄ TROQUE AQUI
  existe constant boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'easymenu_api');
BEGIN
  IF senha = 'TROQUE-ESTA-SENHA' THEN
    IF NOT existe THEN
      RAISE EXCEPTION 'Troque a senha na linha marcada (◄◄◄) antes de criar o usuário easymenu_api.';
    END IF;
    RAISE NOTICE 'easymenu_api já existe: senha mantida.';
  ELSIF length(senha) < 16 OR position('''' IN senha) > 0 THEN
    RAISE EXCEPTION 'A senha precisa de 16+ caracteres e não pode ter aspas simples.';
  ELSIF existe THEN
    EXECUTE format('ALTER ROLE easymenu_api LOGIN NOINHERIT PASSWORD %L', senha);
    RAISE NOTICE 'easymenu_api já existia: senha TROCADA — atualize o DATABASE_URL da API.';
  ELSE
    EXECUTE format('CREATE ROLE easymenu_api LOGIN NOINHERIT PASSWORD %L', senha);
    RAISE NOTICE 'easymenu_api criado.';
  END IF;
END $$;

ALTER ROLE easymenu_api SET statement_timeout = '15s';

GRANT USAGE ON SCHEMA public, command, cardapio TO easymenu_api;

GRANT SELECT ON public.pv_products, public.pv_product_units, public.pv_product_groups, public.pv_stores
  TO easymenu_api;

GRANT SELECT, INSERT ON command.orders, command.order_items TO easymenu_api;
GRANT UPDATE (updated_at) ON command.orders TO easymenu_api;
GRANT UPDATE (quantity, subtotal, status, updated_at) ON command.order_items TO easymenu_api;

GRANT SELECT, INSERT, UPDATE ON cardapio.envios TO easymenu_api;
GRANT SELECT, INSERT, UPDATE ON cardapio.usuarios TO easymenu_api;
GRANT SELECT, INSERT ON cardapio.alteracoes TO easymenu_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON cardapio.inscricoes_push TO easymenu_api;

-- As tabelas command.* e pv_* têm RLS. O role precisa de policies próprias (o service_role ignora
-- RLS, este role não). Escopo: tudo — a API só consulta pela loja que veio no QR assinado.
DROP POLICY IF EXISTS easymenu_api_le ON public.pv_products;
CREATE POLICY easymenu_api_le ON public.pv_products       FOR SELECT TO easymenu_api USING (true);
DROP POLICY IF EXISTS easymenu_api_le ON public.pv_product_units;
CREATE POLICY easymenu_api_le ON public.pv_product_units  FOR SELECT TO easymenu_api USING (true);
DROP POLICY IF EXISTS easymenu_api_le ON public.pv_product_groups;
CREATE POLICY easymenu_api_le ON public.pv_product_groups FOR SELECT TO easymenu_api USING (true);
DROP POLICY IF EXISTS easymenu_api_le ON public.pv_stores;
CREATE POLICY easymenu_api_le ON public.pv_stores         FOR SELECT TO easymenu_api USING (true);
DROP POLICY IF EXISTS easymenu_api_rw ON command.orders;
CREATE POLICY easymenu_api_rw ON command.orders      FOR ALL TO easymenu_api USING (true) WITH CHECK (status = 'open');
DROP POLICY IF EXISTS easymenu_api_rw ON command.order_items;
CREATE POLICY easymenu_api_rw ON command.order_items FOR ALL TO easymenu_api USING (true) WITH CHECK (origin = 'totem');
DROP POLICY IF EXISTS easymenu_api_rw ON cardapio.envios;
CREATE POLICY easymenu_api_rw ON cardapio.envios          FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS easymenu_api_rw ON cardapio.usuarios;
CREATE POLICY easymenu_api_rw ON cardapio.usuarios        FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS easymenu_api_rw ON cardapio.alteracoes;
CREATE POLICY easymenu_api_rw ON cardapio.alteracoes      FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS easymenu_api_rw ON cardapio.inscricoes_push;
CREATE POLICY easymenu_api_rw ON cardapio.inscricoes_push FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
