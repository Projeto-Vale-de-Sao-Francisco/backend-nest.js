import { BadRequestException } from '@nestjs/common';
import { PaginatedResult, Pagination, PaginationInput } from './auth.types.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parsePagination(input: PaginationInput = {}): Pagination {
  const page = parsePositiveInteger(input.page, 'page', 1);
  const limit = parsePositiveInteger(input.limit, 'limit', DEFAULT_PAGE_SIZE);

  if (limit > MAX_PAGE_SIZE) {
    throw new BadRequestException(
      `limit deve ser menor ou igual a ${MAX_PAGE_SIZE}.`,
    );
  }

  return { page, limit, skip: (page - 1) * limit };
}

export function paginatedResult<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

function parsePositiveInteger(
  value: string | number | undefined,
  name: string,
  defaultValue: number,
) {
  if (value === undefined) {
    return defaultValue;
  }

  const text = String(value);
  if (!/^[1-9]\d*$/.test(text)) {
    throw new BadRequestException(
      `${name} deve ser um número inteiro positivo.`,
    );
  }

  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) {
    throw new BadRequestException(`${name} está fora do intervalo permitido.`);
  }

  return parsed;
}
