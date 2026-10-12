import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthzService, EPIC3_PERMISSIONS } from './authz.service.js';

describe('AuthzService', () => {
  const makePrisma = (permissions: string[] = []) => ({
    usuario: {
      findUnique: vi.fn().mockResolvedValue({
        status: 'ativo',
        permissoes: permissions.map((chave) => ({ permissao: { chave } })),
        empresas: [{ empresa_id: 11 }],
        propriedades: [
          {
            propriedade_id: 21,
            propriedade: { empresa_id: 12 },
          },
        ],
      }),
    },
    empresa: { findFirst: vi.fn().mockResolvedValue(null) },
    propriedade: { findFirst: vi.fn().mockResolvedValue(null) },
  });

  it('limits company reads to explicit memberships without a global read permission', async () => {
    const prisma = makePrisma();
    const service = new AuthzService(prisma as unknown as PrismaService);

    await expect(service.companyScope(7)).resolves.toEqual({
      id: { in: [11, 12] },
    });
    await expect(service.assertCanReadCompany(7, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.empresa.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ id: 999 }, { id: { in: [11, 12] } }] },
      select: { id: true },
    });
  });

  it('does not grant administrative changes to a user with read-only permission', async () => {
    const prisma = makePrisma([EPIC3_PERMISSIONS.companiesRead]);
    const service = new AuthzService(prisma as unknown as PrismaService);

    await expect(service.assertCanManageCompanies(7)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('requires association permissions independently of record scope', async () => {
    const service = new AuthzService(makePrisma() as unknown as PrismaService);

    await expect(
      service.assertCanManageCompanyAssociations(7),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.assertCanManagePropertyAssociations(7),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limits property reads to active property and company memberships', async () => {
    const prisma = makePrisma();
    const service = new AuthzService(prisma as unknown as PrismaService);

    await expect(service.propertyScope(7)).resolves.toEqual({
      OR: [{ id: { in: [21] } }, { empresa_id: { in: [11] } }],
    });
    await expect(service.assertCanReadProperty(7, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.propriedade.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: 999 },
          { OR: [{ id: { in: [21] } }, { empresa_id: { in: [11] } }] },
        ],
      },
      select: { id: true },
    });
  });

  it('returns document permission only for the explicit document-read grant', async () => {
    const denied = new AuthzService(makePrisma() as unknown as PrismaService);
    const allowed = new AuthzService(
      makePrisma([
        EPIC3_PERMISSIONS.companiesDocumentRead,
      ]) as unknown as PrismaService,
    );

    await expect(denied.canReadCompanyDocument(7)).resolves.toBe(false);
    await expect(allowed.canReadCompanyDocument(7)).resolves.toBe(true);
  });
});
