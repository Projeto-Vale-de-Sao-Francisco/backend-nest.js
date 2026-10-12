import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @IsString({ message: 'Senha deve ser um texto' })
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  senha!: string;
}
