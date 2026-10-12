import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { TipoUsuario } from '../../generated/prisma/client.js';
import { CreateUsuarioDto } from './create-usuario.dto.js';

export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {
  @IsOptional()
  @IsEnum(TipoUsuario, { message: 'Tipo de usuário inválido' })
  tipo?: TipoUsuario;
}
