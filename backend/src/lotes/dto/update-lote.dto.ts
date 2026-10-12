import { PartialType } from '@nestjs/mapped-types';
import { CreateLoteDto } from './create-lote.dto.js';

export class UpdateLoteDto extends PartialType(CreateLoteDto) {}
