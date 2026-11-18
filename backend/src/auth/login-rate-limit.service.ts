import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_BLOCK_MS = 15 * 60 * 1000;
const MAX_BUCKET_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_BUCKETS_PER_CLEANUP = 500;

@Injectable()
export class LoginRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async assertNotBlocked(keys: string[]) {
    try {
      const blocked = await this.prisma.$queryRaw<
        Array<{ bucket_key: string }>
      >`
        SELECT "bucket_key"
        FROM "Login_Rate_Limit"
        WHERE "bucket_key" = ANY(${keys}::text[])
          AND "blocked_until" > NOW()
        LIMIT 1
      `;

      if (blocked.length > 0) {
        throw new HttpException(
          'Muitas tentativas de autenticação. Tente novamente mais tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'Limitação de autenticação temporariamente indisponível.',
      );
    }
  }

  async recordFailure(keys: string[]) {
    const config = this.config();
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const key of keys) {
          await tx.$executeRaw`
            INSERT INTO "Login_Rate_Limit" (
              "bucket_key",
              "attempts",
              "window_started_at",
              "blocked_until",
              "updated_at"
            )
            VALUES (
              ${key},
              1,
              NOW(),
              CASE
                WHEN ${config.maxAttempts} <= 1
                THEN NOW() + (${config.blockMs} * INTERVAL '1 millisecond')
                ELSE NULL
              END,
              NOW()
            )
            ON CONFLICT ("bucket_key") DO UPDATE SET
              "attempts" = CASE
                WHEN "Login_Rate_Limit"."window_started_at" <=
                  NOW() - (${config.windowMs} * INTERVAL '1 millisecond')
                THEN 1
                ELSE "Login_Rate_Limit"."attempts" + 1
              END,
              "window_started_at" = CASE
                WHEN "Login_Rate_Limit"."window_started_at" <=
                  NOW() - (${config.windowMs} * INTERVAL '1 millisecond')
                THEN NOW()
                ELSE "Login_Rate_Limit"."window_started_at"
              END,
              "blocked_until" = CASE
                WHEN (
                  CASE
                    WHEN "Login_Rate_Limit"."window_started_at" <=
                      NOW() - (${config.windowMs} * INTERVAL '1 millisecond')
                    THEN 1
                    ELSE "Login_Rate_Limit"."attempts" + 1
                  END
                ) >= ${config.maxAttempts}
                THEN NOW() + (${config.blockMs} * INTERVAL '1 millisecond')
                ELSE NULL
              END,
              "updated_at" = NOW()
          `;
        }

        await tx.$executeRaw`
          WITH expired AS (
            SELECT "bucket_key"
            FROM "Login_Rate_Limit"
            WHERE "updated_at" < NOW() -
              (${MAX_BUCKET_AGE_MS} * INTERVAL '1 millisecond')
              AND ("blocked_until" IS NULL OR "blocked_until" <= NOW())
              AND NOT ("bucket_key" = ANY(${keys}::text[]))
            ORDER BY "updated_at"
            LIMIT ${MAX_BUCKETS_PER_CLEANUP}
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM "Login_Rate_Limit" AS buckets
          USING expired
          WHERE buckets."bucket_key" = expired."bucket_key"
        `;
      });
    } catch {
      throw new ServiceUnavailableException(
        'Limitação de autenticação temporariamente indisponível.',
      );
    }
  }

  async clearAccountKey(key: string) {
    try {
      await this.prisma.login_Rate_Limit.deleteMany({
        where: { bucket_key: key },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Limitação de autenticação temporariamente indisponível.',
      );
    }
  }

  private config() {
    return {
      maxAttempts: this.positiveInteger(
        'LOGIN_RATE_MAX_ATTEMPTS',
        DEFAULT_MAX_ATTEMPTS,
        100,
      ),
      windowMs: this.positiveInteger(
        'LOGIN_RATE_WINDOW_MS',
        DEFAULT_WINDOW_MS,
        86_400_000,
      ),
      blockMs: this.positiveInteger(
        'LOGIN_RATE_BLOCK_MS',
        DEFAULT_BLOCK_MS,
        86_400_000,
      ),
    };
  }

  private positiveInteger(name: string, fallback: number, maximum: number) {
    const raw = process.env[name];
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
      throw new InternalServerErrorException(
        `Configuração ${name} inválida.`,
      );
    }
    return value;
  }
}
