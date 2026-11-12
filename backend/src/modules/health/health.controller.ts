import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DbService } from '../../infra/db/db.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Banco respondendo, com o usuário de conexão — em produção deve ser easymenu_api. */
  @Get('db')
  @Header('Cache-Control', 'no-store')
  async banco() {
    const { rows } = await this.db.query<{ usuario: string }>('select current_user as usuario');
    return { status: 'ok', role_restrito: rows[0]?.usuario === 'easymenu_api' };
  }
}
