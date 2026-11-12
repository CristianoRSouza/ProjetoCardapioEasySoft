# Montar um ambiente do EasyMenu do zero

Passo a passo para ligar o cardápio digital num ambiente novo (homologação ou produção), na ordem.
Os arquivos desta pasta são numerados na ordem em que se rodam.

| # | Arquivo | Onde roda | Quem |
|---|---|---|---|
| 1 | `1-conferir-base.sql` | SQL Editor do Supabase do ambiente | quem tem acesso ao banco |
| 2 | `2-tabelas-do-cardapio.sql` | SQL Editor (como `postgres`) | quem tem acesso ao banco |
| 3 | `3-usuario-da-api.sql` | SQL Editor (como `postgres`), **trocando a senha** | quem tem acesso ao banco |
| 4 | `4-gerar-segredos.mjs` | qualquer PC com o projeto (`node`) | quem publica |
| — | publicar a API e o site | servidor (Docker) | time de deploy |
| 5 | `5-sync-do-cardapio.sql` | SQL Editor (como `postgres`), **depois do Sync V2 nas lojas** | quem tem acesso ao banco |
| 6 | `6-conferir-ambiente.sql` | SQL Editor | quem tem acesso ao banco |
| 7 | `7-testar-ambiente.mjs` | qualquer PC (`node`), **só em homologação** | quem publica |
| — | cadastrar equipe e gerar QR codes | telas `/admin/equipe` e `/admin/qrcodes` | administrador da loja |

Todos os SQL podem ser rodados de novo sem estragar nada. Os de conferência (1 e 6) só leem.

## Antes de começar: o que o ambiente já precisa ter

O EasyMenu **não cria** um Supabase do EasyFood. Ele se instala **dentro** de um que já existe e
usa as tabelas dele:

- comandas `command.orders` / `command.order_items`, das migrações do Manager
  (`easyfoodmanagerWEB/supabase/migrations`);
- cadastro `pv_companies`, `pv_stores`, `pv_products`, `pv_product_units` e `pv_product_groups`,
  preenchido pelo Sync das lojas;
- fila `ecb_sync.outbox` do Sync (`easyFoodSyncV2/sql/001`).

Homologação (`ltixkslqlreybdhutpbr`) e produção já têm tudo isso. O passo 1 confere. Num Supabase
vazio, as migrações do Manager têm um defeito conhecido (`docs/decisoes-pendentes.md`, item 7).

## 1. Conferir a base

Cole `1-conferir-base.sql` no SQL Editor e rode. **Todas as linhas precisam vir com `ok = true`.**
As que vierem `false` aparecem primeiro e dizem a tabela ou coluna que falta. Nesse caso, pare: o
ambiente não tem o EasyFood completo.

## 2. Tabelas do cardápio

Cole `2-tabelas-do-cardapio.sql` e rode. Ele cria o schema `cardapio`, com os pedidos, a equipe, as
correções do garçom e as inscrições de push. Não altera nenhuma tabela do EasyFood; em
`command.order_items` só dá uma permissão de coluna ao usuário da API.

O arquivo é gerado a partir de `backend/database/migrations/` e não deve ser editado à mão. Quem
preferir a linha de comando pode rodar `npm run db:migrar` no backend, com um `DATABASE_URL` do
usuário `postgres`.

## 3. Usuário de banco da API

Abra `3-usuario-da-api.sql`, **troque `TROQUE-ESTA-SENHA`** na linha marcada com `◄◄◄` por uma
senha forte (16+ caracteres, sem aspas simples) e rode. Guarde a senha no cofre do ambiente
(Infisical).

- Sem trocar a senha, o script se recusa a criar o usuário.
- Rodando de novo sem trocar a senha, o usuário já existente mantém a senha atual.
- Rodando com uma senha nova, ela é trocada: atualize o `DATABASE_URL` da API junto.

O `DATABASE_URL` da API fica assim:

```
postgresql://easymenu_api.<ref-do-projeto>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

## 4. Segredos da API

```sh
cd backend && npm install && cd ..
node implantacao/4-gerar-segredos.mjs https://<endereço-público-do-site>
```

O script mostra o `.env` da API pronto. Ele gera chaves novas: `QR_TOKEN_SECRET`, `ADMIN_API_KEY`
e o par VAPID das notificações do garçom. Complete o `DATABASE_URL` com a senha do passo 3 e
guarde tudo no cofre do ambiente.

- **Cada ambiente tem os seus segredos.** Trocar o `QR_TOKEN_SECRET` invalida os QR codes já
  impressos. Trocar o par VAPID desinscreve os celulares dos garçons.
- O site precisa do `BACKEND_URL` **no build** (`docker build --build-arg BACKEND_URL=...`). Ele
  fica gravado no build; trocar depois exige um build novo.
- As notificações com o celular bloqueado só funcionam com o site em **HTTPS**.

## Publicar a API e o site

Fica com o time de deploy. Use `backend/Dockerfile` e `frontend/Dockerfile` (Node 26), com o `.env`
do passo 4. Depois de publicar, `https://<site>/api/v1/health/db` deve responder
`{"status":"ok","role_restrito":true}`.

## 5. Ligar a descida dos pedidos para a loja

**Só depois de o Sync V2 (`easyFoodSyncV2`) estar instalado e rodando em todas as lojas que vão usar
o cardápio.** Então cole `5-sync-do-cardapio.sql` e rode.

Sem este passo, o cardápio funciona na nuvem: Manager, cozinha e garçom veem tudo. Mas os pedidos
não chegam ao Postgres da loja nem ao caixa. O arquivo é uma cópia de
`easyFoodSyncV2/sql/120_supabase_cardapio_comandas_outbox.sql`; se aquele mudar, copie de novo.

## 6. Conferir o ambiente

Cole `6-conferir-ambiente.sql` e rode. **Todas as linhas precisam vir com `ok = true`.** A coluna
`passo` diz qual script refazer quando alguma vier `false`. Antes do passo 5, só os três gatilhos
do Sync aparecem como `false`.

## 7. Teste de ponta a ponta (homologação)

```sh
API_URL=https://<site>/api/v1 ADMIN_API_KEY=<do passo 4> STORE_ID=<uuid da loja> \
CONFIRMO_DADOS_DE_TESTE=sim SITE_URL=https://<site> \
node implantacao/7-testar-ambiente.mjs
```

O teste refaz o caminho das fases 1, 3 e 4:

1. o cliente pede pelo QR;
2. o garçom corrige e cancela um item e lança um pedido;
3. a cozinha inicia o preparo (a partir daí a correção é recusada) e marca pronto;
4. o garçom marca entregue.

Com `LOJA_DATABASE_URL` (o Postgres da loja), o teste também confere que o pedido chegou à loja pelo
Sync.

**Ele cria dados de verdade**: a comanda `MESA-TESTE` fica aberta, e o caixa pode lançá-la no
Firebird. Use só em homologação e feche a comanda pelo caixa ou pelo Manager no fim. Os usuários
de teste (`teste.garcom` e `teste.cozinha`) ficam desativados.

## Depois: colocar a loja para usar

1. **Equipe:** em `https://<site>/admin/equipe`, com a `ADMIN_API_KEY`, cadastre os usuários da
   cozinha e dos garçons da loja.
2. **QR codes:** em `https://<site>/admin/qrcodes`, informe o id da loja e as mesas (`1-20, VIP1`).
   Depois imprima e cole nas mesas.
3. **Cozinha:** abra `https://<site>/cozinha` no computador ou na TV da cozinha.
4. **Garçons:** cada garçom abre `https://<site>/garcom` no celular e instala na Tela de Início.
   No iPhone, as notificações só funcionam com o app instalado.

## Como isto foi provado (12/11/2026)

Num Postgres novo, só com a base do EasyFood (as migrações reais de comanda do Manager e o
`ecb_sync` do Sync), estes arquivos foram rodados como estão, na ordem:

- **Passo 1:** 61 de 61 itens ok. Num banco vazio, aponta 59 faltando, sem dar erro.
- **Passo 2:** rodou duas vezes sem erro.
- **Passo 3:**
  - recusou a senha de exemplo sem criar nada;
  - criou o usuário com uma senha;
  - na segunda vez, manteve a senha;
  - o login com a senha nova funcionou.
- **Passo 6 antes do 5:** só os 3 gatilhos apareceram como faltando.
- **Passo 5:** rodou duas vezes.
- **Passo 6 depois do 5:** 55 de 55 ok.
- **Passo 4:** as chaves geradas subiram a API com o usuário restrito.
- **Passo 7:** 18 de 18 ok, com 16 eventos na fila do Sync e os usuários de teste desativados.

O `backend/test/implantacao.spec.ts` impede que esta pasta fique para trás das migrações.
