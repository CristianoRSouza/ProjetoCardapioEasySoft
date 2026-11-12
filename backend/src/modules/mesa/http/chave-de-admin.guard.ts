import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Config } from '../../../config/config.module';

/** Exige o cabeçalho X-Admin-Key igual ao ADMIN_API_KEY (comparação em tempo constante). */
@Injectable()
export class ChaveDeAdminGuard implements CanActivate {
  constructor(private readonly config: Config) {}

  canActivate(contexto: ExecutionContext): boolean {
    const recebida = contexto.switchToHttp().getRequest<Request>().header('x-admin-key') ?? '';
    // Hash dos dois lados: tamanhos iguais para o timingSafeEqual, sem vazar o comprimento da chave.
    const a = createHash('sha256').update(recebida).digest();
    const b = createHash('sha256').update(this.config.valores.ADMIN_API_KEY).digest();
    if (!recebida || !timingSafeEqual(a, b)) throw new UnauthorizedException('Chave de administrador inválida.');
    return true;
  }
}
