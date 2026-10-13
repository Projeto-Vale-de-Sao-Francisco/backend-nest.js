import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SO_ADMIN, Roles } from '../common/decorators.js';
import { ThingspeakService } from './thingspeak.service.js';

@ApiTags('thingspeak')
@ApiBearerAuth()
@Roles(...SO_ADMIN)
@Controller('thingspeak')
export class ThingspeakController {
  constructor(private readonly thingspeakService: ThingspeakService) {}

  @Get('enviar')
  enviarDados(@Query('temperatura') temperatura: string, @Query('umidade') umidade: string) {
    return this.thingspeakService.enviarDados(Number(temperatura), Number(umidade));
  }

  @Get('dados')
  buscarDados() {
    return this.thingspeakService.buscarDados();
  }

  @Get('salvar')
  salvarUltimaMedicao(@Query('dispositivo') dispositivo: string) {
    return this.thingspeakService.salvarUltimaMedicao(dispositivo);
  }
}
