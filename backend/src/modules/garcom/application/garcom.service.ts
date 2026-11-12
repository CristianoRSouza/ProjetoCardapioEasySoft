import { Injectable, Logger } from '@nestjs/common';
import { ErroDeNegocio, invalido, naoEncontrado } from '../../../common/erros/erro-de-negocio';
import { AvisosService } from '../../avisos/application/avisos.service';
import { InscricoesPush } from '../../avisos/application/portas';
import { CardapioService } from '../../cardapio/application/cardapio.service';
import type { Logado } from '../../equipe/application/equipe.service';
import { normalizarMesa } from '../../mesa/domain/token-da-mesa';
import type { ItemPedido } from '../../pedidos/domain/pedido';
import { PedidosService } from '../../pedidos/application/pedidos.service';
import { Comandas } from '../../pedidos/application/portas';
import { bloqueioDoItem, MENSAGEM_DO_BLOQUEIO } from '../domain/edicao';
import { Salao } from './portas';

const conflito = (codigo: string, mensagem: string) => new ErroDeNegocio(409, codigo, mensagem);

@Injectable()
export class GarcomService {
  private readonly log = new Logger('Garcom');

  constructor(
    private readonly salao: Salao,
    private readonly comandas: Comandas,
    private readonly pedidos: PedidosService,
    private readonly cardapio: CardapioService,
    private readonly avisos: AvisosService,
    private readonly inscricoes: InscricoesPush,
  ) {}

  /** A tela inicial do app: o que está pronto para levar e as mesas com comanda aberta. */
  async painel({ loja }: Logado) {
    const [prontos, mesas] = await Promise.all([this.salao.prontos(loja.id), this.salao.mesasAbertas(loja.id)]);
    return { restaurante: loja.nome, agora: new Date().toISOString(), prontos, mesas };
  }

  /** Pedidos da comanda aberta da mesa, com o que o garçom pode corrigir em cada item. */
  async mesa({ loja }: Logado, bruta: string) {
    const mesa = this.mesaValida(bruta);
    const envios = await this.comandas.enviosDaMesa(loja.id, mesa);
    const pedidos = envios.map((e) => ({
      ...e,
      itens: e.itens.map((i) => ({ ...i, bloqueio: bloqueioDoItem(e.status, i) })),
    }));
    const total = Math.round(pedidos.reduce((s, p) => s + p.total, 0) * 100) / 100;
    return { mesa, total, pedidos };
  }

  async cardapioDaLoja({ loja }: Logado) {
    const { restaurante, categorias, produtos } = await this.cardapio.daLoja(loja, '');
    return { restaurante, categorias, produtos };
  }

  /** Lança um pedido na comanda aberta da mesa (ou abre uma), como se fosse pelo QR. */
  async pedir({ usuario, loja }: Logado, bruta: string, entrada: { cliente?: string; observacao?: string; itens: ItemPedido[] }) {
    const mesa = this.mesaValida(bruta);
    const cliente = (entrada.cliente?.trim() || `Garçom ${usuario.nome}`).slice(0, 60);
    return this.pedidos.registrar(loja, mesa, { ...entrada, cliente }, usuario.id);
  }

  async alterarItem({ usuario, loja }: Logado, envioId: string, orderItemId: string, quantidade: number) {
    const r = await this.salao.alterarItem({ storeId: loja.id, envioId, orderItemId, quantidade, usuarioId: usuario.id });
    if (r === 'nao_encontrado') throw naoEncontrado('item_nao_encontrado', 'Item não encontrado neste pedido.');
    if (r === 'comanda_fechada') throw conflito('comanda_fechada', 'A comanda desta mesa já foi fechada.');
    if (r !== 'ok') throw conflito(r, MENSAGEM_DO_BLOQUEIO[r]);
    this.log.log(`envio ${envioId} item ${orderItemId}: quantidade ${quantidade} por ${usuario.login}`);
    return { quantidade };
  }

  async entregue({ usuario, loja }: Logado, envioId: string) {
    const r = await this.salao.marcarEntregue(loja.id, envioId);
    if (r === 'nao_encontrado') throw naoEncontrado('pedido_nao_encontrado', 'Pedido não encontrado.');
    if (r === 'status_mudou') throw conflito('status_mudou', 'Este pedido já foi entregue ou voltou para a cozinha.');
    this.log.log(`envio ${envioId}: entregue por ${usuario.login}`);
    return { status: 'entregue' as const };
  }

  // ---------- push ----------

  chaveDoPush() {
    return { chavePublica: this.avisos.chavePublica };
  }

  async inscrever({ usuario, loja }: Logado, inscricao: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    if (!this.avisos.chavePublica) throw conflito('push_desligado', 'As notificações não estão ativadas neste restaurante.');
    await this.inscricoes.salvar({ usuarioId: usuario.id, storeId: loja.id, endpoint: inscricao.endpoint, ...inscricao.keys });
    return { inscrito: true };
  }

  async desinscrever({ usuario }: Logado, endpoint: string) {
    await this.inscricoes.remover(usuario.id, endpoint);
    return { inscrito: false };
  }

  private mesaValida(bruta: string) {
    const mesa = normalizarMesa(bruta);
    if (!mesa) throw invalido('mesa_invalida', 'Mesa deve ter de 1 a 10 caracteres: letras, números ou hífen.');
    return mesa;
  }
}
