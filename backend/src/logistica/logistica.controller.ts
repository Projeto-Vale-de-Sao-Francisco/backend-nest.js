import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
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
  create(
    @Body() dto: CreateLogisticaDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.logistica.create(dto, usuario.id, request.ip);
  }

  @Get()
  findAll(
    @Query() dto: ListLogisticaDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.logistica.findAll(dto, usuario);
  }

  @Get('resumo')
  resumo(
    @Query() dto: ResumoLogisticaDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.logistica.resumo(dto, usuario);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.logistica.findOne(id, usuario);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLogisticaDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.logistica.update(id, dto, usuario.id, request.ip);
  }
}
