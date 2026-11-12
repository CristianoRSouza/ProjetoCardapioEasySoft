import { Injectable } from '@nestjs/common';
import { MesaService } from '../../mesa/application/mesa.service';
import type { Loja } from '../../mesa/application/portas';
import { Catalogo, type Produto } from './portas';

const SEM_CATEGORIA = { id: 'outros', nome: 'Cardápio' };

export interface CardapioDaMesa {
  restaurante: string;
  mesa: string;
  categorias: { id: string; nome: string }[];
  produtos: (Omit<Produto, 'codigoDeBarras' | 'unidadeId' | 'unidadeCodigo' | 'categoriaNome'> & {
    categoriaId: string;
  })[];
}

@Injectable()
export class CardapioService {
  constructor(
    private readonly mesas: MesaService,
    private readonly catalogo: Catalogo,
  ) {}

  async daMesa(token: string): Promise<CardapioDaMesa> {
    const { loja, mesa } = await this.mesas.abrir(token);
    return this.daLoja(loja, mesa);
  }

  /** O mesmo cardápio do cliente, para o app do garçom (que já sabe a loja pela sessão). */
  async daLoja(loja: Loja, mesa: string): Promise<CardapioDaMesa> {
    const produtos = await this.catalogo.listar(loja.id);

    // Categoria = grupo do produto no EasyFood. Produto sem grupo vai para "Cardápio", no fim.
    const categorias = new Map<string, string>();
    for (const p of produtos) if (p.categoriaId && p.categoriaNome) categorias.set(p.categoriaId, p.categoriaNome);
    const ordenadas = [...categorias].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (produtos.some((p) => !p.categoriaId || !categorias.has(p.categoriaId))) ordenadas.push(SEM_CATEGORIA);

    return {
      restaurante: loja.nome,
      mesa,
      categorias: ordenadas,
      produtos: produtos.map((p) => ({
        id: p.id,
        nome: p.nome,
        descricao: p.descricao,
        preco: p.preco,
        imagemUrl: p.imagemUrl,
        categoriaId: p.categoriaId && categorias.has(p.categoriaId) ? p.categoriaId : SEM_CATEGORIA.id,
      })),
    };
  }
}
