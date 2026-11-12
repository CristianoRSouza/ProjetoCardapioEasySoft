import type { StatusNaCozinha } from '../../pedidos/domain/pedido';

/**
 * Andamento de um envio na cozinha. Quem decide é o cozinheiro (reunião de 05/11):
 *   recebido → em_preparo  ("Iniciar preparo": o cliente vê que começou)
 *   em_preparo → pronto    ("Pronto": o cliente e o garçom são avisados)
 * e um passo para trás em cada um ("Desfazer"), para o toque errado na tela.
 */
const PERMITIDAS: ReadonlySet<string> = new Set([
  'recebido>em_preparo',
  'em_preparo>pronto',
  'em_preparo>recebido',
  'pronto>em_preparo',
]);

export const transicaoPermitida = (de: StatusNaCozinha, para: StatusNaCozinha) => PERMITIDAS.has(`${de}>${para}`);

/** Depois de pronto, o card fica visível este tempo (para desfazer); depois some da tela. */
export const PRONTOS_VISIVEIS_MIN = 30;

/** Envio mais velho que isto não aparece mais, mesmo que ninguém tenha marcado como pronto. */
export const JANELA_DA_COZINHA_HORAS = 24;
