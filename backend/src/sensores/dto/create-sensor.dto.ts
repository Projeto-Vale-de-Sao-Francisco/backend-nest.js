import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateSensorDto {
  @IsInt()
  @IsNotEmpty()
  dispositivo_id: number;

  @IsString()
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsNotEmpty()
  unidade_medida: string;

  @IsString()
  @IsNotEmpty()
  status: string;
}

