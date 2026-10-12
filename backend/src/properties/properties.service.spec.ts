import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { PropertiesService } from './properties.service.js';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let prisma: any;
  let authz: any;
  const actorId = 42;

  const validProperty = {
    name: 'Fazenda Teste',
    empresaId: 12,
    municipality: 'Petrolina',
    state: 'pe',
    latitude: '-9.3891',
    longitude: '-40.5027',
    totalArea: '120.5',
  };

  beforeEach(() => {
    prisma = {
      empresa: {
        findUnique: vi.fn(),
      },
      propriedade: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      usuario: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      usuario_Propriedade: {
        findMany: vi.fn(),
        upsert: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    prisma.propriedade.count.mockResolvedValue(0);
    authz = {
      assertCanManageProperties: vi.fn().mockResolvedValue(undefined),
      assertCanReadCompany: vi.fn().mockResolvedValue(undefined),
      assertCanReadProperty: vi.fn().mockResolvedValue(undefined),
      assertCanManagePropertyAssociations: vi.fn().mockResolvedValue(undefined),
      propertyScope: vi.fn().mockResolvedValue({}),
      assertCanReadUserProperties: vi.fn().mockResolvedValue(undefined),
    };
    service = new PropertiesService(prisma as unknown as PrismaService, authz);
  });

  it('validates and persists a property under its existing company', async () => {
    prisma.empresa.findUnique.mockResolvedValue({ id: 12 });
    prisma.propriedade.create.mockImplementation(({ data }: any) =>
      Promise.resolve(data),
    );

    const result = await service.create(actorId, validProperty);

    expect(result).toMatchObject({
      empresa_id: 12,
      nome: 'Fazenda Teste',
      estado: 'PE',
      latitude: -9.3891,
      longitude: -40.5027,
      area_total: 120.5,
      status: 'ativo',
    });
  });

  it.each([
    ['missing name', { ...validProperty, name: ' ' }],
    ['non-text name', { ...validProperty, name: 123 }],
    ['missing producer', { ...validProperty, empresaId: undefined }],
    ['missing municipality', { ...validProperty, municipality: '' }],
    ['non-text municipality', { ...validProperty, municipality: 10 }],
    ['invalid Brazilian state', { ...validProperty, state: 'XX' }],
    ['latitude below range', { ...validProperty, latitude: -90.1 }],
    ['latitude above range', { ...validProperty, latitude: 90.1 }],
    ['longitude below range', { ...validProperty, longitude: -180.1 }],
    ['longitude above range', { ...validProperty, longitude: 180.1 }],
    ['zero area', { ...validProperty, totalArea: 0 }],
    ['negative area', { ...validProperty, totalArea: -1 }],
    ['invalid area format', { ...validProperty, totalArea: 'not-a-number' }],
    ['invalid status', { ...validProperty, status: 'deleted' }],
  ])('rejects %s', async (_scenario, payload) => {
    await expect(service.create(actorId, payload)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.propriedade.create).not.toHaveBeenCalled();
  });

  it('rejects a property for a company that does not exist', async () => {
    prisma.empresa.findUnique.mockResolvedValue(null);

    await expect(service.create(actorId, validProperty)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.propriedade.create).not.toHaveBeenCalled();
  });

  it('preserves the producer and other fields for a partial update', async () => {
    const existing = {
      id: 7,
      empresa_id: 12,
      nome: 'Fazenda antiga',
      municipio: 'Petrolina',
      estado: 'PE',
      latitude: -9.3891,
      longitude: -40.5027,
      area_total: 120.5,
      status: 'ativo',
    };
    prisma.propriedade.findUnique.mockResolvedValue(existing);
    prisma.empresa.findUnique.mockResolvedValue({ id: 12 });
    prisma.propriedade.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...existing, ...data }),
    );

    const updated = await service.update(actorId, 7, {
      name: 'Fazenda renomeada',
    });

    expect(updated).toMatchObject({
      empresa_id: 12,
      nome: 'Fazenda renomeada',
      municipio: 'Petrolina',
      area_total: 120.5,
    });
    expect(prisma.empresa.findUnique).toHaveBeenCalledWith({
      where: { id: 12 },
      select: { id: true },
    });
  });

  it('filters property listings and rejects invalid company identifiers', async () => {
    prisma.propriedade.findMany.mockResolvedValue([]);

    await service.findAll(actorId, {
      search: 'Fazenda',
      companyId: 12,
      municipality: 'Petrolina',
      state: 'PE',
      status: 'ativa',
    });

    expect(prisma.propriedade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {},
            {
              OR: [
                { nome: { contains: 'Fazenda', mode: 'insensitive' } },
                {
                  empresa: {
                    razao_social: {
                      contains: 'Fazenda',
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  empresa: {
                    nome_fantasia: {
                      contains: 'Fazenda',
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            },
            { empresa_id: 12 },
            { municipio: { contains: 'Petrolina', mode: 'insensitive' } },
            { estado: { equals: 'PE' } },
            { status: 'ativo' },
          ],
        },
      }),
    );

    await expect(
      service.findAll(actorId, { companyId: Number.NaN }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found for missing properties and supports status reactivation', async () => {
    prisma.propriedade.findUnique.mockResolvedValue(null);
    await expect(service.findOne(actorId, 404)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.propriedade.findUnique.mockResolvedValue({
      id: 7,
      status: 'inativo',
    });
    prisma.propriedade.update.mockResolvedValue({ id: 7, status: 'ativo' });
    await expect(
      service.updateStatus(actorId, 7, 'ativo'),
    ).resolves.toMatchObject({
      status: 'ativo',
    });
  });

  it('upserts a property-user association and lists it', async () => {
    prisma.propriedade.findUnique.mockResolvedValue({ id: 7 });
    prisma.usuario.findUnique.mockResolvedValue({ id: 3, status: 'ativo' });
    prisma.usuario_Propriedade.upsert.mockResolvedValue({ id: 1 });
    prisma.usuario_Propriedade.findMany.mockResolvedValue([{ id: 1 }]);

    await service.linkUser(actorId, 7, { userId: 3 });
    const associations = await service.listUsers(actorId, 7);

    expect(prisma.usuario_Propriedade.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuario_id_propriedade_id: { usuario_id: 3, propriedade_id: 7 },
        },
        select: {
          id: true,
          usuario_id: true,
          propriedade_id: true,
          papel_vinculo: true,
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
    expect(prisma.usuario_Propriedade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          usuario_id: true,
          propriedade_id: true,
          papel_vinculo: true,
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

  it('rejects property management without the required permission', async () => {
    authz.assertCanManageProperties.mockRejectedValue(new ForbiddenException());

    await expect(service.create(actorId, validProperty)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.propriedade.create).not.toHaveBeenCalled();
  });

  it('uses server-side pagination and enforces the maximum page size', async () => {
    prisma.propriedade.findMany.mockResolvedValue([{ id: 8 }]);
    prisma.propriedade.count.mockResolvedValue(21);

    await expect(
      service.findAll(actorId, {}, { page: '2', limit: '10' }),
    ).resolves.toMatchObject({
      data: [{ id: 8 }],
      meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
    expect(prisma.propriedade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    await expect(
      service.findAll(actorId, {}, { limit: '101' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists only properties linked to the requested user', async () => {
    prisma.propriedade.findMany.mockResolvedValue([]);
    prisma.propriedade.count.mockResolvedValue(0);

    await service.findAccessibleByUser(actorId, 73, { page: '3', limit: '4' });

    expect(authz.assertCanReadUserProperties).toHaveBeenCalledWith(actorId, 73);
    expect(prisma.propriedade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarios: {
            some: { usuario_id: 73, status: 'ativo' },
          },
        },
        skip: 8,
        take: 4,
      }),
    );
  });

  it('lists available users without credential or document fields', async () => {
    prisma.propriedade.findUnique.mockResolvedValue({ id: 7 });
    prisma.usuario.findMany.mockResolvedValue([]);

    await service.listAvailableUsers(actorId, 7);

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

  it('soft-unlinks an active user-property association', async () => {
    prisma.propriedade.findUnique.mockResolvedValue({ id: 7 });
    prisma.usuario_Propriedade.findUnique.mockResolvedValue({
      id: 6,
      status: 'ativo',
    });
    prisma.usuario_Propriedade.update.mockResolvedValue({
      id: 6,
      status: 'inativo',
    });

    await expect(service.unlinkUser(actorId, 7, 3)).resolves.toMatchObject({
      id: 6,
      status: 'inativo',
    });
    expect(prisma.usuario_Propriedade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuario_id_propriedade_id: {
            usuario_id: 3,
            propriedade_id: 7,
          },
        },
        data: { status: 'inativo' },
      }),
    );
  });

  it('denies association access when the property is outside the actor scope', async () => {
    authz.assertCanReadProperty.mockRejectedValue(new NotFoundException());

    await expect(service.listUsers(actorId, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.propriedade.findUnique).not.toHaveBeenCalled();
  });
});
