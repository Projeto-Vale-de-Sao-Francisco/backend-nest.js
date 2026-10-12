import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const situacao = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateLoteDto {
  @Transform(aparar)
  @IsString({ message: 'nome deve ser texto' })
  @IsNotEmpty({ message: 'nome é obrigatório' })
  nome!: string;

  @Type(() => Number)
  @IsInt({ message: 'propriedade_id deve ser inteiro' })
  @Min(1, { message: 'propriedade_id deve ser positivo' })
  propriedade_id!: number;

  @Type(() => Number)
  @IsInt({ message: 'cultura_id deve ser inteiro' })
  @Min(1, { message: 'cultura_id deve ser positivo' })
  cultura_id!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'area deve ser número' })
  @IsPositive({ message: 'area deve ser positiva' })
  area!: number;

  @IsDateString(
    { strict: true },
    { message: 'data_plantio deve ser uma data ISO válida' },
  )
  data_plantio!: string;

  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'previsao_colheita deve ser uma data ISO válida' },
  )
  previsao_colheita?: string;

  @Transform(situacao)
  @IsIn(['ativo', 'inativo'], {
    message: 'situacao deve ser ativo ou inativo',
  })
  situacao!: 'ativo' | 'inativo';
}
