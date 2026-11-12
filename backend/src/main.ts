import './config/env-local';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { Config } from './config/config.module';
import { criarApp } from './criar-app';

async function iniciar() {
  const app = await criarApp();
  const { PORT } = app.get(Config).valores;
  await app.listen(PORT);
  new Logger('EasyMenu').log(`API ouvindo na porta ${PORT}`);
}

void iniciar();
