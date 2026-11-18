import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ThingspeakService } from './thingspeak.service.js';
import { CreateThingSpeakDto } from './dto/create-thingspeak.dto.js';

@Controller('thingspeak')
@UseGuards(JwtAuthGuard)
export class ThingspeakController {
  constructor(private readonly thingspeakService: ThingspeakService) {}

  @Post('enviar')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  enviarDados(
    @Body() dto: CreateThingSpeakDto,
    @CurrentUser() usuario: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.thingspeakService.enviarDados(
      dto.temperatura,
      dto.umidade,
      usuario.id,
      request.ip,
    );
  }

  @Get('dados')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  buscarDados() {
    return this.thingspeakService.buscarDados();
  }

  @Get('dispositivos')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  listarDispositivos() {
    return this.thingspeakService.listarDispositivos();
  }

  @Post('salvar')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  salvarUltimaMedicao(
    @CurrentUser() usuario: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.thingspeakService.salvarUltimaMedicao(usuario.id, request.ip);
  }
}
