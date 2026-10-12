import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { CompaniesService } from './companies.service.js';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let prisma: any;
  let authz: any;
  const actorId = 42;

  const validPerson = {
    type: 'PF',
    name: 'Pessoa Teste',
    document: '529.982.247-25',
    phone: '(87) 99999-9999',
    email: 'pessoa@example.test',
    city: 'Petrolina',
    state: 'pe',
    responsibleName: 'Pessoa Teste',
  };

  beforeEach(() => {
    prisma = {
      empresa: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      usuario: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      usuario_Empresa: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    prisma.empresa.count.mockResolvedValue(0);
    authz = {
      assertCanManageCompanies: vi.fn().mockResolvedValue(undefined),
      assertCanReadCompany: vi.fn().mockResolvedValue(undefined),
      assertCanManageCompanyAssociations: vi.fn().mockResolvedValue(undefined),
      companyScope: vi.fn().mockResolvedValue({}),
      canReadCompanyDocument: vi.fn().mockResolvedValue(false),
    };
    service = new CompaniesService(prisma as unknown as PrismaService, authz);
  });

  it('normalizes and persists valid individual and corporate documents', async () => {
    prisma.empresa.findFirst.mockResolvedValue(null);
    prisma.empresa.create.mockImplementation(({ data }: any) =>
      Promise.resolve(data),
    );

    const person = await service.create(actorId, validPerson);
    const company = await service.create(actorId, {
      ...validPerson,
      type: 'PJ',
      document: '11.222.333/0001-81',
    });

    expect(person.cpf_cnpj).toBe('***.***.***-25');
    expect(person.estado).toBe('PE');
    expect(company.cpf_cnpj).toBe('**.***.***/****-81');
    expect(company.tipo).toBe('PJ');
    expect(prisma.empresa.create).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['missing name', { ...validPerson, name: undefined }],
    ['required name', { ...validPerson, name: ' ' }],
    ['missing type', { ...validPerson, type: undefined }],
    ['unsupported type', { ...validPerson, type: 'invalid' }],
    ['non-text type', { ...validPerson, type: 42 }],
    ['invalid CPF checksum', { ...validPerson, document: '111.111.111-11' }],
    [
      'invalid CNPJ checksum',
      { ...validPerson, type: 'PJ', document: '11.222.333/0001-80' },
    ],
    ['numeric document', { ...validPerson, document: 52998224725 }],
    ['wrong document type', { ...validPerson, type: 'PJ' }],
    ['invalid email', { ...validPerson, email: 'not-an-email' }],
    ['non-text email', { ...validPerson, email: 42 }],
    ['invalid phone', { ...validPerson, phone: '123' }],
    ['non-text phone', { ...validPerson, phone: 87123456789 }],
    ['invalid Brazilian state', { ...validPerson, state: 'XX' }],
  ])('rejects %s', async (_scenario, payload) => {
    await expect(service.create(actorId, payload)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.empresa.create).not.toHaveBeenCalled();
  });

  it('rejects a repeated document after removing punctuation', async () => {
    prisma.empresa.findFirst.mockResolvedValue({ id: 4 });

    await expect(
      service.create(actorId, { ...validPerson, document: '52998224725' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.empresa.findFirst).toHaveBeenCalledWith({
      where: { cpf_cnpj: '52998224725' },
      select: { id: true },
    });
  });

  it('searches documents with punctuation removed and applies filters', async () => {
    prisma.empresa.findMany.mockResolvedValue([]);

    await service.findAll(actorId, {
      search: '529.982.247-25',
      type: 'pf',
      city: 'Petrolina',
      state: 'pe',
      status: 'ativo',
    });

    expect(prisma.empresa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {},
            {
              OR: [
                {
                  razao_social: {
                    contains: '529.982.247-25',
                    mode: 'insensitive',
                  },
                },
                {
                  nome_fantasia: {
                    contains: '529.982.247-25',
                    mode: 'insensitive',
                  },
                },
                { cpf_cnpj: { contains: '52998224725', mode: 'insensitive' } },
              ],
            },
            { tipo: 'PF' },
            { cidade: { contains: 'Petrolina', mode: 'insensitive' } },
            { estado: { equals: 'PE' } },
            { status: 'ativo' },
          ],
        },
      }),
    );
  });

  it('applies server pagination and returns total metadata', async () => {
    prisma.empresa.findMany.mockResolvedValue([
      { id: 3, cpf_cnpj: '52998224725' },
    ]);
    prisma.empresa.count.mockResolvedValue(45);

    await expect(
      service.findAll(actorId, {}, { page: '3', limit: '10' }),
    ).resolves.toMatchObject({
      data: [{ id: 3 }],
      meta: { page: 3, limit: 10, total: 45, totalPages: 5 },
    });
    expect(prisma.empresa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it('preserves existing fields when updating only the company name', async () => {
    const existing = {
      id: 9,
      razao_social: 'Nome antigo',
      nome_fantasia: 'Nome antigo',
      cpf_cnpj: '52998224725',
      telefone: '(87) 99999-9999',
      email: 'pessoa@example.test',
      cidade: 'Petrolina',
      estado: 'PE',
      responsavel: 'Pessoa Teste',
      tipo: 'PF',
      status: 'ativo',
    };
    prisma.empresa.findUnique.mockResolvedValue(existing);
    prisma.empresa.findFirst.mockResolvedValue(null);
    prisma.empresa.update.mockImplementation(({ data }: any) =>
      Promise.resolve(data),
    );

    const updated = await service.update(actorId, 9, { name: 'Nome novo' });

    expect(updated.razao_social).toBe('Nome novo');
    expect(updated.cpf_cnpj).toBe('***.***.***-25');
    expect(updated.email).toBe(existing.email);
    expect(prisma.empresa.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 9 } }),
    );
  });

  it('returns not found for an unknown company and validates status changes', async () => {
    prisma.empresa.findUnique.mockResolvedValue(null);
    await expect(service.findOne(actorId, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.empresa.findUnique.mockResolvedValue({ id: 9, status: 'ativo' });
    prisma.empresa.update.mockResolvedValue({
      id: 9,
      status: 'inativo',
      cpf_cnpj: '52998224725',
    });
    await expect(
      service.updateStatus(actorId, 9, 'inativo'),
    ).resolves.toMatchObject({
      status: 'inativo',
    });
  });

  it('upserts a user-company association and can list existing associations', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      id: 9,
      cpf_cnpj: '52998224725',
    });
    prisma.usuario.findUnique.mockResolvedValue({ id: 3, status: 'ativo' });
    prisma.usuario_Empresa.upsert.mockResolvedValue({ id: 1 });
    prisma.usuario_Empresa.findMany.mockResolvedValue([{ id: 1 }]);

    await service.linkUser(actorId, 9, { userId: 3 });
    const associations = await service.listUsers(actorId, 9);

    expect(prisma.usuario_Empresa.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuario_id_empresa_id: { usuario_id: 3, empresa_id: 9 } },
        select: {
          id: true,
          usuario_id: true,
          empresa_id: true,
          papel_empresa: true,
          data_vinculo: true,
          status: true,
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
              telefone: true,
              perfil: true,
              status: true,
            },
          },
        },
      }),
    );
    expect(prisma.usuario_Empresa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          usuario_id: true,
          empresa_id: true,
          papel_empresa: true,
          data_vinculo: true,
          status: true,
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
              telefone: true,
              perfil: true,
              status: true,
            },
          },
        },
      }),
    );
    expect(associations).toEqual([{ id: 1 }]);
  });

  it('rejects linking a user that does not exist', async () => {
    prisma.empresa.findUnique.mockResolvedValue({ id: 9 });
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      service.linkUser(actorId, 9, { userId: 404 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists available users without credential or document fields', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      id: 9,
      cpf_cnpj: '52998224725',
    });
    prisma.usuario.findMany.mockResolvedValue([]);

    await service.listAvailableUsers(actorId, 9);

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          perfil: true,
          status: true,
        },
      }),
    );
  });

  it('soft-unlinks an active user-company association', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      id: 9,
      cpf_cnpj: '52998224725',
    });
    prisma.usuario_Empresa.findUnique.mockResolvedValue({
      id: 8,
      status: 'ativo',
    });
    prisma.usuario_Empresa.update.mockResolvedValue({
      id: 8,
      status: 'inativo',
    });

    await expect(service.unlinkUser(actorId, 9, 3)).resolves.toMatchObject({
      id: 8,
      status: 'inativo',
    });
    expect(prisma.usuario_Empresa.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuario_id_empresa_id: { usuario_id: 3, empresa_id: 9 },
        },
        data: { status: 'inativo' },
      }),
    );
  });

  it('denies association access when the company is outside the actor scope', async () => {
    authz.assertCanReadCompany.mockRejectedValue(new NotFoundException());

    await expect(service.listUsers(actorId, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.empresa.findUnique).not.toHaveBeenCalled();
  });

  it('rejects company management without the required permission', async () => {
    authz.assertCanManageCompanies.mockRejectedValue(new ForbiddenException());

    await expect(service.create(actorId, validPerson)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.empresa.create).not.toHaveBeenCalled();
  });

  it('masks company documents unless the actor has explicit permission', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      id: 9,
      cpf_cnpj: '52998224725',
    });
    await expect(service.findOne(actorId, 9)).resolves.toMatchObject({
      cpf_cnpj: '***.***.***-25',
    });

    authz.canReadCompanyDocument.mockResolvedValue(true);
    await expect(service.findOne(actorId, 9)).resolves.toMatchObject({
      cpf_cnpj: '52998224725',
    });
  });
});
