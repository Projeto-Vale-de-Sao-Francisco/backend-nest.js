import { Module, type Type } from '@nestjs/common';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AuthModule } from '../auth/auth.module.js';
import type { FonteMercado } from './fontes/fonte-mercado.interface.js';
import { HttpSeguroService } from './fontes/http-seguro.service.js';
import {
  FONTES_MERCADO,
  MercadoFontesService,
} from './fontes/mercado-fontes.service.js';
import { PtaxService } from './fontes/ptax.service.js';
import { MercadoController } from './mercado.controller.js';
import { MercadoService } from './mercado.service.js';

// Apenas classes locais versionadas *.fonte são carregadas; ids de usuários/env nunca viram caminhos.
const pasta = new URL('./fontes/', import.meta.url);
const extensao = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
const classes: Type<FonteMercado>[] = await Promise.all(
  readdirSync(fileURLToPath(pasta))
    .filter((arquivo) => arquivo.endsWith(`.fonte${extensao}`))
    .sort()
    .map(async (arquivo) => {
      const modulo = (await import(new URL(arquivo, pasta).href)) as {
        default: Type<FonteMercado>;
      };
      return modulo.default;
    }),
);
@Module({
  imports: [AuthModule],
  controllers: [MercadoController],
  providers: [
    MercadoService,
    HttpSeguroService,
    ...classes,
    {
      provide: FONTES_MERCADO,
      inject: classes,
      useFactory: (...fontes: FonteMercado[]) => fontes,
    },
    MercadoFontesService,
    PtaxService,
  ],
})
export class MercadoModule {}
