import { Injectable, Logger } from '@nestjs/common';
import { ErroDeNegocio, invalido, naoEncontrado } from '../../../common/erros/erro-de-negocio';
import { AvisosService } from '../../avisos/application/avisos.service';
import type { Logado } from '../../equipe/application/equipe.service';
import type { StatusNaCozinha } from '../../pedidos/domain/pedido';
import { transicaoPermitida } from '../domain/andamento';
import { FilaDaCozinha } from './portas';

@Injectable()
export class CozinhaService {
  private readonly log = new Logger('Cozinha');

  constructor(
    private readonly fila: FilaDaCozinha,
    private readonly avisos: AvisosService,
  ) {}

  async pedidos({ loja }: Logado) {
    return { restaurante: loja.nome, agora: new Date().toISOString(), pedidos: await this.fila.listar(loja.id) };
  }

  /** `de` é o status que a tela mostrava: se outra tela já mudou, recusa em vez de pular etapa. */
  async mudarStatus({ usuario, loja }: Logado, envioId: string, de: StatusNaCozinha, para: StatusNaCozinha) {
    if (!transicaoPermitida(de, para)) {
      throw invalido('mudanca_invalida', 'Esta mudança de etapa não é permitida.');
    }
    const r = await this.fila.mudarStatus(loja.id, envioId, de, para);
    if (r === 'nao_encontrado') throw naoEncontrado('pedido_nao_encontrado', 'Pedido não encontrado.');
    if (r === 'status_mudou') {
      throw new ErroDeNegocio(409, 'status_mudou', 'Este pedido já foi atualizado em outra tela. A lista foi recarregada.');
    }
    this.log.log(`envio ${envioId}: ${de} → ${para} por ${usuario.login}`);
    if (para === 'pronto') {
      // Não segura a resposta da cozinha: o push vai para os serviços do Google/Apple/Mozilla.
      void this.avisos
        .prontoParaLevar(loja.id, { envioId, ...r })
        .catch((e: unknown) => this.log.warn(`aviso ao garçom falhou: ${(e as Error).message}`));
    }
    return { status: para };
  }
}
