import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    const [auditPrivileges] = await this.$queryRaw<
      Array<{ application_role_is_restricted: boolean }>
    >`
      SELECT
        NOT pg_has_role(current_user, audit_table.relowner, 'MEMBER')
        AND NOT has_table_privilege(current_user, audit_table.oid, 'UPDATE')
        AND NOT has_table_privilege(current_user, audit_table.oid, 'DELETE')
        AND NOT has_table_privilege(current_user, audit_table.oid, 'TRUNCATE')
        AND NOT has_table_privilege(current_user, audit_table.oid, 'TRIGGER')
          AS application_role_is_restricted
      FROM pg_class AS audit_table
      JOIN pg_namespace AS audit_schema
        ON audit_schema.oid = audit_table.relnamespace
      WHERE audit_schema.nspname = 'public'
        AND audit_table.relname = 'Audit_Log'
        AND audit_table.relkind = 'r'
    `;

    if (!auditPrivileges?.application_role_is_restricted) {
      await this.$disconnect();
      throw new Error(
        'Em produção, DATABASE_URL deve usar uma role sem propriedade ou privilégios de alteração em Audit_Log.',
      );
    }
  }
}
