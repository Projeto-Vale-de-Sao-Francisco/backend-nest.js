import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { AuditService } from '../audit/audit.service.js';
import {
  authorizedPropertyIds,
  type PropertyActor,
} from '../common/property-access.js';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Cria um novo dispositivo e seu sensor associado.
   * Centraliza regras de negócio para evitar dados inconsistentes.
   */
  async create(
    dto: CreateDeviceDto,
    actor: PropertyActor,
    ipOrigem?: string,
  ) {
    this.validateDevicePayload(dto);

    const talhao = await this.prisma.talhao.findUnique({
      where: { id: dto.talhaoId },
      include: { propriedade: true },
    });

    if (!talhao) {
      throw new NotFoundException(
        `Talhão com id ${dto.talhaoId} não encontrado.`,
      );
    }

    const propertyIds = await authorizedPropertyIds(this.prisma, actor);
    if (propertyIds !== null && !propertyIds.includes(talhao.propriedade_id)) {
      throw new NotFoundException('Talhão não encontrado.');
    }

    if (dto.propriedadeId && talhao.propriedade_id !== dto.propriedadeId) {
      throw new BadRequestException(
        `O talhão informado (${dto.talhaoId}) pertence à propriedade ${talhao.propriedade_id}, diferente da informada (${dto.propriedadeId}).`,
      );
    }

    const deviceExists = await this.prisma.dispositivo.findUnique({
      where: { codigo: dto.codigo.trim() },
    });

    if (deviceExists) {
      throw new BadRequestException(
        `Já existe um dispositivo com o código "${dto.codigo}".`,
      );
    }

    const dataInstalacao = dto.dataInstalacao
      ? new Date(dto.dataInstalacao)
      : new Date();

    if (Number.isNaN(dataInstalacao.getTime())) {
      throw new BadRequestException('Data de instalação inválida.');
    }

    const status = dto.status ? this.normalizeStatus(dto.status) : 'ativo';
    const tipoSensor = dto.tipoSensor?.trim() || 'temperatura_umidade';
    const unidadeMedida = dto.unidadeMedida?.trim() || '°C, %';

    return this.prisma.$transaction(async (tx) => {
      const dispositivo = await tx.dispositivo.create({
        data: {
          codigo: dto.codigo.trim(),
          modelo: dto.modelo.trim(),
          status,
          data_instalacao: dataInstalacao,
          talhao_id: dto.talhaoId,
          sensores: {
            create: {
              tipo: tipoSensor,
              unidade_medida: unidadeMedida,
              status,
            },
          },
        },
        include: {
          talhao: {
            include: {
              propriedade: true,
            },
          },
          sensores: true,
        },
      });
      await this.audit.record(
        {
          usuarioId: actor.id,
          acao: 'CRIAR',
          recurso: 'DISPOSITIVO',
          recursoId: dispositivo.id,
          ipOrigem,
        },
        tx,
      );
      return dispositivo;
    });
  }

  /**
   * Lista dispositivos com filtros por propriedade, lote (talhão) e status.
   */
  async findAll(filters?: {
    propriedadeId?: number;
    talhaoId?: number;
    status?: string;
  }, actor?: PropertyActor) {
    const where: any = {};
    const propertyIds = actor
      ? await authorizedPropertyIds(this.prisma, actor)
      : [];

    if (filters?.status) {
      where.status = this.normalizeStatus(filters.status);
    }

    if (filters?.talhaoId) {
      where.talhao_id = filters.talhaoId;
    }

    const requestedIds = filters?.propriedadeId
      ? [filters.propriedadeId]
      : null;
    const scopedIds =
      propertyIds === null
        ? requestedIds
        : requestedIds
          ? propertyIds.filter((id) => requestedIds.includes(id))
          : propertyIds;
    if (scopedIds !== null) {
      where.talhao = {
        ...where.talhao,
        propriedade_id:
          scopedIds.length === 1 ? scopedIds[0] : { in: scopedIds },
      };
    }

    return this.prisma.dispositivo.findMany({
      where,
      include: {
        talhao: {
          include: {
            propriedade: true,
          },
        },
        sensores: true,
      },
      orderBy: {
        codigo: 'asc',
      },
    });
  }

  /**
   * Busca um dispositivo pelo id.
   */
  async findOne(id: number, actor?: PropertyActor) {
    const propertyIds = actor
      ? await authorizedPropertyIds(this.prisma, actor)
      : [];
    const device = await this.prisma.dispositivo.findFirst({
      where: {
        id,
        ...(propertyIds === null
          ? {}
          : { talhao: { propriedade_id: { in: propertyIds } } }),
      },
      include: {
        talhao: {
          include: {
            propriedade: true,
          },
        },
        sensores: true,
      },
    });

    if (!device) {
      throw new NotFoundException(`Dispositivo com id ${id} não encontrado.`);
    }

    return device;
  }

  /**
   * Atualiza o status do dispositivo e reflete nos seus sensores vinculados.
   */
  async updateStatus(
    id: number,
    status: 'ativo' | 'inativo',
    usuarioId: number | null = null,
    ipOrigem?: string,
  ) {
    const normalizedStatus = this.normalizeStatus(status);
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.dispositivo.findUnique({ where: { id } });
      if (!device) {
        throw new NotFoundException(`Dispositivo com id ${id} não encontrado.`);
      }

      await tx.sensor.updateMany({
        where: { dispositivo_id: id },
        data: { status: normalizedStatus },
      });
      const dispositivo = await tx.dispositivo.update({
        where: { id },
        data: { status: normalizedStatus },
        include: {
          talhao: { include: { propriedade: true } },
          sensores: true,
        },
      });
      await this.audit.record(
        {
          usuarioId,
          acao: 'ATUALIZAR_STATUS',
          recurso: 'DISPOSITIVO',
          recursoId: id,
          ipOrigem,
        },
        tx,
      );
      return dispositivo;
    });
  }

  async rotateCredential(
    id: number,
    usuarioId: number,
    ipOrigem?: string,
  ) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await this.prisma.$transaction(async (tx) => {
      const device = await tx.dispositivo.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!device) {
        throw new NotFoundException(`Dispositivo com id ${id} não encontrado.`);
      }

      await tx.dispositivo_Credencial.upsert({
        where: { dispositivo_id: id },
        create: {
          dispositivo_id: id,
          token_hash: tokenHash,
        },
        update: {
          token_hash: tokenHash,
          created_at: new Date(),
          revoked_at: null,
        },
      });
      await this.audit.record(
        {
          usuarioId,
          acao: 'ROTACIONAR_CREDENCIAL',
          recurso: 'DISPOSITIVO',
          recursoId: id,
          ipOrigem,
        },
        tx,
      );
    });

    return {
      dispositivoId: id,
      token,
      mensagem: 'Guarde este token. Ele não será exibido novamente.',
    };
  }

  async revokeCredential(id: number, usuarioId: number, ipOrigem?: string) {
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.dispositivo.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!device) {
        throw new NotFoundException(`Dispositivo com id ${id} não encontrado.`);
      }

      const result = await tx.dispositivo_Credencial.updateMany({
        where: { dispositivo_id: id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      if (result.count > 0) {
        await this.audit.record(
          {
            usuarioId,
            acao: 'REVOGAR_CREDENCIAL',
            recurso: 'DISPOSITIVO',
            recursoId: id,
            ipOrigem,
          },
          tx,
        );
      }

      return { dispositivoId: id, revogada: result.count > 0 };
    });
  }

  /**
   * Valida as informações básicas do payload.
   */
  private validateDevicePayload(dto: CreateDeviceDto) {
    if (!dto.codigo?.trim()) {
      throw new BadRequestException('Código do dispositivo é obrigatório.');
    }

    if (!dto.modelo?.trim()) {
      throw new BadRequestException('Modelo do dispositivo é obrigatório.');
    }

    if (!dto.talhaoId || Number.isNaN(Number(dto.talhaoId))) {
      throw new BadRequestException('Talhão inválido.');
    }
  }

  /**
   * Padroniza o status para manter o sistema consistente.
   */
  private normalizeStatus(status: string): 'ativo' | 'inativo' {
    if (typeof status !== 'string') {
      throw new BadRequestException(
        'Status obrigatório. Use ativo ou inativo.',
      );
    }
    const normalized = status.toLowerCase().trim();

    if (normalized === 'ativo' || normalized === 'inativo') {
      return normalized;
    }

    throw new BadRequestException('Status inválido. Use "ativo" ou "inativo".');
  }
}
