import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const STATUS_LOGISTICA = [
  'planejada',
  'em_transporte',
  'concluida',
  'cancelada',
] as const;
const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateLogisticaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  empresa_id!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  colheita_id!: number;

  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  origem!: string;

  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  destino!: string;

  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  modal!: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  transportadora?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  data_prevista?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tempo_estimado_horas?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  custo_estimado?: number | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(STATUS_LOGISTICA)
  status!: (typeof STATUS_LOGISTICA)[number];
}
