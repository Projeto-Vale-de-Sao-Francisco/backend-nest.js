import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDispositivoDto } from './dto/create-dispositivo.dto.js';

@Injectable()
export class DispositivosService {
  constructor(private prisma: PrismaService) {}

  async create(createDispositivoDto: CreateDispositivoDto) {
    const talhao = await this.prisma.talhao.findUnique({
      where: { id: createDispositivoDto.talhao_id },
    });

    if (!talhao) {
      throw new NotFoundException(`Talhão com ID ${createDispositivoDto.talhao_id} não encontrado.`);
    }

    const existing = await this.prisma.dispositivo.findUnique({
      where: { codigo: createDispositivoDto.codigo },
    });

    if (existing) {
      throw new ConflictException(`Já existe um dispositivo com o código ${createDispositivoDto.codigo}.`);
    }

    return this.prisma.dispositivo.create({
      data: {
        talhao_id: createDispositivoDto.talhao_id,
        codigo: createDispositivoDto.codigo,
        modelo: createDispositivoDto.modelo,
        status: createDispositivoDto.status,
        data_instalacao: createDispositivoDto.data_instalacao ? new Date(createDispositivoDto.data_instalacao) : undefined,
      },
    });
  }

  findAll() {
    return this.prisma.dispositivo.findMany();
  }

  async findOne(id: number) {
    const dispositivo = await this.prisma.dispositivo.findUnique({
      where: { id },
      include: { sensores: true },
    });

    if (!dispositivo) {
      throw new NotFoundException(`Dispositivo com ID ${id} não encontrado.`);
    }

    return dispositivo;
  }
}
