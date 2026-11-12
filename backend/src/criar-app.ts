import { NotFoundException, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { FiltroDeErros } from './common/http/filtro-de-erros';
import { Config } from './config/config.module';

export const PREFIXO = 'api/v1';

/** Monta a aplicação com tudo que vale em produção. Os testes de HTTP usam esta mesma função. */
export async function criarApp(modulo: unknown = AppModule): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(modulo as never, { bodyParser: false });
  const { CORS_ORIGINS, TRUST_PROXY } = app.get(Config).valores;

  app.set('trust proxy', TRUST_PROXY);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '32kb' });
  app.use(helmet());
  app.enableCors({ origin: CORS_ORIGINS.length ? CORS_ORIGINS : false, credentials: false });
  app.setGlobalPrefix(PREFIXO);
  const filtro = new FiltroDeErros();
  app.useGlobalFilters(filtro);
  app.enableShutdownHooks();
  await app.init();

  // O Nest só responde 404 dentro do prefixo; fora dele cairia no HTML padrão do Express.
  app.use((_req: Request, res: Response, _next: NextFunction) =>
    filtro.responder(new NotFoundException('Rota não encontrada.'), res),
  );
  return app;
}
