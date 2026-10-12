import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CulturasService } from './culturas.service.js';
import { CreateCulturaDto } from './dto/create-cultura.dto.js';
import { UpdateCulturaDto } from './dto/update-cultura.dto.js';

@Controller('culturas')
@UseGuards(JwtAuthGuard)
export class CulturasController {
  constructor(private readonly culturas: CulturasService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateCulturaDto) {
    return this.culturas.create(dto);
  }

  @Get()
  findAll() {
    return this.culturas.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.culturas.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCulturaDto) {
    return this.culturas.update(id, dto);
  }
}
