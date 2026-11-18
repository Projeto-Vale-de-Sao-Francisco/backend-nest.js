import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditQueryDto } from './dto/audit-query.dto.js';

export interface AuditEvent {
  usuarioId?: number | null;
  acao: string;
  recurso: string;
  recursoId?: string | number | null;
  ipOrigem?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    event: AuditEvent,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = transaction ?? this.prisma;
    await client.audit_Log.create({
      data: {
        usuario_id: event.usuarioId ?? null,
        acao: event.acao,
        recurso: event.recurso,
        recurso_id:
          event.recursoId === undefined || event.recursoId === null
            ? null
            : String(event.recursoId),
        ip_origem: event.ipOrigem ?? null,
      },
    });
  }

  async findAll(filters: AuditQueryDto) {
    const start = filters.dataInicio
      ? new Date(filters.dataInicio)
      : undefined;
    const end = filters.dataFim ? new Date(filters.dataFim) : undefined;
    if (end && /^\d{4}-\d{2}-\d{2}$/.test(filters.dataFim ?? '')) {
      end.setUTCHours(23, 59, 59, 999);
    }
    if (start && end && start > end) {
      throw new BadRequestException(
        'dataInicio deve ser anterior ou igual a dataFim.',
      );
    }

    const where: Prisma.Audit_LogWhereInput = {
      ...(filters.usuarioId ? { usuario_id: filters.usuarioId } : {}),
      ...(filters.acao ? { acao: filters.acao } : {}),
      ...(filters.recurso ? { recurso: filters.recurso } : {}),
      ...(filters.recursoId
        ? { recurso_id: { contains: filters.recursoId } }
        : {}),
      ...(start || end
        ? {
            criado_em: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
    };
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const [data, total] = await Promise.all([
      this.prisma.audit_Log.findMany({
        where,
        select: {
          id: true,
          usuario_id: true,
          acao: true,
          recurso: true,
          recurso_id: true,
          ip_origem: true,
          criado_em: true,
          usuario: { select: { nome: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.audit_Log.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
