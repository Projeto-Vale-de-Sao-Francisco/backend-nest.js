import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { DispositivosService } from './dispositivos.service.js';
import { CreateDispositivoDto } from './dto/create-dispositivo.dto.js';

@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Post()
  create(@Body() createDispositivoDto: CreateDispositivoDto) {
    return this.dispositivosService.create(createDispositivoDto);
  }

  @Get()
  findAll() {
    return this.dispositivosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.dispositivosService.findOne(id);
  }
}

