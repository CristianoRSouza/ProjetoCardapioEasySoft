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

-- Permissão do role da API, quando ele já existe neste banco (deploy/role-e-grants.sql).
-- Sem DELETE: usuário sai desativado, não apagado.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'easymenu_api') THEN
    GRANT SELECT, INSERT, UPDATE ON cardapio.usuarios TO easymenu_api;
    DROP POLICY IF EXISTS easymenu_api_rw ON cardapio.usuarios;
    CREATE POLICY easymenu_api_rw ON cardapio.usuarios FOR ALL TO easymenu_api USING (true) WITH CHECK (true);
  END IF;
END $$;
