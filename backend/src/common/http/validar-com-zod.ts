import { type PipeTransform, UnprocessableEntityException } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Valida o corpo/parâmetro com um esquema zod; erro vira 422 com a lista de campos. */
export class ValidarComZod<T> implements PipeTransform<unknown, T> {
  constructor(private readonly esquema: ZodType<T>) {}

  transform(valor: unknown): T {
    const r = this.esquema.safeParse(valor);
    if (r.success) return r.data;
    throw new UnprocessableEntityException({
      message: r.error.issues.map((i) => `${i.path.join('.') || 'corpo'}: ${i.message}`),
    });
  }
}
