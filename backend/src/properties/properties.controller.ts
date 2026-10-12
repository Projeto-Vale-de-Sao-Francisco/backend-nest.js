import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PrincipalGuard } from '../auth/principal.guard.js';
import { PropertiesService } from './properties.service.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';

@Controller(['propriedades', 'properties'])
@UseGuards(PrincipalGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(request.user!.id, dto);
  }

  @Get('por-usuario/:userId')
  findAccessibleByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.propertiesService.findAccessibleByUser(
      request!.user!.id,
      userId,
      { page, limit },
    );
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
    @Query('municipality') municipality?: string,
    @Query('state') state?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.propertiesService.findAll(
      request!.user!.id,
      {
        search,
        companyId: companyId ? Number(companyId) : undefined,
        municipality,
        state,
        status,
      },
      { page, limit },
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.propertiesService.findOne(request.user!.id, id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePropertyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.propertiesService.update(request.user!.id, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.propertiesService.updateStatus(
      request.user!.id,
      id,
      body.status,
    );
  }

  @Get(':id/usuarios')
  listUsers(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.propertiesService.listUsers(request.user!.id, id);
  }

  @Get(':id/associacoes')
  listAssociations(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.propertiesService.listUsers(request.user!.id, id);
  }

  @Get(':id/usuarios/disponiveis')
  listAvailableUsers(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.propertiesService.listAvailableUsers(request.user!.id, id);
  }

  @Post(':id/usuarios')
  linkUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.propertiesService.linkUser(request.user!.id, id, dto);
  }

  @Post(':id/associacoes')
  linkAssociation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.propertiesService.linkUser(request.user!.id, id, dto);
  }

  @Delete(':id/usuarios/:userId')
  unlinkUser(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.propertiesService.unlinkUser(request.user!.id, id, userId);
  }
}
