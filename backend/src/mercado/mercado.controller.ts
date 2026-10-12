import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { TipoUsuario } from '../generated/prisma/enums.js';
import { AtualizarMercadoDto } from './dto/atualizar-mercado.dto.js';
import { CotacaoMercadoDto } from './dto/cotacao-mercado.dto.js';
import { CreateValorMercadoDto } from './dto/create-valor-mercado.dto.js';
import { ListValorMercadoDto } from './dto/list-valor-mercado.dto.js';
import { MercadoService } from './mercado.service.js';
import { UpdateValorMercadoDto } from './dto/update-valor-mercado.dto.js';
import { ResumoMercadoDto } from './dto/resumo-mercado.dto.js';

@Controller('mercado')
@UseGuards(JwtAuthGuard)
export class MercadoController {
  constructor(private readonly mercado: MercadoService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(TipoUsuario.ADMIN)
  create(@Body() dto: CreateValorMercadoDto) {
    return this.mercado.create(dto);
  }

  @Post('atualizar')
  @HttpCode(200)
  async atualizar(
    @Body() dto: AtualizarMercadoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    if (dto.forcar && usuario.tipo !== TipoUsuario.ADMIN)
      throw new ForbiddenException(
        'Somente administradores podem forçar atualização',
      );
    return this.mercado.atualizar(dto);
  }

  @Get('cotacao')
  cotacao(@Query() dto: CotacaoMercadoDto) {
    return this.mercado.cotacao(dto);
  }

  @Get('fontes')
  fontes() {
    return this.mercado.fontesAtivas();
  }

  @Get()
  findAll(@Query() dto: ListValorMercadoDto) {
    return this.mercado.findAll(dto);
  }

  @Get('resumo')
  resumo(@Query() dto: ResumoMercadoDto) {
    return this.mercado.resumo(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(TipoUsuario.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateValorMercadoDto,
  ) {
    return this.mercado.update(id, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mercado.findOne(id);
  }
}
