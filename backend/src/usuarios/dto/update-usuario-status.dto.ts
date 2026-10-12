import { IsEnum } from 'class-validator';
import { StatusUsuario } from '../../generated/prisma/client.js';

export class UpdateUsuarioStatusDto {
  @IsEnum(StatusUsuario, { message: 'Status de usuário inválido' })
  status!: StatusUsuario;
}
