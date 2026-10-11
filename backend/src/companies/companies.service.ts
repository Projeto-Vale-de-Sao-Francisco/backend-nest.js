import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    const data = this.buildCompanyData(dto);

    const existing = await this.prisma.empresa.findFirst({
      where: { cpf_cnpj: data.cpf_cnpj },
    });

    if (existing) {
      throw new BadRequestException(
        `Já existe uma empresa/produtor cadastrado com o documento ${data.cpf_cnpj}.`,
      );
    }

    return this.prisma.empresa.create({
      data,
      include: {
        propriedades: true,
        usuarios: {
          include: { usuario: true },
        },
      },
    });
  }

  async findAll(filters?: {
    search?: string;
    type?: string;
    city?: string;
    state?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filters?.search) {
      const term = filters.search.trim();
      where.OR = [
        { razao_social: { contains: term, mode: 'insensitive' } },
        { nome_fantasia: { contains: term, mode: 'insensitive' } },
        { cpf_cnpj: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (filters?.type) {
      where.tipo = { contains: this.normalizeType(filters.type), mode: 'insensitive' };
    }

    if (filters?.city) {
      where.cidade = { contains: filters.city.trim(), mode: 'insensitive' };
    }

    if (filters?.state) {
      where.estado = { equals: this.normalizeState(filters.state) };
    }

    if (filters?.status) {
      where.status = this.normalizeStatus(filters.status);
    }

    return this.prisma.empresa.findMany({
      where,
      include: {
        propriedades: true,
      },
      orderBy: {
        razao_social: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
      include: {
        propriedades: true,
        usuarios: {
          include: { usuario: true },
        },
      },
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa/produtor com id ${id} não encontrado.`);
    }

    return empresa;
  }

  async update(id: number, dto: UpdateCompanyDto) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa/produtor com id ${id} não encontrado.`);
    }

    const mergedDto = {
      ...empresa,
      ...dto,
      name: dto.name ?? dto.razaoSocial ?? empresa.razao_social,
      razaoSocial: dto.razaoSocial ?? dto.name ?? empresa.razao_social,
      document: dto.document ?? dto.cpfCnpj ?? empresa.cpf_cnpj,
      cpfCnpj: dto.cpfCnpj ?? dto.document ?? empresa.cpf_cnpj,
      phone: dto.phone ?? empresa.telefone,
      email: dto.email ?? empresa.email ?? '',
      city: dto.city ?? dto.municipality ?? empresa.cidade ?? '',
      state: dto.state ?? dto.uf ?? empresa.estado ?? '',
      responsibleName:
        dto.responsibleName ?? dto.responsible_name ?? empresa.responsavel ?? '',
      responsible_name:
        dto.responsible_name ?? dto.responsibleName ?? empresa.responsavel ?? '',
      status: dto.status ?? empresa.status,
      type: dto.type ?? empresa.tipo ?? 'PF',
    } as any;

    const payload = this.buildCompanyData(mergedDto, { ignoreStatus: false });
    const existingCompany = await this.prisma.empresa.findFirst({
      where: {
        cpf_cnpj: payload.cpf_cnpj,
        NOT: { id },
      },
    });

    if (existingCompany) {
      throw new BadRequestException(
        `Já existe um registro com o documento ${payload.cpf_cnpj}.`,
      );
    }

    return this.prisma.empresa.update({
      where: { id },
      data: payload,
      include: {
        propriedades: true,
        usuarios: { include: { usuario: true } },
      },
    });
  }

  async updateStatus(id: number, status?: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa/produtor com id ${id} não encontrado.`);
    }

    const normalizedStatus = this.normalizeStatus(status ?? empresa.status);

    return this.prisma.empresa.update({
      where: { id },
      data: {
        status: normalizedStatus,
      },
      include: {
        propriedades: true,
      },
    });
  }

  async linkUser(companyId: number, dto: Record<string, any>) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: companyId },
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa/produtor com id ${companyId} não encontrado.`);
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

    const papel = String(dto.papelEmpresa ?? dto.role ?? dto.papel ?? 'responsavel').trim() || 'responsavel';
    const status = this.normalizeStatus(dto.status ?? 'ativo');
    const dataVinculo = new Date();

    return this.prisma.usuario_Empresa.upsert({
      where: {
        usuario_id_empresa_id: {
          usuario_id: userId,
          empresa_id: companyId,
        },
      },
      create: {
        usuario_id: userId,
        empresa_id: companyId,
        papel_empresa: papel,
        data_vinculo: dataVinculo,
        status,
      },
      update: {
        papel_empresa: papel,
        status,
        data_vinculo: dataVinculo,
      },
      include: {
        usuario: true,
        empresa: true,
      },
    });
  }

  async listUsers(companyId: number) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: companyId },
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa/produtor com id ${companyId} não encontrado.`);
    }

    return this.prisma.usuario_Empresa.findMany({
      where: { empresa_id: companyId },
      include: { usuario: true },
      orderBy: { usuario_id: 'asc' },
    });
  }

  private buildCompanyData(
    dto: CreateCompanyDto | UpdateCompanyDto,
    options?: { ignoreStatus?: boolean },
  ) {
    const rawType = dto.type ?? 'PF';
    const normalizedType = this.normalizeType(rawType);
    const name = String(
      dto.name ?? dto.razaoSocial ?? 'Produtor/Empresa sem nome',
    ).trim();
    const document = this.normalizeDocument(
      String(dto.document ?? dto.cpfCnpj ?? '').trim(),
    );
    const email = this.normalizeEmail(dto.email ?? '');
    const phone = this.normalizePhone(dto.phone ?? '');
    const city = String(dto.city ?? dto.municipality ?? '').trim();
    const state = this.normalizeState(dto.state ?? dto.uf ?? '');
    const responsible = String(
      dto.responsibleName ?? dto.responsible_name ?? '',
    ).trim();

    if (!name) {
      throw new BadRequestException('Nome ou razão social é obrigatório.');
    }

    if (!document) {
      throw new BadRequestException('CPF ou CNPJ é obrigatório.');
    }

    if (!email) {
      throw new BadRequestException('E-mail inválido ou não informado.');
    }

    if (!city) {
      throw new BadRequestException('Cidade é obrigatória.');
    }

    if (!state) {
      throw new BadRequestException('Estado é obrigatório.');
    }

    if (!phone) {
      throw new BadRequestException('Telefone é obrigatório.');
    }

    return {
      razao_social: name,
      nome_fantasia: name,
      cpf_cnpj: document,
      telefone: phone,
      email,
      cidade: city,
      estado: state,
      responsavel: responsible || name,
      tipo: normalizedType,
      status: this.normalizeStatus(dto.status ?? 'ativo'),
    };
  }

  private normalizeDocument(value: string) {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      return '';
    }

    if (digits.length === 11 || digits.length === 14) {
      return digits;
    }

    throw new BadRequestException('CPF ou CNPJ inválido.');
  }

  private normalizeType(value: string) {
    const normalized = value?.toString().trim().toLowerCase();
    if (!normalized) {
      return 'PF';
    }

    if (
      ['pf', 'fisica', 'pessoa_fisica', 'pessoa fisica', 'physical'].includes(
        normalized,
      )
    ) {
      return 'PF';
    }

    if (
      ['pj', 'juridica', 'pessoa_juridica', 'pessoa juridica', 'company'].includes(
        normalized,
      )
    ) {
      return 'PJ';
    }

    return normalized.toUpperCase();
  }

  private normalizeEmail(value: string) {
    const email = value?.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '');
    if (!valid) {
      throw new BadRequestException('E-mail inválido.');
    }
    return email;
  }

  private normalizePhone(value: string) {
    const digits = value?.replace(/\D/g, '') ?? '';
    if (digits.length < 10) {
      throw new BadRequestException('Telefone inválido.');
    }
    return value.trim();
  }

  private normalizeState(value: string) {
    const state = String(value ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) {
      throw new BadRequestException('Estado deve conter 2 letras.');
    }
    return state;
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
