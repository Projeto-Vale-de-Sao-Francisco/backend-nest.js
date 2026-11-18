import {
  ValidationPipe,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { UpdateDeviceStatusDto } from './dto/update-device-status.dto.js';
import {
  optionalPositiveInt,
  optionalStatus,
} from '../common/query-validation.js';
import { DevicesService } from './devices.service.js';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /**
   * Cadastro de novo dispositivo/sensor.
   */
  @Post()
  create(
    @Body(
      new ValidationPipe({
        expectedType: CreateDeviceDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: CreateDeviceDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.devicesService.create(dto, usuario, request.ip);
  }

  /**
   * Lista todos os dispositivos com filtros opcionais por propriedade, talhão/lote e status.
   */
  @Get()
  findAll(
    @Query('propriedadeId') propriedadeId?: string,
    @Query('talhaoId') talhaoId?: string,
    @Query('lote') lote?: string,
    @Query('status') status?: string,
    @CurrentUser() usuario?: AuthenticatedUser,
  ) {
    const selectedTalhao = talhaoId ?? lote;
    return this.devicesService.findAll({
      propriedadeId: optionalPositiveInt(propriedadeId, 'propriedadeId'),
      talhaoId: optionalPositiveInt(selectedTalhao, 'talhaoId'),
      status: optionalStatus(status, ['ativo', 'inativo']),
    }, usuario);
  }

  /**
   * Busca um dispositivo por ID.
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.devicesService.findOne(id, usuario);
  }

  /**
   * Ativa ou inativa um dispositivo.
   */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body(
      new ValidationPipe({
        expectedType: UpdateDeviceStatusDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: UpdateDeviceStatusDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.devicesService.updateStatus(
      id,
      dto.status,
      usuario.id,
      request.ip,
    );
  }

  @Delete(':id/credential')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  revokeCredential(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.devicesService.revokeCredential(id, usuario.id, request.ip);
  }
}
