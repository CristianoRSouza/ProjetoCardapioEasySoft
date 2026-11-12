import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ErroDeNegocio } from '../erros/erro-de-negocio';

const MENSAGEM_POR_STATUS: Record<number, string> = {
  400: 'Requisição inválida.',
  401: 'Não autorizado.',
  403: 'Acesso negado.',
  404: 'Não encontrado.',
  429: 'Muitas tentativas. Aguarde um instante e tente de novo.',
};

/** Toda resposta de erro sai no formato { error, message, statusCode }. */
@Catch()
export class FiltroDeErros implements ExceptionFilter {
  private readonly log = new Logger('Erro');

  catch(erro: unknown, host: ArgumentsHost) {
    this.responder(erro, host.switchToHttp().getResponse<Response>());
  }

  responder(erro: unknown, res: Response) {
    if (erro instanceof ErroDeNegocio) {
      res.status(erro.status).json({ error: erro.codigo, message: erro.message, statusCode: erro.status });
      return;
    }
    if (erro instanceof HttpException) {
      const status = erro.getStatus();
      const corpo = erro.getResponse();
      const detalhe = typeof corpo === 'object' && corpo && 'message' in corpo ? corpo.message : undefined;
      res.status(status).json({
        error: status === 422 ? 'dados_invalidos' : `http_${status}`,
        message: typeof detalhe === 'string' ? detalhe : (MENSAGEM_POR_STATUS[status] ?? 'Erro.'),
        ...(Array.isArray(detalhe) ? { detalhes: detalhe } : {}),
        statusCode: status,
      });
      return;
    }
    this.log.error(erro instanceof Error ? (erro.stack ?? erro.message) : String(erro));
    res.status(500).json({ error: 'erro_interno', message: 'Erro interno. Tente novamente.', statusCode: 500 });
  }
}
