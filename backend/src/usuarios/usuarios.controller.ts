import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateAdminUsuarioDto } from './dto/create-admin-usuario.dto.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { ListUsuariosDto } from './dto/list-usuarios.dto.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import { UpdateUsuarioStatusDto } from './dto/update-usuario-status.dto.js';
import { UsuariosService } from './usuarios.service.js';

@Controller('users')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  createPublic(@Body() dto: CreateUsuarioDto, @Req() request: Request) {
    return this.usuariosService.createPublic(dto, request.ip);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createByAdmin(
    @Body() dto: CreateAdminUsuarioDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.usuariosService.createByAdmin(dto, admin.id, request.ip);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findAll(@Query() filters: ListUsuariosDto) { return this.usuariosService.findAll(filters); }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.usuariosService.findOne(id); }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto, @Req() request: Request) {
    return this.usuariosService.update(admin.id, id, dto, request.ip);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateStatus(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioStatusDto, @Req() request: Request) {
    return this.usuariosService.updateStatus(admin.id, id, dto.status, request.ip);
  }
}
