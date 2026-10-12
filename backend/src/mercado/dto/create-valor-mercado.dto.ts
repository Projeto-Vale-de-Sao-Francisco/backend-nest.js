import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateBy,
} from 'class-validator';
import { Prisma } from '../../generated/prisma/client.js';

export class CreateValorMercadoDto {
  @Type(() => Number)
  @IsInt({ message: 'cultura_id deve ser inteiro' })
  @Min(1, { message: 'cultura_id deve ser positivo' })
  cultura_id!: number;

  @IsString({ message: 'mercado_destino deve ser texto' })
  @IsNotEmpty({ message: 'mercado_destino é obrigatório' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  mercado_destino!: string;

  @IsString({ message: 'pais_destino deve ser texto' })
  @IsNotEmpty({ message: 'pais_destino é obrigatório' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  pais_destino!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' && Number.isFinite(value)
      ? new Prisma.Decimal(value).toFixed()
      : value,
  )
  @IsString({ message: 'preco deve ser decimal' })
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'preco deve ser um decimal positivo com ponto',
  })
  @ValidateBy({
    name: 'precoPositivo',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' &&
        /^\d+(\.\d+)?$/.test(value) &&
        new Prisma.Decimal(value).isPositive() &&
        !new Prisma.Decimal(value).isZero(),
      defaultMessage: () => 'preco deve ser positivo',
    },
  })
  preco!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'moeda deve ser texto' })
  @Matches(/^[A-Z]{3}$/, { message: 'moeda deve conter três letras ISO' })
  moeda!: string;

  @IsString({ message: 'unidade_medida deve ser texto' })
  @IsNotEmpty({ message: 'unidade_medida é obrigatória' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  unidade_medida!: string;

  @IsDateString(
    { strict: true },
    { message: 'data_referencia deve ser uma data ISO válida' },
  )
  data_referencia!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'demanda_estimada deve ser um número finito' })
  @Min(0, { message: 'demanda_estimada deve ser maior ou igual a zero' })
  demanda_estimada?: number;
}
