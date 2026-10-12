import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateLoteDto } from './dto/create-lote.dto.js';
import { ListLotesDto } from './dto/list-lotes.dto.js';
import { UpdateLoteDto } from './dto/update-lote.dto.js';
import { LotesService } from './lotes.service.js';

@Controller('lotes')
@UseGuards(JwtAuthGuard)
export class LotesController {
  constructor(private readonly lotes: LotesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateLoteDto) {
    return this.lotes.create(dto);
  }

  @Get()
  findAll(@Query() dto: ListLotesDto) {
    return this.lotes.findAll(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lotes.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLoteDto) {
    return this.lotes.update(id, dto);
  }
}
