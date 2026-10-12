import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateLogisticaDto } from './dto/create-logistica.dto.js';
import { UpdateLogisticaDto } from './dto/update-logistica.dto.js';
import {
  ListLogisticaDto,
  ResumoLogisticaDto,
} from './dto/list-logistica.dto.js';
import { LogisticaService } from './logistica.service.js';

@Controller('logistica')
@UseGuards(JwtAuthGuard)
export class LogisticaController {
  constructor(private readonly logistica: LogisticaService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateLogisticaDto) {
    return this.logistica.create(dto);
  }

  @Get()
  findAll(@Query() dto: ListLogisticaDto) {
    return this.logistica.findAll(dto);
  }

  @Get('resumo')
  resumo(@Query() dto: ResumoLogisticaDto) {
    return this.logistica.resumo(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.logistica.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLogisticaDto,
  ) {
    return this.logistica.update(id, dto);
  }
}
