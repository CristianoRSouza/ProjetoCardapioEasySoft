# EasyMenu V2 — cardápio digital da mesa

O cliente lê o QR code colado na mesa, informa o nome, monta o pedido no celular e envia para a
cozinha. O pedido cai **nas mesmas tabelas de comanda do EasyFood** (`command.orders` /
`command.order_items` no Supabase) e aparece na tela **Comandas** do EasyFood Manager, sem nenhuma
mudança no EasyFood.

Refeito a partir do protótipo `frontendDOAPPNOVO` (Lovable / TanStack Start), que simulava tudo no
navegador.

| Pasta | O quê | Stack |
|---|---|---|
| `frontend/` | telas do cliente, da cozinha e do garçom, QR codes e cadastro da equipe | Next.js 16, React 19, Tailwind 4, zustand |
| `backend/` | API: mesa, cardápio, pedidos, login da equipe, fila da cozinha, app do garçom e push | NestJS 12, pg, zod, web-push |

| Tela | Quem usa |
|---|---|
| `/mesa/<token>` → `/cardapio` → `/carrinho` → `/minha-mesa` | cliente, pelo QR da mesa |
| `/cozinha` | cozinha (usuário e senha), num computador ou tela touch, espelhável na TV |
| `/garcom` → `/garcom/mesa/<n>` → `/garcom/mesa/<n>/pedir` | garçom (usuário e senha), no celular; instalável na Tela de Início |
| `/admin/qrcodes` e `/admin/equipe` | administrador (`ADMIN_API_KEY`) |

Node **26.13.0** nos dois (`.nvmrc`).

## Ambiente novo (homologação ou produção)

Passo a passo numerado, com os scripts na ordem, em [`implantacao/LEIA-ME.md`](implantacao/LEIA-ME.md):
conferir a base, criar as tabelas, criar o usuário da API, gerar os segredos, ligar a descida para
a loja, conferir e testar de ponta a ponta.

## Rodar local

```sh
# API (porta 3030) — crie o backend/.env a partir do .env.example
cd backend && npm install && npm run db:migrar && npm run build && npm start

# Front (porta 3000) — repassa /api/v1/* para a API (BACKEND_URL)
cd frontend && npm install && npm run dev
```

O `BACKEND_URL` é lido **no build** (`next build`): os rewrites do Next ficam gravados no
`.next`. Trocar a variável no `next start` não muda nada; é preciso gerar o build de novo (o
`Dockerfile` já recebe como `ARG`).

Gerar os QR codes: abra `/admin/qrcodes`, informe a `ADMIN_API_KEY`, o id da loja
(`pv_stores.id`) e as mesas (`1-20, VIP1`). Imprima e cole nas mesas.

## Como o pedido é gravado

- Cada mesa tem **uma comanda aberta**: `barcode = 'MESA-<n>'`, `table_name = <n>`,
  `totem_name = 'CARDAPIO-DIGITAL'`. Cada envio do cardápio acrescenta itens nela. Fechada a conta
  no caixa ou no autoatendimento, o próximo pedido abre uma comanda nova.
- Itens gravados **igual ao totem** (conferido nas comandas reais de homologação): `origin='totem'`,
  `status='active'`, `product_id`, `product_barcode`, `unit_id` e `unit_code`.
- **O preço vem sempre do cadastro** (`pv_products.sale_price`), nunca do celular.
- O que as tabelas do EasyFood não têm onde guardar — nome de quem pediu, observações e andamento na
  cozinha — vai em `cardapio.envios` (migração `backend/database/migrations/0001_cardapio.sql`,
  schema próprio, só acrescenta).
- Dois celulares da mesma mesa enviando juntos caem na mesma comanda (lock por mesa na transação).

## Tela da cozinha (fase 3)

- **Login próprio da equipe** em `cardapio.usuarios` (migração `0002_equipe.sql`), papel `cozinha`
  ou `garcom` (fase 4). Cadastro em `/admin/equipe`. Não usa os usuários do Manager.
- Cards por envio em três colunas: **Novos**, **Em preparo**, **Prontos** (os prontos ficam 30 min
  para "Desfazer"). A tela consulta a API a cada 3 s, bipa quando chega pedido e marca em amarelo
  (8 min) e vermelho (15 min) a espera.
- **Iniciar preparo** / **Pronto** gravam `cardapio.envios.status`, `iniciado_em`, `pronto_em` e
  `updated_at`. O celular do cliente, na tela de pedidos, mostra o aviso e vibra. O sincronizador
  (`easyFoodSyncV2`, gatilho da `sql/120`) leva o status para o PG da loja.
- Item cancelado no caixa aparece riscado ("não preparar"). Comanda cancelada some da tela.
- A tela manda o status que estava vendo (`de`): se duas telas clicam juntas, uma passa e a outra
  recebe 409 e recarrega, em vez de pular etapa.

## App do garçom (fase 4)

- **Login próprio** (papel `garcom`, cadastro em `/admin/equipe`). Migração `0003_garcom.sql`.
- **Prontos para levar:** quando a cozinha marca "Pronto", o pedido aparece no topo do app com bipe,
  vibração e destaque. O garçom toca **"Entregue na mesa"** (status `entregue`: some da cozinha e o
  cliente vê "Entregue").
- **Push com o celular bloqueado** (Web Push/VAPID, `VAPID_*` no `.env`; sem as chaves, só com o app
  aberto). Android recebe pelo Chrome. **iPhone só recebe com o app instalado** na Tela de Início
  (iOS 16.4+): o app mostra o passo a passo. Precisa de HTTPS (em produção já é).
- **Mesas abertas** com o total da comanda e o andamento; "Abrir" uma mesa pelo número.
- **Lançar pedido** para a mesa com o mesmo cardápio do cliente (quantidade e observação por item;
  nome do cliente opcional, senão vai "Garçom <nome>"). Entra na mesma comanda `MESA-<n>`.
- **Corrigir item** (quantidade ou cancelar) **só enquanto a cozinha não começou e o item não foi
  lançado no caixa** (`synced_to_fb`). Depois disso, o app explica por que e manda usar o caixa:
  desfazer lançamento no Firebird é com o Sync-FB-PG. Cada correção grava quem fez em
  `cardapio.alteracoes`; a cozinha vê a quantidade nova e o item riscado; a loja recebe pelo Sync.
- O Sync V2 ganhou a regra que faltava para isso: num item de comanda do cardápio, evento da loja
  mais velho que a nuvem só leva `synced_to_fb`/`fb_id` (antes, o job de reconciliação podia desfazer
  o cancelamento do garçom — achado no ponta a ponta, ver `easyFoodSyncV2/docs/fase-2-cardapio.md`).

## Segurança

- O QR leva um token **assinado** (HMAC) com loja e mesa: trocar o número no link invalida o QR.
- Limite por IP: 120 req/min no geral e 10 envios/min.
- Corpo de no máximo 32 KB, validação com zod, erros em PT-BR sem detalhe interno.
- `/admin/qrcodes` e `/admin/equipe` exigem `X-Admin-Key`.
- Senha da equipe só como hash **scrypt**. Login errado, usuário inexistente ou desativado dão a
  mesma resposta (e gastam o mesmo tempo); 10 tentativas por minuto por IP.
- Sessão da equipe: token assinado (HMAC com chave **derivada** do `QR_TOKEN_SECRET`; um não vale
  pelo outro), válido por 14 h. A API confere o usuário no banco a cada requisição: desativar ou
  trocar a senha derruba a sessão aberta na hora. O garçom não entra na tela da cozinha (403).
- O role `easymenu_api` lê e escreve `cardapio.usuarios`, mas não apaga.
- O garçom só corrige `quantity`, `subtotal` e `status` de item de origem `totem` (GRANT por coluna):
  preço, produto e o vínculo com o Firebird ficam fora do alcance da API.
- Inscrição de push só aceita endereço dos serviços de push dos navegadores (Google, Mozilla, Apple,
  Microsoft): a API faz POST nele, e sem a lista um login de garçom faria a API chamar endereços
  internos (SSRF).
- Em produção a API conecta com o role restrito `easymenu_api` (`implantacao/3-usuario-da-api.sql`);
  `/api/v1/health/db` mostra `role_restrito: true`.

## Verificação

- `backend`: `npm run lint && npm run typecheck && npm test` (101 testes; o de push decifra a
  mensagem como o celular faria).
- `frontend`: `npm run lint && npm run typecheck && npm test && npm run build` (19 testes, incluindo o
  service worker do garçom).
- Fase 4 ponta a ponta (10/11/2026), no mesmo ambiente da fase 3 (role restrito, a `0003` aplicada
  duas vezes, Sync V2 até o PG da loja): 30 de 30 checagens — correção e cancelamento pelo garçom
  (comanda, retrato, total, histórico, cliente e cozinha), pedido lançado pelo garçom na mesma
  comanda, bloqueio depois de "Iniciar preparo", bloqueio de item lançado (a marca subiu da loja),
  push real até o servidor do Google, "Entregue" (cozinha não desfaz), tudo conferido no PG da loja.
  Corrida de correção logo após o pedido (8 rodadas, 0 a 6,5 s): nuvem e loja concordam. No
  navegador (celular simulado): painel, pronto chegando com destaque, correção, lançamento, tela do
  cliente com "Entregue", inscrição de push real no Google.
- Fase 3 ponta a ponta (09/11/2026), num Postgres local com as migrações reais, a API conectada
  com o **role restrito** (criado como está na homologação, depois a `0002`) e o Sync V2 até um PG
  de loja. No navegador:
  - cadastro do cozinheiro;
  - pedido da Carla na mesa 5 com "sem sal";
  - login errado recusado;
  - card na cozinha → "Iniciar preparo" → o celular avisou → "Pronto" → o celular avisou;
  - status `pronto` no PG da loja, sem eco.

  Casos de borda contra o banco real (9 de 9): item cancelado no caixa, duas telas ao mesmo tempo,
  comanda cancelada, usuário desativado (a tela aberta voltou para o login), role sem DELETE, só
  hash no banco.
- Ponta a ponta (feito em 06/11/2026), com:
  - Postgres local montado com as **migrações reais** do schema `command` e das views do Manager;
  - os 115 produtos reais da loja de homologação;
  - Playwright num celular simulado.

  24 de 24 checagens passaram: dois clientes na mesma mesa, a gravação conferida pelas views
  `vw_command_orders` e `vw_command_order_items`, 5 envios simultâneos virando 1 comanda, QR
  adulterado, conta fechada.

Requisitos e o que falta decidir: [`docs/requisitos.md`](docs/requisitos.md) e
[`docs/decisoes-pendentes.md`](docs/decisoes-pendentes.md).
