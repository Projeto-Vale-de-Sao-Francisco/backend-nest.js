import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { TipoUsuario } from '../generated/prisma/enums.js';
import { ExecutePipelineDto } from './dto/execute-pipeline.dto.js';
import { PipelineService } from './pipeline.service.js';

@Controller('pipeline')
@UseGuards(JwtAuthGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post('executar')
  @UseGuards(RolesGuard)
  @Roles(TipoUsuario.ADMIN)
  executar(
    @Body() dto: ExecutePipelineDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.pipelineService.execute(dto, user.id, request.ip);
  }

  @Get('execucoes')
  @UseGuards(RolesGuard)
  @Roles(TipoUsuario.ADMIN)
  historico(@Query('source') source?: string) {
    return this.pipelineService.getHistory(source);
  }

  @Get('execucoes/:id')
  @UseGuards(RolesGuard)
  @Roles(TipoUsuario.ADMIN)
  execucao(@Param('id', ParseIntPipe) id: number) {
    return this.pipelineService.getExecution(id);
  }

  @Get('execucoes/:id/relatorio')
  @UseGuards(RolesGuard)
  @Roles(TipoUsuario.ADMIN)
  relatorio(@Param('id', ParseIntPipe) id: number) {
    return this.pipelineService.getExecutionReport(id);
  }
}
