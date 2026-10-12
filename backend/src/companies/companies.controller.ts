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
import { CompaniesService } from './companies.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@Controller(['empresas', 'companies', 'produtores', 'producers'])
@UseGuards(PrincipalGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(request.user!.id, dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.companiesService.findAll(
      request!.user!.id,
      { search, type, city, state, status },
      { page, limit },
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.companiesService.findOne(request.user!.id, id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.companiesService.update(request.user!.id, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.companiesService.updateStatus(
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
    return this.companiesService.listUsers(request.user!.id, id);
  }

  @Get(':id/associacoes')
  listAssociations(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.companiesService.listUsers(request.user!.id, id);
  }

  @Get(':id/usuarios/disponiveis')
  listAvailableUsers(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.companiesService.listAvailableUsers(request.user!.id, id);
  }

  @Post(':id/usuarios')
  linkUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.companiesService.linkUser(request.user!.id, id, dto);
  }

  @Post(':id/associacoes')
  linkAssociation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.companiesService.linkUser(request.user!.id, id, dto);
  }

  @Delete(':id/usuarios/:userId')
  unlinkUser(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.companiesService.unlinkUser(request.user!.id, id, userId);
  }
}
