import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ValidarComZod } from '../../../common/http/validar-com-zod';
import { ChaveDeAdminGuard } from '../../mesa/http/chave-de-admin.guard';
import { EquipeService } from '../application/equipe.service';

const nome = z.string().trim().min(2, 'nome muito curto').max(60);
const senha = z.string().min(6, 'a senha precisa de pelo menos 6 caracteres').max(100);

const NovoUsuario = z.object({
  storeId: z.uuid('storeId deve ser o id (uuid) da loja'),
  nome,
  login: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{3,40}$/, 'login: de 3 a 40 caracteres, só letras, números, ponto, hífen ou _'),
  senha,
  papel: z.enum(['cozinha', 'garcom']),
});

const Mudancas = z
  .object({ storeId: z.uuid(), nome: nome.optional(), senha: senha.optional(), ativo: z.boolean().optional() })
  .refine((m) => m.nome !== undefined || m.senha !== undefined || m.ativo !== undefined, 'nada para alterar');

const DaLoja = z.object({ storeId: z.uuid('storeId deve ser o id (uuid) da loja') });

/** Cadastro da equipe de uma loja. Mesma chave de administrador dos QR codes. */
@Controller('admin/equipe')
@UseGuards(ChaveDeAdminGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AdminEquipeController {
  constructor(private readonly equipe: EquipeService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(@Query(new ValidarComZod(DaLoja)) { storeId }: z.infer<typeof DaLoja>) {
    return this.equipe.listar(storeId);
  }

  @Post()
  criar(@Body(new ValidarComZod(NovoUsuario)) corpo: z.infer<typeof NovoUsuario>) {
    return this.equipe.criar(corpo);
  }

  @Patch(':id')
  alterar(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) id: string,
    @Body(new ValidarComZod(Mudancas)) { storeId, ...mudancas }: z.infer<typeof Mudancas>,
  ) {
    return this.equipe.alterar(storeId, id, mudancas);
  }
}
