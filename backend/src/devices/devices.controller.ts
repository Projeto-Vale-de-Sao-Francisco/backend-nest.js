import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { UpdateDeviceStatusDto } from './dto/update-device-status.dto.js';
import { DevicesService } from './devices.service.js';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /**
   * Cadastro de novo dispositivo/sensor.
   */
  @Post()
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto);
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
  ) {
    const selectedTalhao = talhaoId ?? lote;
    return this.devicesService.findAll({
      propriedadeId: propriedadeId ? Number(propriedadeId) : undefined,
      talhaoId: selectedTalhao ? Number(selectedTalhao) : undefined,
      status,
    });
  }

  /**
   * Busca um dispositivo por ID.
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.findOne(id);
  }

  /**
   * Ativa ou inativa um dispositivo.
   */
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeviceStatusDto,
  ) {
    return this.devicesService.updateStatus(id, dto.status);
  }
}
