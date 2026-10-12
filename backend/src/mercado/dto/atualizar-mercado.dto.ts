import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  Min,
} from 'class-validator';
export class AtualizarMercadoDto {
  @Type(() => Number)
  @IsInt({ message: 'cultura_id deve ser inteiro' })
  @Min(1, { message: 'cultura_id deve ser positivo' })
  cultura_id!: number;
  @IsOptional()
  @IsString({ message: 'fonte deve ser texto' })
  @IsNotEmpty({ message: 'fonte não pode ser vazia' })
  fonte?: string;
  @IsOptional()
  @IsBoolean({ message: 'forcar deve ser booleano' })
  forcar = false;
}
