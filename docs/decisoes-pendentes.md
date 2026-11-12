# Decisões pendentes (para o chefe)

## 1. Senha do Postgres de homologação — resolvido

O `DATABASE_URL` de homologação foi atualizado e as migrações `0001`, `0002` e `0003` estão
aplicadas (a `0002` e a `0003` pelo SQL Editor). As fases 1, 3 e 4 foram testadas lá de ponta a
ponta.

## 2. Adicionais e "retirar ingredientes"

O protótipo tem esses dois blocos com dados inventados. **O EasyFood não tem cadastro de adicionais
nem de ingredientes.** As tabelas `pv_product_kit_items` e `flavor_config_id` não servem para isso.
Por enquanto o detalhe do produto tem **quantidade + observação livre** ("sem cebola", "bacon
extra").

- Adicional **com preço** precisa de cadastro e de virar item na comanda, para cobrar.
- **De onde vêm esses dados?**

## 3. Código da comanda da mesa

Usei `barcode = 'MESA-<n>'`, uma comanda aberta por mesa, com `totem_name = 'CARDAPIO-DIGITAL'`.
Esse código não colide com as comandas físicas numéricas ("1", "2"…). Na reunião, o chefe disse que
o conceito de comanda vai ser amadurecido.

**Pergunta:** quando o garçom entrega a comanda física, ela deve absorver os itens da mesa?

## 4. `origin` dos itens

O enum `command.item_origin` só aceita `system` e `totem`. Usei `totem`, igual ao autoatendimento.
Efeito colateral, que é o comportamento correto até a fase 2: o Manager **bloqueia fechar** a
comanda enquanto houver item `totem` não sincronizado com o Firebird (`synced_to_fb = false`).

Ter um valor próprio, `cardapio`, exigiria uma migração no EasyFood, e o chefe pediu para não mexer
nele.

## 5. Quais produtos aparecem no cardápio

Hoje aparecem todos os produtos **ativos, não excluídos e com preço > 0** da loja. Em homologação
são 108.

- Em homologação nenhum produto tem grupo, então tudo cai na categoria "Cardápio". Com grupos
  cadastrados, viram categorias.
- **Existe um campo que diga "vende no cardápio/autoatendimento"?** O `show_in_pos` está `false`
  nos produtos que o totem vende, então não usei.

## 6. Fotos com endereço local

Há produto com `image_url = http://127.0.0.1:3001/images/53.jpg` (servidor de imagens local da
loja), e o celular do cliente não alcança esse endereço. A API manda só fotos `https` públicas; nos
outros produtos aparece um bloco neutro.

## 7. Defeito numa migração existente do Manager (só para registro)

Em banco **vazio**, aplicar `20260417140000` e depois `20260420120000` falha com
`relation "order_items_pkey" already exists`. A segunda renomeia a tabela antiga, mas o índice da PK
continua com o mesmo nome.

Em homologação e produção já passou, então não afeta nada hoje. Afeta quem tentar montar um banco
novo do zero (recuperação, ambiente novo). Corrigir exige uma migração nova no repositório do
Manager.

## 8. Fases 2, 3 e 4

- **Fase 2 (sincronizador nuvem → local): feita no `Desktop\easyFoodSyncV2`**, a reescrita do
  EasyFoodService Sync PG SB. As comandas `CARDAPIO-DIGITAL` descem para `public.orders` /
  `public.order_items` da loja. Para ligar: Sync V2 na loja primeiro, depois a `sql/120` na nuvem
  (ver `easyFoodSyncV2/docs/fase-2-cardapio.md`). Isso também resolve o item 4: o Sync-FB-PG da loja
  passa a ver os itens e os lança no Firebird.
- **Observações:** `cardapio.envios` também desce para a loja, numa tabela própria
  (`easyFoodSyncV2/sql/122`), com cliente, observações e status. Para sair impressa na cozinha, falta o
  Sync-FB-PG ler `cardapio.vw_observacoes_dos_itens` ao lançar no Firebird.
- **Fase 3 (tela da cozinha): feita e ligada na homologação** (a `0002_equipe.sql` foi rodada no
  SQL Editor em 10/11/2026). Teste real, 13 de 13: cozinheiro `cozinha.teste` cadastrado, pedido
  #104 na mesa 90, "Iniciar preparo" e "Pronto" vistos pelo cliente, clique atrasado → 409, status
  `pronto` na loja pelo Sync V2, sem eco. Em produção: rodar a mesma `0002` depois de publicar a API.
- **Fase 4 (app do garçom): feita** (ver o README). Decisões que tomei, para o chefe confirmar:
  - **O que o garçom edita:** quantidade e cancelamento de item, só enquanto a cozinha não começou
    o pedido **e** o item não foi lançado no caixa. Para acrescentar, ele lança um pedido novo na
    mesa. Depois do lançamento no Firebird, a correção é pelo caixa: o Sync não desfaz lançamento
    (`easyFoodSyncV2/docs/decisoes-pendentes.md` §3). **Na prática, se o Sync-FB-PG da loja lança o
    item segundos depois do pedido, a janela de correção pelo app é curta.**
  - **Push:** Web Push (sem app nativo). Android direto; iPhone só com o app instalado na Tela de
    Início. Cada ambiente precisa de um par de chaves VAPID (`VAPID_*`); trocar o par desinscreve os
    celulares. Em homologação o par já está no `.env` de homologação.
  - **"Entregue":** status novo depois de "pronto", marcado pelo garçom.
  - Para ligar na homologação: rodar `backend/database/migrations/0003_garcom.sql` no SQL Editor e
    cadastrar o garçom em `/admin/equipe`. Antes da `0003`, a API nova funciona igual à anterior (o
    app do garçom é que não).

## 9. Cadastro do "sem cebola" e dos adicionais

O cardápio tem a observação livre por item, que chega à cozinha e à loja. O cadastro de adicionais
com preço e de ingredientes que dá para tirar ainda não foi feito. Sugestão:
- **Adicional** = um produto que já existe no EasyFood (ex.: "BACON EXTRA"), ligado ao produto
  principal num cadastro do EasyMenu. Ele entra na comanda como item comum, com o preço do
  cadastro. Assim o caixa e o Firebird cobram sem mudar nada no EasyFood.
- **Ingrediente que dá para tirar** = uma lista de textos por produto ("cebola", "picles"). No
  pedido, vira "SEM CEBOLA" na observação do item, que já chega à cozinha, ao Manager e à loja.
- **Pergunta para o chefe:** os adicionais já estão cadastrados como produtos no ERP? Se não, quem
  cadastra?
