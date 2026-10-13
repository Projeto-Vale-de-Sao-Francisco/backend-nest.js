import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SO_ADMIN, Roles, Usuario, type UsuarioLogado } from '../common/decorators.js';
import { AtualizarPropriedadeDto, CriarPropriedadeDto, VincularUsuarioDto } from './propriedades.dto.js';
import { PropriedadesService } from './propriedades.service.js';

@ApiTags('propriedades')
@ApiBearerAuth()
@Controller('propriedades')
export class PropriedadesController {
  constructor(private readonly service: PropriedadesService) {}

  @Get()
  listar(@Usuario() u: UsuarioLogado) {
    return this.service.listar(u);
  }

  @Get(':id')
  buscar(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number) {
    return this.service.buscar(u, id);
  }

  @Roles(...SO_ADMIN)
  @Post()
  criar(@Usuario() u: UsuarioLogado, @Body() dto: CriarPropriedadeDto) {
    return this.service.criar(u, dto);
  }

  @Roles(...SO_ADMIN)
  @Patch(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarPropriedadeDto) {
    return this.service.atualizar(u, id, dto);
  }

  @Roles(...SO_ADMIN)
  @Post(':id/usuarios')
  vincular(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number, @Body() dto: VincularUsuarioDto) {
    return this.service.vincular(u, id, dto.usuarioId);
  }

  @Roles(...SO_ADMIN)
  @HttpCode(200)
  @Delete(':id/usuarios/:usuarioId')
  desvincular(
    @Usuario() u: UsuarioLogado,
    @Param('id', ParseIntPipe) id: number,
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
  ) {
    return this.service.desvincular(u, id, usuarioId);
  }
}
