import { PartialType } from '@nestjs/mapped-types';
import { CreateCulturaDto } from './create-cultura.dto.js';

export class UpdateCulturaDto extends PartialType(CreateCulturaDto) {}
