import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  createPublic(@Body() dto: CreateUsuarioDto) { return this.usuariosService.createPublic(dto); }

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createByAdmin(@Body() dto: CreateAdminUsuarioDto) { return this.usuariosService.createByAdmin(dto); }

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
  update(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.update(admin.id, id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateStatus(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioStatusDto) {
    return this.usuariosService.updateStatus(admin.id, id, dto.status);
  }
}
