import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSensorDto } from './dto/create-sensor.dto.js';

@Injectable()
export class SensoresService {
  constructor(private prisma: PrismaService) {}

  async create(createSensorDto: CreateSensorDto) {
    const dispositivo = await this.prisma.dispositivo.findUnique({
      where: { id: createSensorDto.dispositivo_id },
    });

    if (!dispositivo) {
      throw new NotFoundException(`Dispositivo com ID ${createSensorDto.dispositivo_id} não encontrado.`);
    }

    return this.prisma.sensor.create({
      data: {
        dispositivo_id: createSensorDto.dispositivo_id,
        tipo: createSensorDto.tipo,
        unidade_medida: createSensorDto.unidade_medida,
        status: createSensorDto.status,
      },
    });
  }

  findAll() {
    return this.prisma.sensor.findMany();
  }

  async findOne(id: number) {
    const sensor = await this.prisma.sensor.findUnique({
      where: { id },
    });

    if (!sensor) {
      throw new NotFoundException(`Sensor com ID ${id} não encontrado.`);
    }

    return sensor;
  }
}
