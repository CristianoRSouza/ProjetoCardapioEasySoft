import { Injectable } from '@nestjs/common';
import { DbService } from '../../../infra/db/db.service';
import { Catalogo, type Produto } from '../application/portas';

interface Linha {
  id: string;
  barcode: string;
  nome: string;
  descricao: string | null;
  preco: string;
  image_url: string | null;
  group_id: string | null;
  group_name: string | null;
  unit_id: string | null;
  unit_code: number | null;
}

// Nome de vitrine: o "nome no e-commerce" quando cadastrado, senão a descrição do PDV.
const SELECT = `
  select p.id, p.barcode,
         coalesce(nullif(trim(p.ecommerce_name), ''), p.description) as nome,
         nullif(trim(p.ecommerce_description), '') as descricao,
         round(p.sale_price, 2)::text as preco,
         p.image_url,
         g.id as group_id, g.name as group_name,
         p.unit_id, u.legacy_code as unit_code
    from public.pv_products p
    left join public.pv_product_groups g on g.id = p.group_id and g.is_active
    left join public.pv_product_units u on u.id = p.unit_id
   where p.store_id = $1
     and p.is_active
     and not coalesce(p.is_deleted, false)
     and p.sale_price > 0`;

/**
 * Foto só vai para o celular se for um endereço público https. Há produtos cadastrados com a foto
 * no servidor de imagens LOCAL da loja (ex.: http://127.0.0.1:3001/images/53.jpg, visto em
 * homologação) — inalcançável do celular do cliente; nesses o front mostra o bloco neutro.
 */
export function fotoPublica(url: string | null): string | null {
  if (!url) return null;
  try {
    const { protocol, hostname } = new URL(url);
    const privado =
      hostname === 'localhost' ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      !hostname.includes('.');
    return protocol === 'https:' && !privado ? url : null;
  } catch {
    return null;
  }
}

function paraProduto(l: Linha): Produto {
  return {
    id: l.id,
    codigoDeBarras: l.barcode,
    nome: l.nome,
    descricao: l.descricao ?? '',
    preco: Number(l.preco),
    imagemUrl: fotoPublica(l.image_url),
    categoriaId: l.group_id,
    categoriaNome: l.group_name,
    unidadeId: l.unit_id,
    unidadeCodigo: l.unit_code,
  };
}

@Injectable()
export class CatalogoPg extends Catalogo {
  constructor(private readonly db: DbService) {
    super();
  }

  override async listar(storeId: string): Promise<Produto[]> {
    const { rows } = await this.db.query<Linha>(`${SELECT} order by g.name nulls last, nome limit 1000`, [storeId]);
    return rows.map(paraProduto);
  }

  override async buscarPorIds(storeId: string, ids: string[]): Promise<Produto[]> {
    if (!ids.length) return [];
    const { rows } = await this.db.query<Linha>(`${SELECT} and p.id = any($2::uuid[])`, [storeId, ids]);
    return rows.map(paraProduto);
  }
}
