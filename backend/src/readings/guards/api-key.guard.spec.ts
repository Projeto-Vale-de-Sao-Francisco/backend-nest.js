import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ApiKeyGuard } from './api-key.guard.js';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let config: { get: ReturnType<typeof vi.fn> };
  let prisma: {
    dispositivo_Credencial: { findUnique: ReturnType<typeof vi.fn> };
    dispositivo: { findUnique: ReturnType<typeof vi.fn> };
  };
  let request: any;
  const context = () => ({
    switchToHttp: () => ({ getRequest: () => request }),
  });

  beforeEach(() => {
    config = { get: vi.fn() };
    prisma = {
      dispositivo_Credencial: { findUnique: vi.fn() },
      dispositivo: { findUnique: vi.fn() },
    };
    request = { headers: {} };
    guard = new ApiKeyGuard(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  it('associa a requisição à identidade do dispositivo do token individual', async () => {
    const token = randomBytes(32).toString('base64url');
    prisma.dispositivo_Credencial.findUnique.mockResolvedValue({
      revoked_at: null,
      dispositivo: { id: 8, codigo: 'DEVICE-08', status: 'ativo' },
    });
    request.headers['x-device-token'] = token;

    await expect(guard.canActivate(context() as any)).resolves.toBe(true);

    expect(prisma.dispositivo_Credencial.findUnique).toHaveBeenCalledWith({
      where: {
        token_hash: createHash('sha256').update(token).digest('hex'),
      },
      include: {
        dispositivo: {
          select: { id: true, codigo: true, status: true },
        },
      },
    });
    expect(request.authenticatedDevice).toEqual({
      id: 8,
      codigo: 'DEVICE-08',
    });
  });

  it.each([
    ['token inválido', { revoked_at: null, dispositivo: { id: 8, codigo: 'DEVICE-08', status: 'ativo' } }],
    ['token revogado', { revoked_at: new Date(), dispositivo: { id: 8, codigo: 'DEVICE-08', status: 'ativo' } }],
    ['dispositivo inativo', { revoked_at: null, dispositivo: { id: 8, codigo: 'DEVICE-08', status: 'inativo' } }],
  ])('rejeita %s', async (_label, credential) => {
    prisma.dispositivo_Credencial.findUnique.mockResolvedValue(
      _label === 'token inválido' ? null : credential,
    );
    request.headers['x-device-token'] = randomBytes(32).toString('base64url');

    await expect(guard.canActivate(context() as any)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(request.authenticatedDevice).toBeUndefined();
  });

  it('aceita chave legada somente quando limitada ao dispositivo configurado', async () => {
    config.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        DEVICE_API_KEY_LEGACY_ENABLED: 'true',
        DEVICE_API_KEY: 'legacy-key-that-is-at-least-thirty-two-characters',
        DEVICE_API_KEY_LEGACY_DEVICE_ID: '8',
      };
      return values[key];
    });
    prisma.dispositivo.findUnique.mockResolvedValue({
      id: 8,
      codigo: 'DEVICE-08',
      status: 'ativo',
    });
    request.headers['x-api-key'] =
      'legacy-key-that-is-at-least-thirty-two-characters';

    await expect(guard.canActivate(context() as any)).resolves.toBe(true);
    expect(request.authenticatedDevice).toEqual({
      id: 8,
      codigo: 'DEVICE-08',
    });
  });

  it('rejeita chave global legada quando o modo de transição está desligado', async () => {
    request.headers['x-api-key'] =
      'legacy-key-that-is-at-least-thirty-two-characters';

    await expect(guard.canActivate(context() as any)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.dispositivo.findUnique).not.toHaveBeenCalled();
  });
});
