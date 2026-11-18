import type { PrismaService } from '../prisma/prisma.service.js';

export interface PropertyActor {
  id: number;
  tipo: 'ADMIN' | 'COMUM';
}

export async function authorizedPropertyIds(
  prisma: PrismaService,
  actor: PropertyActor,
): Promise<number[] | null> {
  if (actor.tipo === 'ADMIN') {
    return null;
  }

  const links = await prisma.usuario_Propriedade.findMany({
    where: { usuario_id: actor.id },
    select: { propriedade_id: true, status: true },
  });

  return links
    .filter((link) => link.status.trim().toLowerCase() === 'ativo')
    .map((link) => link.propriedade_id);
}
