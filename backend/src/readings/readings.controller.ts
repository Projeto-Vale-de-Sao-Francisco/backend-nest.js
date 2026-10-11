import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ReadingsService } from './readings.service.js';
import { CreateReadingDto } from './dto/create-reading.dto.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';

@Controller('readings')
export class ReadingsController {
  constructor(private readonly readingsService: ReadingsService) {}

  /**
   * Requisito 6.1, 6.2, 6.6, 6.7: Registra leitura enviada pelo simulador ou sensor IoT.
   * Autenticado com x-api-key ou x-device-token (6.6).
   */
  @Post()
  @UseGuards(ApiKeyGuard)
  create(@Body() dto: CreateReadingDto) {
    return this.readingsService.create(dto);
  }

  /**
   * Requisito 6.5: Consultar sensores com a última leitura registrada.
   */
  @Get('latest')
  findLatest() {
    return this.readingsService.findLatestReadings();
  }

  /**
   * Requisito 6.3: Endpoint para consulta e histórico de leituras.
   */
  @Get()
  findAll(
    @Query('sensorId') sensorId?: string,
    @Query('talhaoId') talhaoId?: string,
    @Query('codigoDispositivo') codigoDispositivo?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('limit') limit?: string,
  ) {
    return this.readingsService.findAll({
      sensorId: sensorId ? Number(sensorId) : undefined,
      talhaoId: talhaoId ? Number(talhaoId) : undefined,
      codigoDispositivo,
      dataInicio,
      dataFim,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
