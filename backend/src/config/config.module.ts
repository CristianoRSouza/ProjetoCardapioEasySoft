import { Global, Module } from '@nestjs/common';
import { lerAmbiente, type Ambiente } from './env';

/** Token de injeção do ambiente já validado. */
export abstract class Config {
  abstract readonly valores: Ambiente;
}

@Global()
@Module({
  providers: [{ provide: Config, useFactory: (): Config => ({ valores: lerAmbiente() }) }],
  exports: [Config],
})
export class ConfigModule {}
