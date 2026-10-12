import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthzService } from './authz.service.js';
import { PrincipalGuard } from './principal.guard.js';

@Module({
  imports: [PrismaModule],
  providers: [AuthzService, PrincipalGuard],
  exports: [AuthzService, PrincipalGuard],
})
export class AuthzModule {}
