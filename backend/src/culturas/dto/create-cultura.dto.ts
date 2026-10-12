import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCulturaDto {
  @Transform(aparar)
  @IsString({ message: 'nome deve ser texto' })
  @IsNotEmpty({ message: 'nome é obrigatório' })
  nome!: string;

  @IsOptional()
  @Transform(aparar)
  @IsString({ message: 'variedade deve ser texto' })
  variedade?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'temperatura_min deve ser número' })
  temperatura_min?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'temperatura_max deve ser número' })
  temperatura_max?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'umidade_min deve ser número' })
  @Min(0, { message: 'umidade_min deve ser no mínimo 0' })
  @Max(100, { message: 'umidade_min deve ser no máximo 100' })
  umidade_min?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'umidade_max deve ser número' })
  @Min(0, { message: 'umidade_max deve ser no mínimo 0' })
  @Max(100, { message: 'umidade_max deve ser no máximo 100' })
  umidade_max?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ciclo_medio_dias deve ser inteiro' })
  @Min(1, { message: 'ciclo_medio_dias deve ser positivo' })
  ciclo_medio_dias?: number | null;

  @IsOptional()
  @Transform(aparar)
  @IsString({ message: 'descricao deve ser texto' })
  descricao?: string | null;
}
