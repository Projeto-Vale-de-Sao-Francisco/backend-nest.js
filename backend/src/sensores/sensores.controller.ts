import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { SensoresService } from './sensores.service.js';
import { CreateSensorDto } from './dto/create-sensor.dto.js';

@Controller('sensores')
export class SensoresController {
  constructor(private readonly sensoresService: SensoresService) {}

  @Post()
  create(@Body() createSensorDto: CreateSensorDto) {
    return this.sensoresService.create(createSensorDto);
  }

  @Get()
  findAll() {
    return this.sensoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sensoresService.findOne(id);
  }
}

