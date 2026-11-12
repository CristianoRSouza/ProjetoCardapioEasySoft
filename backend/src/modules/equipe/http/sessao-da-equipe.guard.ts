import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { EquipeService, type Logado } from '../application/equipe.service';
import type { Papel } from '../domain/sessao';

const PAPEIS = 'easymenu:papeis';

/** Quais papéis entram na rota. Sem o decorator, a rota fica fechada para todos. */
export const Papeis = (...papeis: Papel[]) => SetMetadata(PAPEIS, papeis);

type ComLogado = Request & { logado?: Logado };

/** Exige `Authorization: Bearer <sessão da equipe>` válida e com um dos papéis da rota. */
@Injectable()
export class SessaoDaEquipeGuard implements CanActivate {
  constructor(
    private readonly equipe: EquipeService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const papeis =
      this.reflector.getAllAndOverride<Papel[] | undefined>(PAPEIS, [contexto.getHandler(), contexto.getClass()]) ?? [];
    const req = contexto.switchToHttp().getRequest<ComLogado>();
    const [tipo, token] = (req.header('authorization') ?? '').split(' ');
    req.logado = await this.equipe.validar(tipo === 'Bearer' && token ? token : '', papeis);
    return true;
  }
}

/** O usuário que o guard já validou. */
export const UsuarioLogado = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): Logado => contexto.switchToHttp().getRequest<ComLogado>().logado!,
);
