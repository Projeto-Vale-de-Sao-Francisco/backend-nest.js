import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePropertyDto) {
    const data = this.buildPropertyData(dto);

    const empresaId = data.empresa_id;
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa/produtor com id ${empresaId} não encontrado.`);
    }

    return this.prisma.propriedade.create({
      data,
      include: {
        empresa: true,
        usuarios: {
          include: { usuario: true },
        },
      },
    });
  }

  async findAll(filters?: {
    search?: string;
    companyId?: number;
    municipality?: string;
    state?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.search) {
      const term = filters.search.trim();
      where.OR = [
        { nome: { contains: term, mode: 'insensitive' } },
        { empresa: { razao_social: { contains: term, mode: 'insensitive' } } },
      ];
    }

    if (filters?.companyId) {
      where.empresa_id = filters.companyId;
    }

    if (filters?.municipality) {
      where.municipio = { contains: filters.municipality.trim(), mode: 'insensitive' };
    }

    if (filters?.state) {
      where.estado = { equals: this.normalizeState(filters.state) };
    }

    if (filters?.status) {
      where.status = this.normalizeStatus(filters.status);
    }

    return this.prisma.propriedade.findMany({
      where,
      include: {
        empresa: true,
      },
      orderBy: {
        nome: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const propriedade = await this.prisma.propriedade.findUnique({
      where: { id },
      include: {
        empresa: true,
        usuarios: {
          include: { usuario: true },
        },
        talhoes: true,
      },
    });

    if (!propriedade) {
      throw new NotFoundException(`Propriedade com id ${id} não encontrada.`);
    }

    return propriedade;
  }

  async update(id: number, dto: UpdatePropertyDto) {
    const propriedade = await this.prisma.propriedade.findUnique({
      where: { id },
    });

    if (!propriedade) {
      throw new NotFoundException(`Propriedade com id ${id} não encontrada.`);
    }

    const data = this.buildPropertyData(dto, { existing: propriedade });

    if (data.empresa_id) {
      const empresa = await this.prisma.empresa.findUnique({
        where: { id: data.empresa_id },
      });

      if (!empresa) {
        throw new NotFoundException(
          `Empresa/produtor com id ${data.empresa_id} não encontrado.`,
        );
      }
    }

    return this.prisma.propriedade.update({
      where: { id },
      data,
      include: {
        empresa: true,
        usuarios: { include: { usuario: true } },
      },
    });
  }

  async updateStatus(id: number, status?: string) {
    const propriedade = await this.prisma.propriedade.findUnique({
      where: { id },
    });

    if (!propriedade) {
      throw new NotFoundException(`Propriedade com id ${id} não encontrada.`);
    }

    return this.prisma.propriedade.update({
      where: { id },
      data: {
        status: this.normalizeStatus(status ?? propriedade.status),
      },
      include: { empresa: true },
    });
  }

  async linkUser(propertyId: number, dto: Record<string, any>) {
    const propriedade = await this.prisma.propriedade.findUnique({
      where: { id: propertyId },
    });

    if (!propriedade) {
      throw new NotFoundException(`Propriedade com id ${propertyId} não encontrada.`);
    }

    const userId = Number(dto.userId ?? dto.usuarioId ?? dto.usuario_id);
    if (!userId) {
      throw new BadRequestException('Identificador do usuário é obrigatório.');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuário com id ${userId} não encontrado.`);
    }

    const papel = String(dto.papelVinculo ?? dto.role ?? dto.papel ?? 'responsavel').trim() || 'responsavel';
    const status = this.normalizeStatus(dto.status ?? 'ativo');
    const dataVinculo = new Date();

    return this.prisma.usuario_Propriedade.upsert({
      where: {
        usuario_id_propriedade_id: {
          usuario_id: userId,
          propriedade_id: propertyId,
        },
      },
      create: {
        usuario_id: userId,
        propriedade_id: propertyId,
        papel_vinculo: papel,
        data_vinculo: dataVinculo,
        status,
      },
      update: {
        papel_vinculo: papel,
        status,
        data_vinculo: dataVinculo,
      },
      include: {
        usuario: true,
        propriedade: true,
      },
    });
  }

  async listUsers(propertyId: number) {
    const propriedade = await this.prisma.propriedade.findUnique({
      where: { id: propertyId },
    });

    if (!propriedade) {
      throw new NotFoundException(`Propriedade com id ${propertyId} não encontrada.`);
    }

    return this.prisma.usuario_Propriedade.findMany({
      where: { propriedade_id: propertyId },
      include: { usuario: true },
      orderBy: { usuario_id: 'asc' },
    });
  }

  private buildPropertyData(
    dto: CreatePropertyDto | UpdatePropertyDto,
    options?: { existing?: any },
  ) {
    const empresaId = Number(
      dto.empresaId ?? dto.companyId ?? dto.producerId ?? dto.empresa_id ?? dto.producer_id ?? 0,
    );
    const name = String(dto.name ?? options?.existing?.nome ?? '').trim();
    const municipality = String(
      dto.municipality ?? dto.municipio ?? options?.existing?.municipio ?? '',
    ).trim();
    const state = this.normalizeState(
      String(dto.state ?? dto.uf ?? dto.estado ?? options?.existing?.estado ?? '').trim(),
    );
    const latitude = this.normalizeLatitude(dto.latitude ?? options?.existing?.latitude);
    const longitude = this.normalizeLongitude(dto.longitude ?? options?.existing?.longitude);
    const totalArea = this.normalizeArea(
      dto.totalArea ?? dto.areaTotal ?? dto.area_total ?? options?.existing?.area_total,
    );

    if (!name) {
      throw new BadRequestException('Nome da propriedade é obrigatório.');
    }

    if (!empresaId) {
      throw new BadRequestException('Produtor/empresa responsável é obrigatório.');
    }

    if (!municipality) {
      throw new BadRequestException('Município é obrigatório.');
    }

    if (!state) {
      throw new BadRequestException('Estado é obrigatório.');
    }

    return {
      empresa_id: empresaId,
      nome: name,
      municipio: municipality,
      estado: state,
      latitude,
      longitude,
      area_total: totalArea,
      status: this.normalizeStatus(dto.status ?? options?.existing?.status ?? 'ativo'),
    };
  }

  private normalizeLatitude(value: any) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const latitude = Number(value);
    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new BadRequestException('Latitude deve estar entre -90 e 90.');
    }
    return latitude;
  }

  private normalizeLongitude(value: any) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const longitude = Number(value);
    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new BadRequestException('Longitude deve estar entre -180 e 180.');
    }
    return longitude;
  }

  private normalizeArea(value: any) {
    if (value === undefined || value === null || value === '') {
      throw new BadRequestException('Área total é obrigatória.');
    }

    const area = Number(value);
    if (Number.isNaN(area) || area <= 0) {
      throw new BadRequestException('A área total deve ser um número positivo.');
    }
    return area;
  }

  private normalizeState(value: string) {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized)) {
      throw new BadRequestException('Estado deve conter 2 letras.');
    }
    return normalized;
  }

  private normalizeStatus(status?: string) {
    const normalized = (status ?? 'ativo').toString().trim().toLowerCase();

    if (['ativo', 'ativa', 'active', 'enabled'].includes(normalized)) {
      return 'ativo';
    }

    if (['inativo', 'inativa', 'inactive', 'disabled'].includes(normalized)) {
      return 'inativo';
    }

    throw new BadRequestException('Status inválido. Use "ativo" ou "inativo".');
  }
}
