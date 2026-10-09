import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { AlertsService } from './alerts.service.js';

@Controller('alerts')
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
  ) {
    return this.alertsService.findAll({
      status,
      visualizado:
        visualizado !== undefined ? visualizado === 'true' : undefined,
      talhaoId: talhaoId ? Number(talhaoId) : undefined,
    });
  }

  /**
   * Requisito 9.3: Destacar alertas ativos no dashboard.
   */
  @Get('active')
  findActive() {
    return this.alertsService.findActive();
  }

  /**
   * Requisito 9.4: Marcar alerta como visto/visualizado.
   */
  @Patch(':id/view')
  markAsViewed(@Param('id', ParseIntPipe) id: number) {
    return this.alertsService.markAsViewed(id);
  }

  /**
   * Requisito 9.4: Marcar alerta como resolvido.
   */
  @Patch(':id/resolve')
  resolve(@Param('id', ParseIntPipe) id: number) {
    return this.alertsService.resolve(id);
  }
}
