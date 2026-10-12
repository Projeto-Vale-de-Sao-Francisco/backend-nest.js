import { PickType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { STATUS_LOGISTICA } from './create-logistica.dto.js';

export class ListLogisticaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  empresa_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  colheita_id?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(STATUS_LOGISTICA)
  status?: (typeof STATUS_LOGISTICA)[number];

  @IsOptional()
  @IsString()
  destino?: string;

  @IsOptional()
  @IsString()
  modal?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  data_inicio?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  data_fim?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ResumoLogisticaDto extends PickType(ListLogisticaDto, [
  'empresa_id',
  'colheita_id',
  'status',
  'destino',
  'modal',
  'data_inicio',
  'data_fim',
] as const) {}
