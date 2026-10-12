import { PickType } from '@nestjs/mapped-types';
import { ListValorMercadoDto } from './list-valor-mercado.dto.js';

export class ResumoMercadoDto extends PickType(ListValorMercadoDto, [
  'cultura_id',
  'mercado_destino',
  'data_inicio',
  'data_fim',
] as const) {}
