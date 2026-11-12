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
-- Só a API (role easymenu_api, ver deploy/role-e-grants.sql) e o service_role acessam.
ALTER TABLE cardapio.envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cardapio.envios FROM anon, authenticated;
