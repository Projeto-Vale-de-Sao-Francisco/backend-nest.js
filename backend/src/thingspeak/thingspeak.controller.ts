import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ThingspeakService } from './thingspeak.service.js';

@Controller('thingspeak')
export class ThingspeakController {
  constructor(private readonly thingspeakService: ThingspeakService) {}

  @Get('enviar')
  enviarDados(
    @Query('temperatura') temperatura: string,
    @Query('umidade') umidade: string,
  ) {
    return this.thingspeakService.enviarDados(
      Number(temperatura),
      Number(umidade),
    );
  }

  @Get('dados')
  buscarDados() {
    return this.thingspeakService.buscarDados();
  }

  @Get('dispositivos')
  listarDispositivos() {
    return this.thingspeakService.listarDispositivos();
  }

  @Get('salvar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  salvarUltimaMedicao() {
    return this.thingspeakService.salvarUltimaMedicao();
  }
}
