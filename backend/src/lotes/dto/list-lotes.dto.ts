import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListLotesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'propriedade_id deve ser inteiro' })
  @Min(1, { message: 'propriedade_id deve ser positivo' })
  propriedade_id?: number;
}
