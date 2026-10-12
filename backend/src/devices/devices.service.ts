import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria um novo dispositivo e seu sensor associado.
   * Centraliza regras de negócio para evitar dados inconsistentes.
   */
  async create(dto: CreateDeviceDto) {
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

    return this.prisma.dispositivo.create({
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
  }

  /**
   * Lista dispositivos com filtros por propriedade, lote (talhão) e status.
   */
  async findAll(filters?: {
    propriedadeId?: number;
    talhaoId?: number;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = this.normalizeStatus(filters.status);
    }

    if (filters?.talhaoId) {
      where.talhao_id = filters.talhaoId;
    }

    if (filters?.propriedadeId) {
      where.talhao = {
        propriedade_id: filters.propriedadeId,
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
  async findOne(id: number) {
    const device = await this.prisma.dispositivo.findUnique({
      where: { id },
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
  async updateStatus(id: number, status: 'ativo' | 'inativo') {
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
      return tx.dispositivo.update({
        where: { id },
        data: { status: normalizedStatus },
        include: {
          talhao: { include: { propriedade: true } },
          sensores: true,
        },
      });
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
