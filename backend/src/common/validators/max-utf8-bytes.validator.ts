import {
  registerDecorator,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'maxUtf8Bytes', async: false })
class MaxUtf8BytesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const [maxBytes] = args.constraints as [number];
    return (
      typeof value === 'string' &&
      Buffer.byteLength(value, 'utf8') <= maxBytes
    );
  }

  defaultMessage(args: ValidationArguments) {
    const [maxBytes] = args.constraints as [number];
    return `${args.property} deve ter no máximo ${maxBytes} bytes em UTF-8`;
  }
}

export function MaxUtf8Bytes(maxBytes: number): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      target: target.constructor,
      propertyName: String(propertyKey),
      constraints: [maxBytes],
      validator: MaxUtf8BytesConstraint,
    });
  };
}
