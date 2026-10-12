import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthzService } from '../auth/authz.service.js';
import { paginatedResult, parsePagination } from '../auth/pagination.js';
import { PaginationInput } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

const linkedUserSelect = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  perfil: true,
  status: true,
} as const;

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  async create(actorId: number, dto: CreateCompanyDto) {
    await this.authz.assertCanManageCompanies(actorId);
    const data = this.buildCompanyData(dto, { requireType: true });

    const existing = await this.prisma.empresa.findFirst({
      where: { cpf_cnpj: data.cpf_cnpj },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        'Já existe uma empresa/produtor cadastrado com esse documento.',
      );
    }

    const company = await this.prisma.empresa.create({ data });
    return this.presentCompany(
      company,
      await this.authz.canReadCompanyDocument(actorId),
    );
  }

  async findAll(
    actorId: number,
    filters?: {
      search?: string;
      type?: string;
      city?: string;
      state?: string;
      status?: string;
    },
    pagination?: PaginationInput,
  ) {
    const page = parsePagination(pagination);
    const scope = await this.authz.companyScope(actorId);
    const where: Record<string, unknown> = { AND: [scope] };

    if (filters?.search?.trim()) {
      const term = filters.search.trim();
      const documentTerm = term.replace(/\D/g, '');
      (where.AND as unknown[]).push({
        OR: [
          { razao_social: { contains: term, mode: 'insensitive' } },
          { nome_fantasia: { contains: term, mode: 'insensitive' } },
          {
            cpf_cnpj: {
              contains: documentTerm || term,
              mode: 'insensitive',
            },
          },
        ],
      });
    }
    if (filters?.type) {
      (where.AND as unknown[]).push({ tipo: this.normalizeType(filters.type) });
    }
    if (filters?.city) {
      (where.AND as unknown[]).push({
        cidade: { contains: filters.city.trim(), mode: 'insensitive' },
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

    const [companies, total, showDocuments] = await Promise.all([
      this.prisma.empresa.findMany({
        where,
        orderBy: { razao_social: 'asc' },
        skip: page.skip,
        take: page.limit,
      }),
      this.prisma.empresa.count({ where }),
      this.authz.canReadCompanyDocument(actorId),
    ]);
    const data = companies.map((company) =>
      this.presentCompany(company, showDocuments),
    );
    return paginatedResult(data, page.page, page.limit, total);
  }

  async findOne(actorId: number, id: number) {
    await this.authz.assertCanReadCompany(actorId, id);
    const company = await this.prisma.empresa.findUnique({
      where: { id },
      include: {
        propriedades: {
          select: {
            id: true,
            nome: true,
            municipio: true,
            estado: true,
            area_total: true,
            status: true,
          },
        },
      },
    });
    if (!company) {
      throw new NotFoundException(
        `Empresa/produtor com id ${id} não encontrado.`,
      );
    }

    return this.presentCompany(
      company,
      await this.authz.canReadCompanyDocument(actorId),
    );
  }

  async update(actorId: number, id: number, dto: UpdateCompanyDto) {
    await this.authz.assertCanManageCompanies(actorId);
    const company = await this.prisma.empresa.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(
        `Empresa/produtor com id ${id} não encontrado.`,
      );
    }

    const mergedDto = {
      name: dto.name ?? dto.razaoSocial ?? company.razao_social,
      razaoSocial: dto.razaoSocial ?? dto.name ?? company.razao_social,
      document: dto.document ?? dto.cpfCnpj ?? company.cpf_cnpj,
      cpfCnpj: dto.cpfCnpj ?? dto.document ?? company.cpf_cnpj,
      phone: dto.phone ?? company.telefone ?? '',
      email: dto.email ?? company.email ?? '',
      city: dto.city ?? dto.municipality ?? company.cidade ?? '',
      state: dto.state ?? dto.uf ?? company.estado ?? '',
      responsibleName:
        dto.responsibleName ??
        dto.responsible_name ??
        company.responsavel ??
        '',
      responsible_name:
        dto.responsible_name ??
        dto.responsibleName ??
        company.responsavel ??
        '',
      status: dto.status ?? company.status,
      type: dto.type ?? company.tipo,
    };
    const payload = this.buildCompanyData(mergedDto);
    const duplicate = await this.prisma.empresa.findFirst({
      where: { cpf_cnpj: payload.cpf_cnpj, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        'Já existe uma empresa/produtor cadastrado com esse documento.',
      );
    }

    const updated = await this.prisma.empresa.update({
      where: { id },
      data: payload,
    });
    return this.presentCompany(
      updated,
      await this.authz.canReadCompanyDocument(actorId),
    );
  }

  async updateStatus(actorId: number, id: number, status?: string) {
    await this.authz.assertCanManageCompanies(actorId);
    const company = await this.prisma.empresa.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(
        `Empresa/produtor com id ${id} não encontrado.`,
      );
    }
    const updated = await this.prisma.empresa.update({
      where: { id },
      data: { status: this.normalizeStatus(status ?? company.status) },
    });
    return this.presentCompany(
      updated,
      await this.authz.canReadCompanyDocument(actorId),
    );
  }

  async listUsers(actorId: number, companyId: number) {
    await this.authz.assertCanManageCompanyAssociations(actorId);
    await this.authz.assertCanReadCompany(actorId, companyId);
    await this.requireCompany(companyId);
    return this.prisma.usuario_Empresa.findMany({
      where: { empresa_id: companyId, status: 'ativo' },
      select: {
        id: true,
        usuario_id: true,
        empresa_id: true,
        papel_empresa: true,
        data_vinculo: true,
        status: true,
        usuario: { select: linkedUserSelect },
      },
      orderBy: { usuario_id: 'asc' },
    });
  }

  async listAvailableUsers(actorId: number, companyId: number) {
    await this.authz.assertCanManageCompanyAssociations(actorId);
    await this.authz.assertCanReadCompany(actorId, companyId);
    await this.requireCompany(companyId);
    return this.prisma.usuario.findMany({
      where: {
        status: 'ativo',
        empresas: {
          none: { empresa_id: companyId, status: 'ativo' },
        },
      },
      select: linkedUserSelect,
      orderBy: { nome: 'asc' },
    });
  }

  async linkUser(
    actorId: number,
    companyId: number,
    dto: Record<string, unknown>,
  ) {
    await this.authz.assertCanManageCompanyAssociations(actorId);
    await this.authz.assertCanReadCompany(actorId, companyId);
    const company = await this.requireCompany(companyId);
    const userId = this.readUserId(dto);
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user || user.status.toLowerCase() !== 'ativo') {
      throw new NotFoundException('Usuário ativo não encontrado.');
    }

    const papel = this.readRole(dto);
    const result = await this.prisma.usuario_Empresa.upsert({
      where: {
        usuario_id_empresa_id: { usuario_id: userId, empresa_id: companyId },
      },
      create: {
        usuario_id: userId,
        empresa_id: companyId,
        papel_empresa: papel,
        data_vinculo: new Date(),
        status: 'ativo',
      },
      update: {
        papel_empresa: papel,
        data_vinculo: new Date(),
        status: 'ativo',
      },
      select: {
        id: true,
        usuario_id: true,
        empresa_id: true,
        papel_empresa: true,
        data_vinculo: true,
        status: true,
        usuario: { select: linkedUserSelect },
      },
    });
    return { ...result, empresa: this.presentCompany(company, false) };
  }

  async unlinkUser(actorId: number, companyId: number, userId: number) {
    await this.authz.assertCanManageCompanyAssociations(actorId);
    await this.authz.assertCanReadCompany(actorId, companyId);
    await this.requireCompany(companyId);
    const association = await this.prisma.usuario_Empresa.findUnique({
      where: {
        usuario_id_empresa_id: { usuario_id: userId, empresa_id: companyId },
      },
      select: { id: true, status: true },
    });
    if (!association || association.status !== 'ativo') {
      throw new NotFoundException('Vínculo ativo não encontrado.');
    }
    return this.prisma.usuario_Empresa.update({
      where: {
        usuario_id_empresa_id: { usuario_id: userId, empresa_id: companyId },
      },
      data: { status: 'inativo' },
      select: {
        id: true,
        usuario_id: true,
        empresa_id: true,
        papel_empresa: true,
        data_vinculo: true,
        status: true,
        usuario: { select: linkedUserSelect },
      },
    });
  }

  private async requireCompany(id: number) {
    const company = await this.prisma.empresa.findUnique({
      where: { id },
      select: {
        id: true,
        razao_social: true,
        nome_fantasia: true,
        cpf_cnpj: true,
        telefone: true,
        email: true,
        cidade: true,
        estado: true,
        responsavel: true,
        tipo: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!company) {
      throw new NotFoundException(
        `Empresa/produtor com id ${id} não encontrado.`,
      );
    }
    return company;
  }

  private readUserId(dto: Record<string, unknown>) {
    const userId = Number(dto.userId ?? dto.usuarioId ?? dto.usuario_id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new BadRequestException('Identificador do usuário é inválido.');
    }
    return userId;
  }

  private readRole(dto: Record<string, unknown>) {
    const role = dto.papelEmpresa ?? dto.role ?? dto.papel ?? 'responsavel';
    if (typeof role !== 'string' || !role.trim()) {
      throw new BadRequestException('Papel do vínculo é inválido.');
    }
    return role.trim();
  }

  private presentCompany<T extends { cpf_cnpj: string }>(
    company: T,
    showDocument: boolean,
  ) {
    return {
      ...company,
      cpf_cnpj: showDocument
        ? company.cpf_cnpj
        : this.maskDocument(company.cpf_cnpj),
    };
  }

  private maskDocument(document: string) {
    const digits = document.replace(/\D/g, '');
    if (digits.length === 11) {
      return `***.***.***-${digits.slice(-2)}`;
    }
    if (digits.length === 14) {
      return `**.***.***/****-${digits.slice(-2)}`;
    }
    return '***';
  }

  private buildCompanyData(
    dto: CreateCompanyDto | UpdateCompanyDto | Record<string, unknown>,
    options?: { requireType?: boolean },
  ) {
    const rawName = dto.name ?? dto.razaoSocial;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const rawDocument = dto.document ?? dto.cpfCnpj;
    if (rawDocument !== undefined && typeof rawDocument !== 'string') {
      throw new BadRequestException(
        'CPF ou CNPJ deve ser informado como texto.',
      );
    }
    const document = this.normalizeDocument(rawDocument?.trim() ?? '');
    if (
      options?.requireType &&
      (typeof dto.type !== 'string' || !dto.type.trim())
    ) {
      throw new BadRequestException('Tipo de cadastro é obrigatório.');
    }
    const rawType =
      dto.type ??
      (document.length === 14 ? 'PJ' : document.length === 11 ? 'PF' : '');
    const type = this.normalizeType(rawType);
    if (
      (type === 'PF' && document.length !== 11) ||
      (type === 'PJ' && document.length !== 14)
    ) {
      throw new BadRequestException(
        'O tipo de cadastro deve corresponder ao CPF ou CNPJ informado.',
      );
    }
    const email = this.normalizeEmail(dto.email ?? '');
    const phone = this.normalizePhone(dto.phone ?? '');
    const rawCity = dto.city ?? dto.municipality;
    const city = typeof rawCity === 'string' ? rawCity.trim() : '';
    const state = this.normalizeState(dto.state ?? dto.uf ?? '');
    const responsibleValue = dto.responsibleName ?? dto.responsible_name;
    const responsible =
      typeof responsibleValue === 'string' ? responsibleValue.trim() : '';

    if (!name)
      throw new BadRequestException('Nome ou razão social é obrigatório.');
    if (!document) throw new BadRequestException('CPF ou CNPJ é obrigatório.');
    if (!city) throw new BadRequestException('Cidade é obrigatória.');
    if (!responsible)
      throw new BadRequestException('Nome do responsável é obrigatório.');

    return {
      razao_social: name,
      nome_fantasia: name,
      cpf_cnpj: document,
      telefone: phone,
      email,
      cidade: city,
      estado: state,
      responsavel: responsible,
      tipo: type,
      status: this.normalizeStatus(dto.status ?? 'ativo'),
    };
  }

  private normalizeDocument(value: string) {
    const digits = value.replace(/\D/g, '');
    if (
      (digits.length === 11 && this.isValidCpf(digits)) ||
      (digits.length === 14 && this.isValidCnpj(digits))
    ) {
      return digits;
    }
    throw new BadRequestException('CPF ou CNPJ inválido.');
  }

  private normalizeType(value: unknown): 'PF' | 'PJ' {
    if (typeof value !== 'string') {
      throw new BadRequestException('Tipo de cadastro inválido.');
    }
    const normalized = value.trim().toLowerCase();
    if (
      ['pf', 'fisica', 'pessoa_fisica', 'pessoa fisica', 'physical'].includes(
        normalized,
      )
    ) {
      return 'PF';
    }
    if (
      [
        'pj',
        'juridica',
        'pessoa_juridica',
        'pessoa juridica',
        'company',
      ].includes(normalized)
    ) {
      return 'PJ';
    }
    throw new BadRequestException(
      'Tipo de cadastro inválido. Use pessoa física (PF) ou jurídica (PJ).',
    );
  }

  private normalizeEmail(value: unknown) {
    const email = typeof value === 'string' ? value.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('E-mail inválido.');
    }
    return email;
  }

  private normalizePhone(value: unknown) {
    if (typeof value !== 'string' || value.replace(/\D/g, '').length < 10) {
      throw new BadRequestException('Telefone inválido.');
    }
    return value.trim();
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

  private isValidCpf(document: string) {
    if (/^(\d)\1{10}$/.test(document)) return false;
    const digit = (length: number) => {
      const sum = document
        .slice(0, length)
        .split('')
        .reduce(
          (total, value, index) => total + Number(value) * (length + 1 - index),
          0,
        );
      const remainder = (sum * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };
    return (
      digit(9) === Number(document[9]) && digit(10) === Number(document[10])
    );
  }

  private isValidCnpj(document: string) {
    if (/^(\d)\1{13}$/.test(document)) return false;
    const calculateDigit = (base: string, weights: number[]) => {
      const sum = base
        .split('')
        .reduce(
          (total, value, index) => total + Number(value) * weights[index],
          0,
        );
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    const first = calculateDigit(
      document.slice(0, 12),
      [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    const second = calculateDigit(
      document.slice(0, 12) + first,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );
    return first === Number(document[12]) && second === Number(document[13]);
  }
}
