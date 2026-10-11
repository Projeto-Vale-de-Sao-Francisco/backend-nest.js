import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@Controller(['empresas', 'companies', 'produtores', 'producers'])
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('status') status?: string,
  ) {
    return this.companiesService.findAll({
      search,
      type,
      city,
      state,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string },
  ) {
    return this.companiesService.updateStatus(id, body.status);
  }

  @Get(':id/usuarios')
  @Get(':id/associacoes')
  listUsers(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.listUsers(id);
  }

  @Post(':id/usuarios')
  @Post(':id/associacoes')
  linkUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Record<string, any>,
  ) {
    return this.companiesService.linkUser(id, dto);
  }
}
