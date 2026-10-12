import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class DashboardFiltrosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'propriedade_id deve ser inteiro' })
  @Min(1, { message: 'propriedade_id deve ser positivo' })
  propriedade_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'talhao_id deve ser inteiro' })
  @Min(1, { message: 'talhao_id deve ser positivo' })
  talhao_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'cultura_id deve ser inteiro' })
  @Min(1, { message: 'cultura_id deve ser positivo' })
  cultura_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sensor_id deve ser inteiro' })
  @Min(1, { message: 'sensor_id deve ser positivo' })
  sensor_id?: number;

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
}

export class HistoricoFiltrosDto extends DashboardFiltrosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve ser inteiro' })
  @Min(1, { message: 'page deve ser no mínimo 1' })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser inteiro' })
  @Min(1, { message: 'limit deve ser no mínimo 1' })
  @Max(500, { message: 'limit deve ser no máximo 500' })
  limit = 100;
}
