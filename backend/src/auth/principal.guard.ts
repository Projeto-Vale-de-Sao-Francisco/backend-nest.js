import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from './auth.types.js';
import { AuthzService } from './authz.service.js';

@Injectable()
export class PrincipalGuard implements CanActivate {
  constructor(private readonly authz: AuthzService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;

    if (
      typeof userId !== 'number' ||
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      throw new UnauthorizedException('Autenticação obrigatória.');
    }

    await this.authz.assertActiveUser(userId);
    return true;
  }
}
