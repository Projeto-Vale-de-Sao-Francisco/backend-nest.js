import {
  BadRequestException,
  ValidationPipe,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { DeviceAuthenticatedRequest } from './guards/api-key.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  optionalPositiveInt,
  optionalDate,
  optionalText,
} from '../common/query-validation.js';
import { ReadingsService } from './readings.service.js';
import { CreateReadingDto } from './dto/create-reading.dto.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';

@Controller('readings')
export class ReadingsController {
  constructor(private readonly readingsService: ReadingsService) {}

  /**
   * Requisito 6.1, 6.2, 6.6, 6.7: Registra leitura enviada pelo simulador ou sensor IoT.
   * Autenticado com credencial individual x-device-token; o modo legado usa x-api-key.
   */
  @Post()
  @UseGuards(ApiKeyGuard)
  create(
    @Body(
      new ValidationPipe({
        expectedType: CreateReadingDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: CreateReadingDto,
    @Req() request: DeviceAuthenticatedRequest,
  ) {
    const device = request.authenticatedDevice;
    if (!device) {
      throw new UnauthorizedException('Credencial do dispositivo inválida.');
    }
    return this.readingsService.create(dto, device.id, request.ip);
  }

  /**
   * Requisito 6.5: Consultar sensores com a última leitura registrada.
   */
  @Get('latest')
  @UseGuards(JwtAuthGuard)
  findLatest(@CurrentUser() usuario: AuthenticatedUser) {
    return this.readingsService.findLatestReadings(usuario);
  }

  /**
   * Requisito 6.3: Endpoint para consulta e histórico de leituras.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('sensorId') sensorId?: string,
    @Query('talhaoId') talhaoId?: string,
    @Query('codigoDispositivo') codigoDispositivo?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('limit') limit?: string,
    @CurrentUser() usuario?: AuthenticatedUser,
  ) {
    const inicio = optionalDate(dataInicio, 'dataInicio');
    const fim = optionalDate(dataFim, 'dataFim');
    if (inicio && fim && Date.parse(inicio) > Date.parse(fim)) {
      throw new BadRequestException(
        'dataInicio deve ser anterior ou igual a dataFim.',
      );
    }
    return this.readingsService.findAll({
      sensorId: optionalPositiveInt(sensorId, 'sensorId'),
      talhaoId: optionalPositiveInt(talhaoId, 'talhaoId'),
      codigoDispositivo: optionalText(codigoDispositivo, 'codigoDispositivo'),
      dataInicio: inicio,
      dataFim: fim,
      limit: optionalPositiveInt(limit, 'limit'),
    }, usuario);
  }
}
