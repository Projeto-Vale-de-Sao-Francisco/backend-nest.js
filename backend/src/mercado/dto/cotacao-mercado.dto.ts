import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
export class CotacaoMercadoDto {
  @Type(() => Number)
  @IsInt({ message: 'cultura_id deve ser inteiro' })
  @Min(1, { message: 'cultura_id deve ser positivo' })
  cultura_id!: number;
}
