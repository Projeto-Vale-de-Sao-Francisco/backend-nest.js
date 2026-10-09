import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expectedKey =
      this.configService.get<string>('DEVICE_API_KEY') ||
      process.env.DEVICE_API_KEY ||
      'iot-simulator-secret-2026';

    const providedKey =
      request.headers['x-api-key'] ||
      request.headers['x-device-token'] ||
      request.query?.apiKey;

    if (!providedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException(
        'Chave ou token de autenticação do dispositivo/simulador inválido.',
      );
    }

    return true;
  }
}
