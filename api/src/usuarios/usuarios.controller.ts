import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, SO_ADMIN, Usuario, type UsuarioLogado } from '../common/decorators.js';
import { AtualizarUsuarioDto, CriarUsuarioDto, VincularEmpresaDto, VincularPropriedadeDto } from './usuarios.dto.js';
import { UsuariosService } from './usuarios.service.js';

@ApiTags('usuarios')
@ApiBearerAuth()
@Roles(...SO_ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Get() listar() { return this.service.listar(); }

  @Post() criar(@Body() dto: CriarUsuarioDto) { return this.service.criar(dto); }

  @Patch(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarUsuarioDto) {
    return this.service.atualizar(u, id, dto);
  }

  @Post(':id/empresas')
  vincularEmpresa(@Param('id', ParseIntPipe) id: number, @Body() dto: VincularEmpresaDto) { return this.service.vincularEmpresa(id, dto.empresaId); }

  @HttpCode(200) @Delete(':id/empresas/:empresaId')
  desvincularEmpresa(@Param('id', ParseIntPipe) id: number, @Param('empresaId', ParseIntPipe) empresaId: number) { return this.service.desvincularEmpresa(id, empresaId); }

  @Post(':id/propriedades')
  vincularPropriedade(@Param('id', ParseIntPipe) id: number, @Body() dto: VincularPropriedadeDto) { return this.service.vincularPropriedade(id, dto.propriedadeId); }

  @HttpCode(200) @Delete(':id/propriedades/:propriedadeId')
  desvincularPropriedade(@Param('id', ParseIntPipe) id: number, @Param('propriedadeId', ParseIntPipe) propriedadeId: number) { return this.service.desvincularPropriedade(id, propriedadeId); }
}
