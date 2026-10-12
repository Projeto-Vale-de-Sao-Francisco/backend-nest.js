import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
export class ListValorMercadoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'cultura_id deve ser inteiro' })
  @Min(1, { message: 'cultura_id deve ser positivo' })
  cultura_id?: number;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'mercado_destino deve ser texto' })
  mercado_destino?: string;
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'data_inicio deve ser uma data ISO válida' },
  )
  data_inicio?: string;
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'data_fim deve ser uma data ISO válida' },
  )
  data_fim?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve ser inteiro' })
  @Min(1, { message: 'page deve ser no mínimo 1' })
  page = 1;
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser inteiro' })
  @Min(1, { message: 'limit deve ser no mínimo 1' })
  @Max(100, { message: 'limit deve ser no máximo 100' })
  limit = 20;
}
