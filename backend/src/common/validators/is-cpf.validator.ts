import {
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

export function isCpfValido(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{11}$/.test(value)) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(value)) {
    return false;
  }

  const calcularDigito = (base: string, pesoInicial: number) => {
    const soma = base.split('').reduce(
      (total, digito, indice) => total + Number(digito) * (pesoInicial - indice),
      0,
    );
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const primeiroDigito = calcularDigito(value.slice(0, 9), 10);
  const segundoDigito = calcularDigito(value.slice(0, 10), 11);

  return (
    primeiroDigito === Number(value[9]) && segundoDigito === Number(value[10])
  );
}

@ValidatorConstraint({ name: 'isCpf', async: false })
export class IsCpfConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isCpfValido(value);
  }

  defaultMessage(_arguments: ValidationArguments): string {
    return 'CPF inválido';
  }
}

export function IsCpf(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsCpfConstraint,
    });
  };
}
