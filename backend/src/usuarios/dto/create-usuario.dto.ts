import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { TipoUsuario } from '../../generated/prisma/client.js';
import { IsCpf } from '../../common/validators/is-cpf.validator.js';

const apenasDigitos = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

export class CreateUsuarioDto {
  @IsString({ message: 'Nome deve ser um texto' })
  @MinLength(3, { message: 'Nome deve ter pelo menos 3 caracteres' })
  nome!: string;

  @Transform(apenasDigitos)
  @IsCpf({ message: 'CPF inválido' })
  cpf!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @Transform(apenasDigitos)
  @Matches(/^\d{10,11}$/, {
    message: 'Telefone deve conter 10 ou 11 dígitos',
  })
  telefone!: string;

  @IsString({ message: 'Senha deve ser um texto' })
  @MinLength(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Senha deve conter ao menos uma letra e um número',
  })
  senha!: string;

  @IsOptional()
  @IsEnum(TipoUsuario, { message: 'Tipo de usuário inválido' })
  tipo?: TipoUsuario;

  @IsString({ message: 'Vínculo deve ser um texto' })
  @MinLength(1, { message: 'Vínculo é obrigatório' })
  vinculo!: string;
}
