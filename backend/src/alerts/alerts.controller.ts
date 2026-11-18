import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  optionalPositiveInt,
  optionalBoolean,
  optionalStatus,
} from '../common/query-validation.js';
import { AlertsService } from './alerts.service.js';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  /**
   * Requisito 9.2: Listar alertas com mensagem legível e filtros opcionais.
   */
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('visualizado') visualizado?: string,
    @Query('talhaoId') talhaoId?: string,
    @CurrentUser() usuario?: AuthenticatedUser,
  ) {
    return this.alertsService.findAll({
      status: optionalStatus(status, ['ativo', 'resolvido']),
      visualizado: optionalBoolean(visualizado, 'visualizado'),
      talhaoId: optionalPositiveInt(talhaoId, 'talhaoId'),
    }, usuario);
  }

  /**
   * Requisito 9.3: Destacar alertas ativos no dashboard.
   */
  @Get('active')
  findActive(@CurrentUser() usuario: AuthenticatedUser) {
    return this.alertsService.findActive(usuario);
  }

  /**
   * Requisito 9.4: Marcar alerta como visto/visualizado.
   */
  @Patch(':id/view')
  markAsViewed(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.alertsService.markAsViewed(id, usuario, request.ip);
  }

  /**
   * Requisito 9.4: Marcar alerta como resolvido.
   */
  @Patch(':id/resolve')
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.alertsService.resolve(id, usuario, request.ip);
  }
}
