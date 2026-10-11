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
import { PropertiesService } from './properties.service.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';

@Controller(['propriedades', 'properties'])
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  create(@Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
    @Query('municipality') municipality?: string,
    @Query('state') state?: string,
    @Query('status') status?: string,
  ) {
    return this.propertiesService.findAll({
      search,
      companyId: companyId ? Number(companyId) : undefined,
      municipality,
      state,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string },
  ) {
    return this.propertiesService.updateStatus(id, body.status);
  }

  @Get(':id/usuarios')
  @Get(':id/associacoes')
  listUsers(@Param('id', ParseIntPipe) id: number) {
    return this.propertiesService.listUsers(id);
  }

  @Post(':id/usuarios')
  @Post(':id/associacoes')
  linkUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Record<string, any>,
  ) {
    return this.propertiesService.linkUser(id, dto);
  }
}
