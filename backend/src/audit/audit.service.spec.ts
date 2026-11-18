import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AuditService', () => {
  const prisma = {
    audit_Log: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  };
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('filtra, pagina e retorna somente os campos necessários ao administrador', async () => {
    prisma.audit_Log.findMany.mockResolvedValue([]);
    prisma.audit_Log.count.mockResolvedValue(0);

    await service.findAll({
      page: 2,
      limit: 10,
      usuarioId: 7,
      acao: 'ATUALIZAR',
      recurso: 'USUARIO',
      recursoId: '4',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
    });

    const [query] = prisma.audit_Log.findMany.mock.calls[0];
    expect(query).toMatchObject({
      skip: 10,
      take: 10,
      where: {
        usuario_id: 7,
        acao: 'ATUALIZAR',
        recurso: 'USUARIO',
        recurso_id: { contains: '4' },
      },
      select: {
        id: true,
        acao: true,
        recurso: true,
        recurso_id: true,
        ip_origem: true,
        criado_em: true,
        usuario: { select: { nome: true } },
      },
    });
    expect(query.select).not.toHaveProperty('dados_antes');
    expect(query.select).not.toHaveProperty('dados_depois');
  });

  it('rejeita intervalo de datas invertido', async () => {
    await expect(
      service.findAll({ dataInicio: '2026-02-01', dataFim: '2026-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.audit_Log.findMany).not.toHaveBeenCalled();
  });
});
