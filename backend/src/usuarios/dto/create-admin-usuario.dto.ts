import { IsEnum } from 'class-validator';
import { StatusUsuario, TipoUsuario } from '../../generated/prisma/client.js';
import { CreateUsuarioDto } from './create-usuario.dto.js';

export class CreateAdminUsuarioDto extends CreateUsuarioDto {
  @IsEnum(TipoUsuario, { message: 'Tipo de usuário inválido' })
  declare tipo: TipoUsuario;

  @IsEnum(StatusUsuario, { message: 'Status de usuário inválido' })
  status!: StatusUsuario;
}
