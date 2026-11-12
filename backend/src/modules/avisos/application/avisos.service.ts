import { Injectable, Logger } from '@nestjs/common';
import { EnviadorDePush, InscricoesPush } from './portas';

export interface PedidoPronto {
  envioId: string;
  numero: number;
  mesa: string;
  cliente: string;
}

/**
 * Avisa os garçons da loja. Com o app aberto, o próprio app percebe o pedido pronto (consulta a
 * cada poucos segundos); o push é para o celular no bolso, com a tela bloqueada.
 */
@Injectable()
export class AvisosService {
  private readonly log = new Logger('Avisos');

  constructor(
    private readonly inscricoes: InscricoesPush,
    private readonly enviador: EnviadorDePush,
  ) {}

  get chavePublica() {
    return this.enviador.chavePublica;
  }

  async prontoParaLevar(storeId: string, pedido: PedidoPronto) {
    if (!this.enviador.chavePublica) return { entregues: 0, expiradas: 0, falhas: 0 };
    const destinos = await this.inscricoes.dosGarconsDaLoja(storeId);
    const mensagem = {
      titulo: `Mesa ${pedido.mesa} — pedido pronto`,
      corpo: `#${pedido.numero} · ${pedido.cliente}. Pode levar à mesa.`,
      tag: `pronto-${pedido.envioId}`,
      url: '/garcom',
    };
    const resultados = await Promise.all(destinos.map((d) => this.enviador.enviar(d, mensagem)));
    const expiradas = destinos.filter((_, i) => resultados[i] === 'expirada').map((d) => d.id);
    if (expiradas.length) await this.inscricoes.apagar(expiradas);
    const resumo = {
      entregues: resultados.filter((r) => r === 'entregue').length,
      expiradas: expiradas.length,
      falhas: resultados.filter((r) => r === 'falhou').length,
    };
    if (destinos.length) this.log.log(`pronto #${pedido.numero} mesa=${pedido.mesa}: ${JSON.stringify(resumo)}`);
    return resumo;
  }
}
