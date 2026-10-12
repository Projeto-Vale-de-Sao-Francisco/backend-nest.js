import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const EPIC3_PERMISSIONS = {
  admin: 'epic3:admin',
  companiesRead: 'empresas:ler',
  companiesManage: 'empresas:gerenciar',
  companiesAssociate: 'empresas:associar',
  companiesDocumentRead: 'empresas:documento:ler',
  propertiesRead: 'propriedades:ler',
  propertiesManage: 'propriedades:gerenciar',
  propertiesAssociate: 'propriedades:associar',
} as const;

type UserAccess = {
  permissions: Set<string>;
  companyIds: number[];
  propertyIds: number[];
  propertyCompanyIds: number[];
};

@Injectable()
export class AuthzService {
  constructor(private readonly prisma: PrismaService) {}

  async assertActiveUser(userId: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    if (!user || user.status.toLowerCase() !== 'ativo') {
      throw new UnauthorizedException('Usuário não autenticado ou inativo.');
    }
  }

  async assertCanManageCompanies(userId: number) {
    const access = await this.getAccess(userId);
    if (
      !this.has(
        access,
        EPIC3_PERMISSIONS.admin,
        EPIC3_PERMISSIONS.companiesManage,
      )
    ) {
      throw new ForbiddenException(
        'Permissão para gerenciar produtores/empresas negada.',
      );
    }
  }

  async assertCanManageProperties(userId: number) {
    const access = await this.getAccess(userId);
    if (
      !this.has(
        access,
        EPIC3_PERMISSIONS.admin,
        EPIC3_PERMISSIONS.propertiesManage,
      )
    ) {
      throw new ForbiddenException(
        'Permissão para gerenciar propriedades negada.',
      );
    }
  }

  async assertCanManageCompanyAssociations(userId: number) {
    const access = await this.getAccess(userId);
    if (
      !this.has(
        access,
        EPIC3_PERMISSIONS.admin,
        EPIC3_PERMISSIONS.companiesAssociate,
      )
    ) {
      throw new ForbiddenException(
        'Permissão para gerenciar vínculos de empresa negada.',
      );
    }
  }

  async assertCanManagePropertyAssociations(userId: number) {
    const access = await this.getAccess(userId);
    if (
      !this.has(
        access,
        EPIC3_PERMISSIONS.admin,
        EPIC3_PERMISSIONS.propertiesAssociate,
      )
    ) {
      throw new ForbiddenException(
        'Permissão para gerenciar vínculos de propriedade negada.',
      );
    }
  }

  async canReadCompanyDocument(userId: number) {
    const access = await this.getAccess(userId);
    return this.has(
      access,
      EPIC3_PERMISSIONS.admin,
      EPIC3_PERMISSIONS.companiesDocumentRead,
    );
  }

  async companyScope(userId: number) {
    const access = await this.getAccess(userId);
    if (
      this.has(
        access,
        EPIC3_PERMISSIONS.admin,
        EPIC3_PERMISSIONS.companiesRead,
        EPIC3_PERMISSIONS.companiesManage,
      )
    ) {
      return {};
    }

    const ids = [
      ...new Set([...access.companyIds, ...access.propertyCompanyIds]),
    ];
    return { id: { in: ids } };
  }

  async propertyScope(userId: number) {
    const access = await this.getAccess(userId);
    if (
      this.has(
        access,
        EPIC3_PERMISSIONS.admin,
        EPIC3_PERMISSIONS.propertiesRead,
        EPIC3_PERMISSIONS.propertiesManage,
      )
    ) {
      return {};
    }

    const conditions = [];
    if (access.propertyIds.length) {
      conditions.push({ id: { in: access.propertyIds } });
    }
    if (access.companyIds.length) {
      conditions.push({ empresa_id: { in: access.companyIds } });
    }
    return conditions.length ? { OR: conditions } : { id: { in: [] } };
  }

  async assertCanReadCompany(userId: number, companyId: number) {
    const scope = await this.companyScope(userId);
    if (Object.keys(scope).length === 0) {
      return;
    }

    const accessible = await this.prisma.empresa.findFirst({
      where: { AND: [{ id: companyId }, scope] },
      select: { id: true },
    });
    if (!accessible) {
      throw new NotFoundException('Empresa/produtor não encontrado.');
    }
  }

  async assertCanReadProperty(userId: number, propertyId: number) {
    const scope = await this.propertyScope(userId);
    if (Object.keys(scope).length === 0) {
      return;
    }

    const accessible = await this.prisma.propriedade.findFirst({
      where: { AND: [{ id: propertyId }, scope] },
      select: { id: true },
    });
    if (!accessible) {
      throw new NotFoundException('Propriedade não encontrada.');
    }
  }

  async assertCanReadUserProperties(actorId: number, targetUserId: number) {
    if (actorId === targetUserId) {
      return;
    }

    const access = await this.getAccess(actorId);
    if (
      !this.has(
        access,
        EPIC3_PERMISSIONS.admin,
        EPIC3_PERMISSIONS.propertiesRead,
      )
    ) {
      throw new NotFoundException('Usuário não encontrado.');
    }
  }

  async assertCompanyScopeForProperty(userId: number, companyId: number) {
    await this.assertCanReadCompany(userId, companyId);
    await this.assertCanManageProperties(userId);
  }

  private async getAccess(userId: number): Promise<UserAccess> {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        status: true,
        permissoes: {
          select: {
            permissao: { select: { chave: true } },
          },
        },
        empresas: {
          where: { status: 'ativo' },
          select: { empresa_id: true },
        },
        propriedades: {
          where: { status: 'ativo' },
          select: {
            propriedade_id: true,
            propriedade: { select: { empresa_id: true } },
          },
        },
      },
    });

    if (!user || user.status.toLowerCase() !== 'ativo') {
      throw new UnauthorizedException('Usuário não autenticado ou inativo.');
    }

    return {
      permissions: new Set(
        user.permissoes.map(({ permissao }) => permissao.chave),
      ),
      companyIds: user.empresas.map(({ empresa_id }) => empresa_id),
      propertyIds: user.propriedades.map(
        ({ propriedade_id }) => propriedade_id,
      ),
      propertyCompanyIds: user.propriedades.map(
        ({ propriedade }) => propriedade.empresa_id,
      ),
    };
  }

  private has(access: UserAccess, ...permissions: string[]) {
    return permissions.some((permission) => access.permissions.has(permission));
  }
}
