import { IsNumber, Max, Min } from 'class-validator';

export class CreateThingSpeakDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-50)
  @Max(65)
  temperatura!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  umidade!: number;
}
