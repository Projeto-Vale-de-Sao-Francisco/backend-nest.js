import { PartialType } from '@nestjs/mapped-types';
import { CreateLogisticaDto } from './create-logistica.dto.js';

export class UpdateLogisticaDto extends PartialType(CreateLogisticaDto, {
  skipNullProperties: false,
}) {}
