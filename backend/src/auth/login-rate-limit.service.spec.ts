import {
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';

function createSharedDatabase() {
  const buckets = new Map<
    string,
    { attempts: number; windowStartedAt: number; blockedUntil: number }
  >();

  const db: any = {
    $queryRaw: vi.fn(async (_query: TemplateStringsArray, keys: string[]) => {
      const blockedKey = keys.find(
        (key) => (buckets.get(key)?.blockedUntil ?? 0) > Date.now(),
      );
      return blockedKey ? [{ bucket_key: blockedKey }] : [];
    }),
    $executeRaw: vi.fn(
      async (query: TemplateStringsArray, ...values: unknown[]) => {
        if (query.join('').includes('DELETE FROM "Login_Rate_Limit"')) {
          return 0;
        }
        const key = String(values[0]);
        const maxAttempts = Number(values[1]);
        const blockMs = Number(values[2]);
        const windowMs = Number(values[3]);
        const now = Date.now();
        const previous = buckets.get(key);
        const expired =
          !previous || now - previous.windowStartedAt >= windowMs;
        const attempts = expired ? 1 : previous.attempts + 1;
        buckets.set(key, {
          attempts,
          windowStartedAt: expired ? now : previous.windowStartedAt,
          blockedUntil: attempts >= maxAttempts ? now + blockMs : 0,
        });
        return 1;
      },
    ),
    $transaction: vi.fn(async (callback: (tx: any) => unknown) =>
      callback(db),
    ),
    login_Rate_Limit: {
      deleteMany: vi.fn(async ({ where }: any) => {
        if (where.bucket_key) {
          buckets.delete(where.bucket_key);
        }
        return { count: 1 };
      }),
    },
  };

  return db;
}

function createAuthService(
  rateLimit: LoginRateLimitService,
) {
  const authDb = {
    usuario: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
  return new AuthService(
    authDb,
    { signAsync: vi.fn() } as unknown as JwtService,
    rateLimit,
  );
}

describe('LoginRateLimitService', () => {
  beforeEach(() => {
    process.env.LOGIN_RATE_MAX_ATTEMPTS = '2';
    process.env.LOGIN_RATE_WINDOW_MS = '60000';
    process.env.LOGIN_RATE_BLOCK_MS = '1000';
    vi.useRealTimers();
  });
  afterEach(() => {
    delete process.env.LOGIN_RATE_MAX_ATTEMPTS;
    delete process.env.LOGIN_RATE_WINDOW_MS;
    delete process.env.LOGIN_RATE_BLOCK_MS;
    vi.useRealTimers();
  });

  it('compartilha bloqueio entre instâncias usando o PostgreSQL comum', async () => {
    const sharedDb = createSharedDatabase();
    const authA = createAuthService(
      new LoginRateLimitService(sharedDb as PrismaService),
    );
    const authB = createAuthService(
      new LoginRateLimitService(sharedDb as PrismaService),
    );
    const credentials = { email: 'produtor@example.com', senha: 'errada' };

    await expect(authA.login(credentials, '192.0.2.1')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(authA.login(credentials, '192.0.2.1')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(authB.login(credentials, '192.0.2.1')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  }, 15_000);

  it('bloqueia por conta apesar da troca de IP e libera após expiração', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));
    process.env.LOGIN_RATE_MAX_ATTEMPTS = '1';

    const sharedDb = createSharedDatabase();
    const limiter = new LoginRateLimitService(sharedDb as PrismaService);
    const auth = createAuthService(limiter);
    const credentials = { email: 'produtor@example.com', senha: 'errada' };

    await expect(auth.login(credentials, '192.0.2.1')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(auth.login(credentials, '198.51.100.8')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    vi.advanceTimersByTime(1001);
    await expect(auth.login(credentials, '198.51.100.8')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('falha de forma fechada quando o PostgreSQL está indisponível', async () => {
    const brokenDb = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('database offline')),
      $transaction: vi.fn(),
      login_Rate_Limit: { deleteMany: vi.fn() },
    } as unknown as PrismaService;
    const limiter = new LoginRateLimitService(brokenDb);

    await expect(limiter.assertNotBlocked(['ip:hash', 'email:hash'])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    const writeFailureDb = {
      $transaction: vi.fn().mockRejectedValue(new Error('database offline')),
      login_Rate_Limit: { deleteMany: vi.fn() },
    } as unknown as PrismaService;
    await expect(
      new LoginRateLimitService(writeFailureDb).recordFailure([
        'ip:hash',
        'email:hash',
      ]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('limpa buckets antigos em lotes sem remover os buckets atuais ou bloqueados', async () => {
    const sharedDb = createSharedDatabase();
    const limiter = new LoginRateLimitService(sharedDb as PrismaService);

    await limiter.recordFailure(['ip:hash', 'account:hash']);

    const cleanup = sharedDb.$executeRaw.mock.calls.find(([query]) =>
      query.join('').includes('DELETE FROM "Login_Rate_Limit"'),
    );
    expect(cleanup).toBeDefined();
    expect(cleanup?.[0].join(' ')).toContain('"updated_at" < NOW()');
    expect(cleanup?.[0].join(' ')).toContain(
      '"blocked_until" IS NULL OR "blocked_until" <= NOW()',
    );
    expect(cleanup?.[0].join(' ')).toContain('FOR UPDATE SKIP LOCKED');
    expect(cleanup?.[1]).toBe(86_400_000);
    expect(cleanup?.[2]).toEqual(['ip:hash', 'account:hash']);
    expect(cleanup?.[3]).toBe(500);
  });
});
