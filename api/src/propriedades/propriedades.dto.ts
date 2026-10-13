import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsPositive, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';

export class CriarPropriedadeDto {
  @ApiProperty() @IsString() @Length(2, 120) nome: string;
  @ApiProperty({ example: 'Vale do São Francisco' }) @IsString() localizacao: string;
  @ApiPropertyOptional() @IsOptional() @IsString() municipio?: string;
  @ApiPropertyOptional({ example: 'PE' }) @IsOptional() @IsString() @Length(2, 2) estado?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional({ description: 'hectares' }) @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() areaTotal?: number;
  @ApiPropertyOptional({ description: 'Produtor/empresa responsavel' }) @IsOptional() @Type(() => Number) @IsInt() empresaId?: number;
}

export class AtualizarPropriedadeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() localizacao?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() municipio?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 2) estado?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() areaTotal?: number;
  @ApiPropertyOptional({ enum: ['ATIVO', 'INATIVO'] }) @IsOptional() @IsIn(['ATIVO', 'INATIVO']) status?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() empresaId?: number;
}

export class VincularUsuarioDto {
  @ApiProperty() @Type(() => Number) @IsInt() usuarioId: number;
}
