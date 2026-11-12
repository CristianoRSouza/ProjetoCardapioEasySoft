# Requisitos — reunião de 05/11/2026 (gravação de 35 min)

A transcrição completa (gerada com Whisper) fica fora do repositório.

## O produto

- Cardápio digital **no celular do cliente**. O cliente faz o pedido de verdade, e o pedido vai para a
  cozinha. A referência é o totem de autoatendimento do McDonald's, só que no celular.
- **QR code fixo, colado na mesa.** Não há cardápio de papel. Cada QR pertence a uma mesa, e o app
  abre já com a mesa identificada. O cliente nunca digita a mesa.
- O cliente informa **só o nome** e entra direto, sem senha.
- No cardápio o cliente:
  - escolhe produtos e abre o detalhe;
  - escolhe adicionais (cada um com preço);
  - retira ingredientes e define a quantidade;
  - adiciona ao carrinho.
- No carrinho o cliente corrige quantidades, remove itens e escreve uma observação para a cozinha.
  Ao enviar, aparece a confirmação.
- **O pedido enviado não pode ser alterado pelo cliente.** Para alterar, chama o garçom.
- Para pedir mais, o cliente lê o QR de novo e faz outro pedido. Os itens novos entram no pedido da
  mesa.
- O cliente pode **acompanhar** os pedidos da mesa.
- **Não há pagamento no cardápio.** O pagamento acontece depois, pela comanda, no autoatendimento ou
  no caixa.

## Dados

- O cardápio **alimenta as mesmas tabelas** que o EasyFood já alimenta: mesmo banco, mesmas tabelas,
  mesmo fluxo. A parte do cardápio é "alimentar a tabela comandas" (com os produtos da venda).
- Produtos, unidades e a parte fiscal já estão cadastrados, e não é preciso cadastrar nada.
  Transações/PIX e NFC-e **não** são alimentadas pelo cardápio.
- **Não mexer no EasyFood Manager.** Ele só lê o banco e já está preparado.
- Trabalhar **no Supabase de homologação** (EasyERP-Hom, `ltixkslqlreybdhutpbr`). Lá pode-se
  testar à vontade sem afetar produção.
- "Comanda" não é número da mesa. É um conceito que será amadurecido depois.

## Fases

1. **Agora:** o cardápio grava no Supabase, e o pedido aparece na tela de Comandas do Manager na
   nuvem. "Esquece o Postgres local por enquanto."
2. Ajustar o sincronizador **EasyFoodService Sync PG SB**, instalado na máquina da loja, para também
   **baixar** da nuvem para o Postgres local. Hoje ele só sobe. O fluxo do cardápio é o inverso do
   totem: nuvem → local.
3. **Tela da cozinha:**
   - fica num computador ou tela touch na cozinha, espelhável numa TV;
   - acesso com usuário e senha;
   - mostra cards por pedido;
   - o cozinheiro marca "iniciar preparo", e o cliente é notificado de que o pedido começou;
   - o cozinheiro marca "pronto", e o cliente e o garçom são notificados.
4. **App do garçom:**
   - login próprio;
   - é quase igual ao do cliente, mas pode editar o pedido (depois de ver se a cozinha já começou);
   - recebe notificação push/vibração quando o prato fica pronto.
   - Mostrar a tela para o cliente fica como evolução futura.

## Design

Usar o design do protótipo. Tirar o que era só simulação, como os botões para escolher mesa e o
simulador de pedidos da cozinha.

## O que já foi entregue

- **Fase 1** inteira.
- **Fase 2** no `easyFoodSyncV2`.
- **Fase 3** (09/11/2026):
  - login da cozinha com usuário e senha (cadastro em `/admin/equipe`);
  - cards por pedido, "Iniciar preparo" e "Pronto";
  - aviso e vibração no celular do cliente, quando ele está na tela de pedidos (como combinado
    na reunião: "se ele estiver nessa tela, ele vai ver");
  - status descendo para a loja.

- **Fase 4** (10/11/2026), app do garçom em `/garcom`:
  - login próprio;
  - prontos para levar com bipe, vibração e push (inclusive com o celular bloqueado), e
    "Entregue na mesa";
  - mesas abertas, lançar pedido com o cardápio do cliente;
  - editar o pedido "depois de ver se a cozinha já começou": corrige quantidade ou cancela enquanto
    a cozinha não começou e o item não foi lançado no caixa.
  - "Mostrar a tela para o cliente" continua como evolução futura (reunião).
