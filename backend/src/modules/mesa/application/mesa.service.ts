import { Injectable } from '@nestjs/common';
import { Config } from '../../../config/config.module';
import { invalido, naoEncontrado } from '../../../common/erros/erro-de-negocio';
import { gerarToken, lerToken, normalizarMesa } from '../domain/token-da-mesa';
import { type Loja, Lojas } from './portas';

export interface MesaAberta {
  loja: Loja;
  mesa: string;
}

export interface QrCodeDaMesa {
  mesa: string;
  token: string;
  url: string;
}

@Injectable()
export class MesaService {
  constructor(
    private readonly lojas: Lojas,
    private readonly config: Config,
  ) {}

  /** Resolve o QR lido pelo cliente. Token adulterado e loja inativa dão a mesma resposta. */
  async abrir(token: string): Promise<MesaAberta> {
    const lido = lerToken(token, this.config.valores.QR_TOKEN_SECRET);
    const loja = lido ? await this.lojas.buscar(lido.storeId) : null;
    if (!lido || !loja) {
      throw naoEncontrado('qr_invalido', 'QR code inválido. Leia o QR code da mesa novamente ou chame o garçom.');
    }
    return { loja, mesa: lido.mesa };
  }

  async gerarQrCodes(storeId: string, mesas: string[]): Promise<{ loja: Loja; qrcodes: QrCodeDaMesa[] }> {
    const loja = await this.lojas.buscar(storeId);
    if (!loja) throw naoEncontrado('loja_nao_encontrada', 'Loja não encontrada ou inativa.');

    const normalizadas = [...new Set(mesas.map((m) => normalizarMesa(m)))];
    if (normalizadas.some((m) => m === null)) {
      throw invalido('mesa_invalida', 'Mesa deve ter de 1 a 10 caracteres: letras, números ou hífen.');
    }
    const base = this.config.valores.PUBLIC_APP_URL.replace(/\/+$/, '');
    const qrcodes = (normalizadas as string[]).map((mesa) => {
      const token = gerarToken({ storeId: loja.id, mesa }, this.config.valores.QR_TOKEN_SECRET);
      return { mesa, token, url: `${base}/mesa/${token}` };
    });
    return { loja, qrcodes };
  }
}
