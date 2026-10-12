import { BadRequestException } from '@nestjs/common';
import { isISO8601 } from 'class-validator';

export function optionalPositiveInt(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) {
    throw new BadRequestException(field + ' deve ser um inteiro positivo.');
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 2147483647) {
    throw new BadRequestException(
      field + ' deve ser um inteiro positivo válido.',
    );
  }
  return number;
}

export function optionalDate(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    !isISO8601(value, { strict: true }) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new BadRequestException(
      field + ' deve ser uma data ISO 8601 válida.',
    );
  }
  return value;
}

export function optionalBoolean(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (value !== 'true' && value !== 'false') {
    throw new BadRequestException(field + ' deve ser true ou false.');
  }
  return value === 'true';
}

export function optionalText(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(field + ' deve ser um texto não vazio.');
  }
  return value;
}

export function optionalStatus(
  value: unknown,
  allowed: string[],
): string | undefined {
  const status = optionalText(value, 'status')?.trim().toLowerCase();
  if (status !== undefined && !allowed.includes(status)) {
    throw new BadRequestException(
      'Status inválido. Use ' + allowed.join(' ou ') + '.',
    );
  }
  return status;
}
