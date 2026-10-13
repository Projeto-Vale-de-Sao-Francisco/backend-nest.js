import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLoteDto } from './dto/create-lote.dto.js';
import { ListLotesDto } from './dto/list-lotes.dto.js';
import { UpdateLoteDto } from './dto/update-lote.dto.js';

const loteInclude = {
  propriedade: true,
  culturas: {
    orderBy: { id: 'desc' as const },
    include: {
      cultura: true,
      colheitas: { orderBy: { id: 'desc' as const } },
    },
  },
  dispositivos: true,
} satisfies Prisma.TalhaoInclude;

type Tx = Prisma.TransactionClient;

@Injectable()
export class LotesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLoteDto) {
    this.validarDatas(dto.data_plantio, dto.previsao_colheita);
    return this.prisma.$transaction(async (tx) => {
      await this.validarReferencias(tx, dto.propriedade_id, dto.cultura_id);
      await this.garantirNomeDisponivel(tx, dto.propriedade_id, dto.nome);

      const lote = await tx.talhao.create({
        data: {
          propriedade_id: dto.propriedade_id,
          nome: dto.nome.trim(),
          area: dto.area,
          ...(dto.poligono !== undefined ? { poligono: dto.poligono } : {}),
          status: dto.situacao,
        },
      });
      const plantio = await tx.talhao_Cultura.create({
        data: {
          talhao_id: lote.id,
          cultura_id: dto.cultura_id,
          data_plantio: new Date(dto.data_plantio),
          status: dto.situacao,
        },
      });
      if (dto.previsao_colheita)
        await tx.colheita.create({
          data: {
            talhao_cultura_id: plantio.id,
            data_prevista: new Date(dto.previsao_colheita),
            status: 'PLANEJADA',
          },
        });
      return tx.talhao.findUnique({
        where: { id: lote.id },
        include: loteInclude,
      });
    });
  }

  findAll(dto: ListLotesDto) {
    return this.prisma.talhao.findMany({
      where: dto.propriedade_id
        ? { propriedade_id: dto.propriedade_id }
        : undefined,
      include: loteInclude,
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(id: number) {
    const lote = await this.prisma.talhao.findUnique({
      where: { id },
      include: loteInclude,
    });
    if (!lote) throw new NotFoundException('Lote não encontrado');
    return lote;
  }

  update(id: number, dto: UpdateLoteDto) {
    return this.prisma.$transaction(async (tx) => {
      const lote = await tx.talhao.findUnique({
        where: { id },
        include: loteInclude,
      });
      if (!lote) throw new NotFoundException('Lote não encontrado');
      const plantio =
        lote.culturas.find((item) => item.status.toLowerCase() === 'ativo') ??
        lote.culturas[0];
      if (!plantio)
        throw new ConflictException('Lote não possui plantio vinculado');

      if (dto.cultura_id !== undefined && dto.cultura_id !== plantio.cultura_id)
        throw new BadRequestException(
          'A cultura de um plantio existente não pode ser substituída; crie um novo ciclo de plantio',
        );
      if (
        dto.data_plantio !== undefined &&
        new Date(dto.data_plantio).getTime() !== plantio.data_plantio.getTime()
      )
        throw new BadRequestException(
          'A data de um plantio existente não pode ser substituída',
        );

      const propriedadeId = dto.propriedade_id ?? lote.propriedade_id;
      const nome = dto.nome?.trim() ?? lote.nome;
      await this.validarPropriedade(tx, propriedadeId);
      await this.garantirNomeDisponivel(tx, propriedadeId, nome, id);
      this.validarDatas(
        plantio.data_plantio.toISOString(),
        dto.previsao_colheita,
      );

      await tx.talhao.update({
        where: { id },
        data: {
          ...(dto.nome !== undefined ? { nome } : {}),
          ...(dto.propriedade_id !== undefined
            ? { propriedade_id: propriedadeId }
            : {}),
          ...(dto.area !== undefined ? { area: dto.area } : {}),
          ...(dto.poligono !== undefined ? { poligono: dto.poligono } : {}),
          ...(dto.situacao !== undefined ? { status: dto.situacao } : {}),
        },
      });
      if (dto.situacao !== undefined)
        await tx.talhao_Cultura.update({
          where: { id: plantio.id },
          data: { status: dto.situacao },
        });

      if (dto.previsao_colheita !== undefined) {
        const aberta = plantio.colheitas.find(
          (colheita) => colheita.data_realizada === null,
        );
        if (aberta)
          await tx.colheita.update({
            where: { id: aberta.id },
            data: { data_prevista: new Date(dto.previsao_colheita) },
          });
        else
          await tx.colheita.create({
            data: {
              talhao_cultura_id: plantio.id,
              data_prevista: new Date(dto.previsao_colheita),
              status: 'PLANEJADA',
            },
          });
      }
      return tx.talhao.findUnique({ where: { id }, include: loteInclude });
    });
  }

  private async validarReferencias(
    tx: Tx,
    propriedadeId: number,
    culturaId: number,
  ) {
    const [propriedade, cultura] = await Promise.all([
      tx.propriedade.findUnique({ where: { id: propriedadeId } }),
      tx.cultura.findUnique({ where: { id: culturaId }, select: { id: true } }),
    ]);
    if (!propriedade) throw new NotFoundException('Propriedade não encontrada');
    if (!cultura) throw new NotFoundException('Cultura não encontrada');
  }

  private async validarPropriedade(tx: Tx, id: number) {
    const propriedade = await tx.propriedade.findUnique({ where: { id } });
    if (!propriedade) throw new NotFoundException('Propriedade não encontrada');
    return propriedade;
  }

  private async garantirNomeDisponivel(
    tx: Tx,
    propriedadeId: number,
    nome: string,
    ignorarId?: number,
  ) {
    const existente = await tx.talhao.findFirst({
      where: {
        propriedade_id: propriedadeId,
        nome: { equals: nome.trim(), mode: 'insensitive' },
        ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
      },
      select: { id: true },
    });
    if (existente)
      throw new ConflictException(
        'Já existe um lote com este nome na propriedade',
      );
  }

  private validarDatas(dataPlantio: string, previsao?: string) {
    if (previsao && new Date(previsao) < new Date(dataPlantio))
      throw new BadRequestException(
        'previsao_colheita deve ser posterior ou igual a data_plantio',
      );
  }
}
