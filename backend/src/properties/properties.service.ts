import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthzService } from '../auth/authz.service.js';
import { PaginationInput } from '../auth/auth.types.js';
import { paginatedResult, parsePagination } from '../auth/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';

const linkedUserSelect = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  perfil: true,
  status: true,
} as const;

const relatedCompanySelect = {
  id: true,
  razao_social: true,
  nome_fantasia: true,
  tipo: true,
  telefone: true,
  email: true,
  cidade: true,
  estado: true,
  status: true,
} as const;

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  async create(actorId: number, dto: CreatePropertyDto) {
    await this.authz.assertCanManageProperties(actorId);
    const data = this.buildPropertyData(dto);
    await this.authz.assertCanReadCompany(actorId, data.empresa_id);
    await this.requireCompany(data.empresa_id);

    return this.prisma.propriedade.create({
      data,
      include: {
        empresa: { select: relatedCompanySelect },
      },
    });
  }

  async findAll(
    actorId: number,
    filters?: {
      search?: string;
      companyId?: number;
      municipality?: string;
      state?: string;
      status?: string;
    },
    pagination?: PaginationInput,
  ) {
    const page = parsePagination(pagination);
    const scope = await this.authz.propertyScope(actorId);
    const where: Record<string, unknown> = { AND: [scope] };

    if (filters?.search?.trim()) {
      const term = filters.search.trim();
      (where.AND as unknown[]).push({
        OR: [
          { nome: { contains: term, mode: 'insensitive' } },
          {
            empresa: { razao_social: { contains: term, mode: 'insensitive' } },
          },
          {
            empresa: { nome_fantasia: { contains: term, mode: 'insensitive' } },
          },
        ],
      });
    }
    if (filters?.companyId !== undefined) {
      if (!Number.isSafeInteger(filters.companyId) || filters.companyId <= 0) {
        throw new BadRequestException(
          'Identificador de produtor/empresa inválido.',
        );
      }
      (where.AND as unknown[]).push({ empresa_id: filters.companyId });
    }
    if (filters?.municipality) {
      (where.AND as unknown[]).push({
        municipio: {
          contains: filters.municipality.trim(),
          mode: 'insensitive',
        },
      });
    }
    if (filters?.state) {
      (where.AND as unknown[]).push({
        estado: { equals: this.normalizeState(filters.state) },
      });
    }
    if (filters?.status) {
      (where.AND as unknown[]).push({
        status: this.normalizeStatus(filters.status),
      });
    }

    const [data, total] = await Promise.all([
      this.prisma.propriedade.findMany({
        where,
        include: { empresa: { select: relatedCompanySelect } },
        orderBy: { nome: 'asc' },
        skip: page.skip,
        take: page.limit,
      }),
      this.prisma.propriedade.count({ where }),
    ]);
    return paginatedResult(data, page.page, page.limit, total);
  }

  async findOne(actorId: number, id: number) {
    await this.authz.assertCanReadProperty(actorId, id);
    const property = await this.prisma.propriedade.findUnique({
      where: { id },
      include: {
        empresa: { select: relatedCompanySelect },
        usuarios: {
          where: { status: 'ativo' },
          select: {
            id: true,
            usuario_id: true,
            propriedade_id: true,
            papel_vinculo: true,
            data_vinculo: true,
            status: true,
            usuario: { select: linkedUserSelect },
          },
        },
        talhoes: true,
      },
    });
    if (!property) {
      throw new NotFoundException(`Propriedade com id ${id} não encontrada.`);
    }
    return property;
  }

  async update(actorId: number, id: number, dto: UpdatePropertyDto) {
    await this.authz.assertCanManageProperties(actorId);
    const property = await this.prisma.propriedade.findUnique({
      where: { id },
      select: {
        id: true,
        empresa_id: true,
        nome: true,
        municipio: true,
        estado: true,
        latitude: true,
        longitude: true,
        area_total: true,
        status: true,
      },
    });
    if (!property) {
      throw new NotFoundException(`Propriedade com id ${id} não encontrada.`);
    }
    const data = this.buildPropertyData(dto, { existing: property });
    const companyId = Number(
      dto.empresaId ??
        dto.companyId ??
        dto.producerId ??
        dto.empresa_id ??
        dto.producer_id ??
        property.empresa_id,
    );
    await this.authz.assertCanReadCompany(actorId, companyId);
    await this.requireCompany(companyId);

    return this.prisma.propriedade.update({
      where: { id },
      data,
      include: { empresa: { select: relatedCompanySelect } },
    });
  }

  async updateStatus(actorId: number, id: number, status?: string) {
    await this.authz.assertCanManageProperties(actorId);
    const property = await this.prisma.propriedade.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!property) {
      throw new NotFoundException(`Propriedade com id ${id} não encontrada.`);
    }
    return this.prisma.propriedade.update({
      where: { id },
      data: { status: this.normalizeStatus(status ?? property.status) },
      include: { empresa: { select: relatedCompanySelect } },
    });
  }

  async listUsers(actorId: number, propertyId: number) {
    await this.authz.assertCanManagePropertyAssociations(actorId);
    await this.authz.assertCanReadProperty(actorId, propertyId);
    await this.requireProperty(propertyId);
    return this.prisma.usuario_Propriedade.findMany({
      where: { propriedade_id: propertyId, status: 'ativo' },
      select: {
        id: true,
        usuario_id: true,
        propriedade_id: true,
        papel_vinculo: true,
        data_vinculo: true,
        status: true,
        usuario: { select: linkedUserSelect },
      },
      orderBy: { usuario_id: 'asc' },
    });
  }

  async listAvailableUsers(actorId: number, propertyId: number) {
    await this.authz.assertCanManagePropertyAssociations(actorId);
    await this.authz.assertCanReadProperty(actorId, propertyId);
    await this.requireProperty(propertyId);
    return this.prisma.usuario.findMany({
      where: {
        status: 'ativo',
        propriedades: {
          none: { propriedade_id: propertyId, status: 'ativo' },
        },
      },
      select: linkedUserSelect,
      orderBy: { nome: 'asc' },
    });
  }

  async linkUser(
    actorId: number,
    propertyId: number,
    dto: Record<string, unknown>,
  ) {
    await this.authz.assertCanManagePropertyAssociations(actorId);
    await this.authz.assertCanReadProperty(actorId, propertyId);
    const property = await this.requireProperty(propertyId);
    const userId = this.readUserId(dto);
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user || user.status.toLowerCase() !== 'ativo') {
      throw new NotFoundException('Usuário ativo não encontrado.');
    }

    const result = await this.prisma.usuario_Propriedade.upsert({
      where: {
        usuario_id_propriedade_id: {
          usuario_id: userId,
          propriedade_id: propertyId,
        },
      },
      create: {
        usuario_id: userId,
        propriedade_id: propertyId,
        papel_vinculo: this.readRole(dto),
        data_vinculo: new Date(),
        status: 'ativo',
      },
      update: {
        papel_vinculo: this.readRole(dto),
        data_vinculo: new Date(),
        status: 'ativo',
      },
      select: {
        id: true,
        usuario_id: true,
        propriedade_id: true,
        papel_vinculo: true,
        data_vinculo: true,
        status: true,
        usuario: { select: linkedUserSelect },
      },
    });
    return { ...result, propriedade: property };
  }

  async unlinkUser(actorId: number, propertyId: number, userId: number) {
    await this.authz.assertCanManagePropertyAssociations(actorId);
    await this.authz.assertCanReadProperty(actorId, propertyId);
    await this.requireProperty(propertyId);
    const association = await this.prisma.usuario_Propriedade.findUnique({
      where: {
        usuario_id_propriedade_id: {
          usuario_id: userId,
          propriedade_id: propertyId,
        },
      },
      select: { id: true, status: true },
    });
    if (!association || association.status !== 'ativo') {
      throw new NotFoundException('Vínculo ativo não encontrado.');
    }
    return this.prisma.usuario_Propriedade.update({
      where: {
        usuario_id_propriedade_id: {
          usuario_id: userId,
          propriedade_id: propertyId,
        },
      },
      data: { status: 'inativo' },
      select: {
        id: true,
        usuario_id: true,
        propriedade_id: true,
        papel_vinculo: true,
        data_vinculo: true,
        status: true,
        usuario: { select: linkedUserSelect },
      },
    });
  }

  async findAccessibleByUser(
    actorId: number,
    targetUserId: number,
    pagination?: PaginationInput,
  ) {
    await this.authz.assertCanReadUserProperties(actorId, targetUserId);
    const page = parsePagination(pagination);
    const where = {
      usuarios: { some: { usuario_id: targetUserId, status: 'ativo' } },
    };
    const [data, total] = await Promise.all([
      this.prisma.propriedade.findMany({
        where,
        include: { empresa: { select: relatedCompanySelect } },
        orderBy: { nome: 'asc' },
        skip: page.skip,
        take: page.limit,
      }),
      this.prisma.propriedade.count({ where }),
    ]);
    return paginatedResult(data, page.page, page.limit, total);
  }

  private async requireCompany(id: number) {
    const company = await this.prisma.empresa.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException(
        `Empresa/produtor com id ${id} não encontrado.`,
      );
    }
  }

  private async requireProperty(id: number) {
    const property = await this.prisma.propriedade.findUnique({
      where: { id },
      include: { empresa: { select: relatedCompanySelect } },
    });
    if (!property) {
      throw new NotFoundException(`Propriedade com id ${id} não encontrada.`);
    }
    return property;
  }

  private readUserId(dto: Record<string, unknown>) {
    const userId = Number(dto.userId ?? dto.usuarioId ?? dto.usuario_id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new BadRequestException('Identificador do usuário é inválido.');
    }
    return userId;
  }

  private readRole(dto: Record<string, unknown>) {
    const role = dto.papelVinculo ?? dto.role ?? dto.papel ?? 'responsavel';
    if (typeof role !== 'string' || !role.trim()) {
      throw new BadRequestException('Papel do vínculo é inválido.');
    }
    return role.trim();
  }

  private buildPropertyData(
    dto: CreatePropertyDto,
  ): Prisma.PropriedadeUncheckedCreateInput;
  private buildPropertyData(
    dto: UpdatePropertyDto,
    options: {
      existing: {
        empresa_id: number;
        nome: string;
        municipio: string;
        estado: string;
        latitude: number | null;
        longitude: number | null;
        area_total: number;
        status: string;
      };
    },
  ): Prisma.PropriedadeUncheckedUpdateInput;
  private buildPropertyData(
    dto: CreatePropertyDto | UpdatePropertyDto,
    options?: {
      existing?: {
        empresa_id: number;
        nome: string;
        municipio: string;
        estado: string;
        latitude: number | null;
        longitude: number | null;
        area_total: number;
        status: string;
      };
    },
  ):
    | Prisma.PropriedadeUncheckedCreateInput
    | Prisma.PropriedadeUncheckedUpdateInput {
    const empresaId = Number(
      dto.empresaId ??
        dto.companyId ??
        dto.producerId ??
        dto.empresa_id ??
        dto.producer_id ??
        options?.existing?.empresa_id ??
        0,
    );
    const rawName = dto.name ?? options?.existing?.nome;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const rawMunicipality =
      dto.municipality ?? dto.municipio ?? options?.existing?.municipio;
    if (
      rawMunicipality !== undefined &&
      (typeof rawMunicipality !== 'string' || !rawMunicipality.trim())
    ) {
      throw new BadRequestException('Município deve ser um texto não vazio.');
    }
    const municipality =
      typeof rawMunicipality === 'string' ? rawMunicipality.trim() : '';
    const rawState =
      dto.state ?? dto.uf ?? dto.estado ?? options?.existing?.estado;
    const state =
      rawState === undefined && options?.existing
        ? undefined
        : this.normalizeState(rawState);
    const latitude = this.normalizeCoordinate(
      dto.latitude,
      -90,
      90,
      'Latitude',
      options?.existing,
    );
    const longitude = this.normalizeCoordinate(
      dto.longitude,
      -180,
      180,
      'Longitude',
      options?.existing,
    );
    const totalArea = this.normalizeArea(
      dto.totalArea ?? dto.areaTotal ?? dto.area_total,
      options?.existing,
    );

    if (!Number.isSafeInteger(empresaId) || empresaId <= 0) {
      throw new BadRequestException(
        'Produtor/empresa responsável é obrigatório.',
      );
    }
    if (!name)
      throw new BadRequestException('Nome da propriedade é obrigatório.');
    if (!municipality && !options?.existing) {
      throw new BadRequestException('Município é obrigatório.');
    }
    if (!state && !options?.existing) {
      throw new BadRequestException('Estado é obrigatório.');
    }

    const statusValue = dto.status ?? options?.existing?.status ?? 'ativo';
    if (!options?.existing) {
      if (!totalArea) {
        throw new BadRequestException('Área total é obrigatória.');
      }
      return {
        empresa_id: empresaId,
        nome: name,
        municipio: municipality,
        estado: state!,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        area_total: totalArea,
        status: this.normalizeStatus(statusValue),
      };
    }

    return {
      empresa_id: empresaId,
      ...(dto.name !== undefined ? { nome: name } : {}),
      ...((dto.municipality ?? dto.municipio) !== undefined
        ? { municipio: municipality }
        : {}),
      ...((dto.state ?? dto.uf ?? dto.estado) !== undefined
        ? { estado: state }
        : {}),
      ...(dto.latitude !== undefined ? { latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude } : {}),
      ...((dto.totalArea ?? dto.areaTotal ?? dto.area_total) !== undefined
        ? { area_total: totalArea }
        : {}),
      status: this.normalizeStatus(statusValue),
    };
  }

  private normalizeCoordinate(
    value: unknown,
    min: number,
    max: number,
    label: string,
    existing?: { [key: string]: unknown },
  ) {
    if (value === undefined && existing) {
      return undefined;
    }
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (typeof value !== 'number' && typeof value !== 'string') {
      throw new BadRequestException(`${label} inválida.`);
    }
    const coordinate = Number(value);
    if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
      throw new BadRequestException(
        `${label} deve estar entre ${min} e ${max}.`,
      );
    }
    return coordinate;
  }

  private normalizeArea(value: unknown, existing?: object) {
    if (value === undefined && existing) return undefined;
    if (value === undefined || value === null || value === '') {
      throw new BadRequestException('Área total é obrigatória.');
    }
    if (typeof value !== 'number' && typeof value !== 'string') {
      throw new BadRequestException(
        'A área total deve ser um número positivo.',
      );
    }
    const area = Number(value);
    if (!Number.isFinite(area) || area <= 0) {
      throw new BadRequestException(
        'A área total deve ser um número positivo.',
      );
    }
    return area;
  }

  private normalizeState(value: unknown) {
    const state = typeof value === 'string' ? value.trim().toUpperCase() : '';
    const states = new Set([
      'AC',
      'AL',
      'AP',
      'AM',
      'BA',
      'CE',
      'DF',
      'ES',
      'GO',
      'MA',
      'MT',
      'MS',
      'MG',
      'PA',
      'PB',
      'PR',
      'PE',
      'PI',
      'RJ',
      'RN',
      'RS',
      'RO',
      'RR',
      'SC',
      'SP',
      'SE',
      'TO',
    ]);
    if (!states.has(state)) {
      throw new BadRequestException(
        'Estado deve ser uma UF brasileira válida.',
      );
    }
    return state;
  }

  private normalizeStatus(value: unknown) {
    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Status inválido. Use "ativo" ou "inativo".',
      );
    }
    const status = value.toLowerCase().trim();
    if (['ativo', 'ativa', 'active', 'enabled'].includes(status))
      return 'ativo';
    if (['inativo', 'inativa', 'inactive', 'disabled'].includes(status))
      return 'inativo';
    throw new BadRequestException('Status inválido. Use "ativo" ou "inativo".');
  }
}
