import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL must be configured.');
    }

    const schema =
      new URL(connectionString).searchParams.get('schema') ?? undefined;
    const adapter = new PrismaPg(
      {
        connectionString,
      },
      { schema },
    );

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
