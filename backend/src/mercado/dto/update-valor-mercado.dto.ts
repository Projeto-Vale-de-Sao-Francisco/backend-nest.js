import { PartialType } from '@nestjs/mapped-types';
import { CreateValorMercadoDto } from './create-valor-mercado.dto.js';

export class UpdateValorMercadoDto extends PartialType(CreateValorMercadoDto, {
  skipNullProperties: false,
}) {}
