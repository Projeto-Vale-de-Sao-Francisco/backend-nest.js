import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { Perfil } from '../generated/prisma/enums.js';

export class CriarUsuarioDto {
  @ApiProperty() @IsString() @Length(2, 120) nomeCompleto: string;
  @ApiProperty({ description: 'Somente digitos' }) @IsString() @Length(11, 14) cpf: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(6) senha: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefone?: string;
  @ApiProperty({ enum: Perfil }) @IsEnum(Perfil) perfil: Perfil;
}

export class AtualizarUsuarioDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) nomeCompleto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(6) senha?: string;
  @ApiPropertyOptional({ enum: Perfil }) @IsOptional() @IsEnum(Perfil) perfil?: Perfil;
  @ApiPropertyOptional({ enum: ['ATIVO', 'INATIVO'] }) @IsOptional() @IsIn(['ATIVO', 'INATIVO']) status?: string;
}

export class VincularEmpresaDto {
  @ApiProperty() @Type(() => Number) @IsInt() empresaId: number;
}

export class VincularPropriedadeDto {
  @ApiProperty() @Type(() => Number) @IsInt() propriedadeId: number;
}
