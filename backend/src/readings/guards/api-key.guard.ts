import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AuthenticatedDevice {
  id: number;
  codigo: string;
}

export interface DeviceAuthenticatedRequest extends Request {
  authenticatedDevice?: AuthenticatedDevice;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<DeviceAuthenticatedRequest>();
    const deviceToken = request.headers['x-device-token'];

    if (typeof deviceToken === 'string') {
      if (!/^[A-Za-z0-9_-]{43}$/.test(deviceToken)) {
        throw new UnauthorizedException(
          'Credencial do dispositivo inválida.',
        );
      }
      await this.authenticateDeviceToken(deviceToken, request);
      return true;
    }

    const legacyKey = request.headers['x-api-key'];
    if (typeof legacyKey === 'string') {
      await this.authenticateLegacyKey(legacyKey, request);
      return true;
    }

    throw new UnauthorizedException('Credencial do dispositivo inválida.');
  }

  private async authenticateDeviceToken(
    token: string,
    request: DeviceAuthenticatedRequest,
  ) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    try {
      const credential = await this.prisma.dispositivo_Credencial.findUnique({
        where: { token_hash: tokenHash },
        include: {
          dispositivo: {
            select: { id: true, codigo: true, status: true },
          },
        },
      });

      if (
        !credential ||
        credential.revoked_at !== null ||
        credential.dispositivo.status !== 'ativo'
      ) {
        throw new UnauthorizedException(
          'Credencial do dispositivo inválida.',
        );
      }

      request.authenticatedDevice = {
        id: credential.dispositivo.id,
        codigo: credential.dispositivo.codigo,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'Autenticação do dispositivo temporariamente indisponível.',
      );
    }
  }

  private async authenticateLegacyKey(
    providedKey: string,
    request: DeviceAuthenticatedRequest,
  ) {
    const legacyEnabled =
      this.configService.get<string>('DEVICE_API_KEY_LEGACY_ENABLED') ===
      'true';
    const expectedKey = this.configService.get<string>('DEVICE_API_KEY');
    const configuredDeviceId = Number(
      this.configService.get<string>('DEVICE_API_KEY_LEGACY_DEVICE_ID'),
    );

    if (
      !legacyEnabled ||
      !expectedKey ||
      expectedKey.length < 32 ||
      !Number.isSafeInteger(configuredDeviceId) ||
      configuredDeviceId < 1 ||
      !safeEqual(providedKey, expectedKey)
    ) {
      throw new UnauthorizedException('Credencial do dispositivo inválida.');
    }

    try {
      const device = await this.prisma.dispositivo.findUnique({
        where: { id: configuredDeviceId },
        select: { id: true, codigo: true, status: true },
      });

      if (!device || device.status !== 'ativo') {
        throw new UnauthorizedException(
          'Credencial do dispositivo inválida.',
        );
      }

      request.authenticatedDevice = {
        id: device.id,
        codigo: device.codigo,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'Autenticação do dispositivo temporariamente indisponível.',
      );
    }
  }
}

function safeEqual(provided: string, expected: string) {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}
