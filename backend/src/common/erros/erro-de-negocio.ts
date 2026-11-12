/**
 * Erro esperado, com mensagem pronta para o cliente (PT-BR) e status HTTP.
 * Qualquer outra exceção vira 500 com mensagem genérica — detalhe interno não vaza.
 */
export class ErroDeNegocio extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroDeNegocio';
  }
}

export const naoEncontrado = (codigo: string, mensagem: string) => new ErroDeNegocio(404, codigo, mensagem);
export const invalido = (codigo: string, mensagem: string) => new ErroDeNegocio(422, codigo, mensagem);
