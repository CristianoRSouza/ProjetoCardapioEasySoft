-- Role de banco da API do EasyMenu. Rode UMA vez por banco, à mão, no SQL Editor do Supabase,
-- trocando a senha. Não é migration de propósito: cria usuário com senha.
--
-- O que a API pode, e nada além disso:
--   * LER produtos, unidades, grupos e lojas (montar o cardápio e validar o preço);
--   * CRIAR comanda e itens em command.orders / command.order_items (status 'open', origem 'totem');
--   * CORRIGIR quantidade/cancelar item de origem 'totem' (app do garçom, 0003_garcom);
--   * LER/ESCREVER cardapio.envios, cardapio.usuarios, cardapio.alteracoes, cardapio.inscricoes_push.
-- Não pode apagar comanda, mexer em transação/PIX, NFC-e ou em qualquer tabela de cadastro.

CREATE ROLE easymenu_api LOGIN PASSWORD 'TROQUE-ESTA-SENHA' NOINHERIT;
ALTER ROLE easymenu_api SET statement_timeout = '15s';

GRANT USAGE ON SCHEMA public, command, cardapio TO easymenu_api;

GRANT SELECT ON public.pv_products, public.pv_product_units, public.pv_product_groups, public.pv_stores
  TO easymenu_api;

GRANT SELECT, INSERT ON command.orders, command.order_items TO easymenu_api;
GRANT UPDATE (updated_at) ON command.orders TO easymenu_api;
GRANT UPDATE (quantity, subtotal, status, updated_at) ON command.order_items TO easymenu_api;  -- 0003_garcom

GRANT SELECT, INSERT, UPDATE ON cardapio.envios TO easymenu_api;
GRANT SELECT, INSERT, UPDATE ON cardapio.usuarios TO easymenu_api;  -- 0002_equipe
GRANT SELECT, INSERT ON cardapio.alteracoes TO easymenu_api;                    -- 0003_garcom
GRANT SELECT, INSERT, UPDATE, DELETE ON cardapio.inscricoes_push TO easymenu_api; -- 0003_garcom

-- As tabelas command.* e pv_* têm RLS. O role precisa de policies próprias (o service_role ignora
-- RLS, este role não). Escopo: tudo — a API só consulta pela loja que veio no QR assinado.
CREATE POLICY easymenu_api_le ON public.pv_products       FOR SELECT TO easymenu_api USING (true);
CREATE POLICY easymenu_api_le ON public.pv_product_units  FOR SELECT TO easymenu_api USING (true);
CREATE POLICY easymenu_api_le ON public.pv_product_groups FOR SELECT TO easymenu_api USING (true);
CREATE POLICY easymenu_api_le ON public.pv_stores         FOR SELECT TO easymenu_api USING (true);
CREATE POLICY easymenu_api_rw ON command.orders      FOR ALL TO easymenu_api USING (true) WITH CHECK (status = 'open');
CREATE POLICY easymenu_api_rw ON command.order_items FOR ALL TO easymenu_api USING (true) WITH CHECK (origin = 'totem');
CREATE POLICY easymenu_api_rw ON cardapio.envios     FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
CREATE POLICY easymenu_api_rw ON cardapio.usuarios   FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
CREATE POLICY easymenu_api_rw ON cardapio.alteracoes      FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
CREATE POLICY easymenu_api_rw ON cardapio.inscricoes_push FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
