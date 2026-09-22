import { Controller, Get, Query } from '@nestjs/common';
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
salvarUltimaMedicao() {
  return this.thingspeakService.salvarUltimaMedicao();
}

}