import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  if (process.env.SEED_CULTURAS_E4_CONFIRMAR !== 'sim') {
    console.log(
      'Nenhum dado foi acessado. Para criar apenas as culturas iniciais do E4, defina SEED_CULTURAS_E4_CONFIRMAR=sim.',
    );
    return;
  }
  await import('dotenv/config');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const culturas = [
        { rotulo: 'Manga', termos: ['Manga'] },
        { rotulo: 'Uva', termos: ['Uva'] },
        { rotulo: 'Goiaba', termos: ['Goiaba'] },
        { rotulo: 'Melão', termos: ['Melão', 'Melao'] },
      ];
      const linhas: Array<{ cultura: string; situacao: string; id: number }> =
        [];
      for (const item of culturas) {
        const existente = await tx.cultura.findFirst({
          where: {
            OR: item.termos.map((termo) => ({
              nome: { contains: termo, mode: 'insensitive' as const },
            })),
          },
          orderBy: { id: 'asc' },
        });
        const cultura =
          existente ??
          (await tx.cultura.create({ data: { nome: item.rotulo } }));
        linhas.push({
          cultura: item.rotulo,
          situacao: existente ? 'já existia; preservada' : 'criada',
          id: cultura.id,
        });
      }
      return linhas;
    });
    console.table(resultado);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    'Carga inicial E4 não concluída; nenhum erro interno foi exposto.',
  );
  process.exitCode = 1;
});
