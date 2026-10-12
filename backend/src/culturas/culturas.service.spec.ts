import {
  BadRequestException,
  ConflictException,
  ValidationPipe,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CulturasService } from './culturas.service.js';
import { CreateCulturaDto } from './dto/create-cultura.dto.js';

describe('CulturasService', () => {
  let db: {
    cultura: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let service: CulturasService;

  beforeEach(() => {
    db = {
      cultura: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn().mockImplementation(({ data }) => ({ id: 4, ...data })),
        update: vi.fn(),
      },
    };
    service = new CulturasService(db as unknown as PrismaService);
  });

  it('cadastra cultura com faixas coerentes e nome normalizado', async () => {
    const resultado = await service.create({
      nome: ' Goiaba ',
      variedade: 'Paluma',
      temperatura_min: 18,
      temperatura_max: 32,
      umidade_min: 40,
      umidade_max: 80,
      ciclo_medio_dias: 120,
      descricao: 'Teste',
    });
    expect(resultado).toMatchObject({ id: 4, nome: 'Goiaba' });
    expect(db.cultura.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nome: 'Goiaba', ciclo_medio_dias: 120 }),
    });
  });

  it('rejeita nome duplicado e faixas invertidas', async () => {
    db.cultura.findFirst.mockResolvedValueOnce({ id: 1 });
    await expect(service.create({ nome: 'Manga' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      service.create({ nome: 'Melão', umidade_min: 90, umidade_max: 30 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.cultura.create).not.toHaveBeenCalled();
  });

  it('DTO rejeita ciclo não positivo e umidade fora de 0 a 100', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    await expect(
      pipe.transform(
        { nome: 'Melão', ciclo_medio_dias: 0, umidade_max: 101 },
        { type: 'body', metatype: CreateCulturaDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
