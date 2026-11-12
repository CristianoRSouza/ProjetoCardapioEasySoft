import { Injectable, Logger } from '@nestjs/common';
import { Catalogo } from '../../cardapio/application/portas';
import type { Loja } from '../../mesa/application/portas';
import { MesaService } from '../../mesa/application/mesa.service';
import { calcularItens, type ItemPedido } from '../domain/pedido';
import { Comandas } from './portas';

export interface EntradaDoEnvio {
  cliente: string;
  observacao?: string;
  itens: ItemPedido[];
}

/** O que o celular do cliente vê de cada pedido da mesa. */
export interface PedidoParaOCliente {
  id: string;
  numero: number;
  cliente: string;
  observacao: string | null;
  status: string;
  criadoEm: string;
  total: number;
  itens: { nome: string; quantidade: number; precoUnitario: number; observacao: string | null; cancelado: boolean }[];
}

const centavos = (v: number) => Math.round(v * 100) / 100;

@Injectable()
export class PedidosService {
  private readonly log = new Logger('Pedidos');

  constructor(
    private readonly mesas: MesaService,
    private readonly catalogo: Catalogo,
    private readonly comandas: Comandas,
  ) {}

  async enviar(token: string, entrada: EntradaDoEnvio) {
    const { loja, mesa } = await this.mesas.abrir(token);
    return this.registrar(loja, mesa, entrada, null);
  }

  /** Grava o envio na comanda aberta da mesa. Usado pelo QR do cliente e pelo app do garçom. */
  async registrar(loja: Loja, mesa: string, entrada: EntradaDoEnvio, garcomId: string | null) {
    const ids = [...new Set(entrada.itens.map((i) => i.produtoId))];
    const { itens, total } = calcularItens(entrada.itens, await this.catalogo.buscarPorIds(loja.id, ids));

    const envio = await this.comandas.registrarEnvio({
      companyId: loja.companyId,
      storeId: loja.id,
      mesa,
      cliente: entrada.cliente.trim(),
      observacao: entrada.observacao?.trim() || null,
      itens,
      total,
      garcomId,
    });
    this.log.log(
      `envio #${envio.numero} loja=${loja.id} mesa=${mesa} itens=${itens.length} total=${total.toFixed(2)}${garcomId ? ' (garçom)' : ''}`,
    );
    return { numero: envio.numero, total };
  }

  async daMesa(token: string): Promise<{ mesa: string; total: number; pedidos: PedidoParaOCliente[] }> {
    const { loja, mesa } = await this.mesas.abrir(token);
    const envios = await this.comandas.enviosDaMesa(loja.id, mesa);
    // O cliente não precisa saber o que já foi lançado no caixa nem o id interno do item.
    const pedidos = envios.map((e) => ({
      id: e.id,
      numero: e.numero,
      cliente: e.cliente,
      observacao: e.observacao,
      status: e.status,
      criadoEm: e.criadoEm,
      total: e.total,
      itens: e.itens.map((i) => ({
        nome: i.nome,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        observacao: i.observacao,
        cancelado: i.cancelado,
      })),
    }));
    return { mesa, total: centavos(pedidos.reduce((s, p) => s + p.total, 0)), pedidos };
  }
}
