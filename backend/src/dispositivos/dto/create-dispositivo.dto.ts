

import { IsInt, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateDispositivoDto {
  @IsInt()
  @IsNotEmpty()
  talhao_id: number;

  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  modelo: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsOptional()
  @IsDateString()
  data_instalacao?: string;
}

