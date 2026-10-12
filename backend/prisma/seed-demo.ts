import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const CNPJ_DEMO = '99.999.999/0001-91';
const EMPRESA_DEMO = '[DEMO] Agro E7';

async function main(): Promise<void> {
  // Verificar antes de carregar .env: confirmação deve vir do ambiente do comando.
  if (process.env.SEED_DEMO_CONFIRMAR !== 'sim') {
    console.log(
      'Nenhum dado foi acessado. Para criar os dados de teste, execute no PowerShell: ' +
        '$env:SEED_DEMO_CONFIRMAR="sim"; npm run seed:demo. Não use em produção.',
    );
    return;
  }

  await import('dotenv/config');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error(
      'DATABASE_URL é obrigatória para executar o seed de demonstração.',
    );

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  try {
    const tabela = await prisma.$transaction(
      async (tx) => {
        const linhas: { registro: string; id: number; situacao: string }[] = [];
        async function obterOuCriar<T extends { id: number }>(
          registro: string,
          buscar: () => Promise<T | null>,
          criar: () => Promise<T>,
        ): Promise<T> {
          const existente = await buscar();
          const valor = existente ?? (await criar());
          linhas.push({
            registro,
            id: valor.id,
            situacao: existente ? 'já existia' : 'criado agora',
          });
          return valor;
        }

        const manga = await obterOuCriar(
          'Cultura Manga',
          () =>
            tx.cultura.findFirst({
              where: { nome: 'Manga' },
              orderBy: { id: 'asc' },
            }),
          () => tx.cultura.create({ data: { nome: 'Manga' } }),
        );
        await obterOuCriar(
          'Cultura Uva fresca',
          () =>
            tx.cultura.findFirst({
              where: { nome: 'Uva fresca' },
              orderBy: { id: 'asc' },
            }),
          () => tx.cultura.create({ data: { nome: 'Uva fresca' } }),
        );

        // Documento fictício com dígitos verificadores válidos. Não vincular dados reais.
        const colisao = await tx.empresa.findFirst({
          where: {
            cpf_cnpj: { in: [CNPJ_DEMO, CNPJ_DEMO.replace(/\D/g, '')] },
          },
        });
        if (colisao && colisao.razao_social !== EMPRESA_DEMO) {
          throw new Error(
            'O CNPJ de demonstração já pertence a outra empresa. Operação cancelada sem gravar dados.',
          );
        }
        const empresa = await obterOuCriar(
          'Empresa [DEMO] Agro E7',
          () =>
            tx.empresa.findFirst({
              where: { razao_social: EMPRESA_DEMO },
              orderBy: { id: 'asc' },
            }),
          () =>
            tx.empresa.create({
              data: {
                razao_social: EMPRESA_DEMO,
                nome_fantasia: '[DEMO] Agro E7',
                cpf_cnpj: CNPJ_DEMO,
                tipo: 'Produtor',
                status: 'ativo',
              },
            }),
        );
        const propriedade = await obterOuCriar(
          'Propriedade [DEMO] Fazenda Teste',
          () =>
            tx.propriedade.findFirst({
              where: { empresa_id: empresa.id, nome: '[DEMO] Fazenda Teste' },
              orderBy: { id: 'asc' },
            }),
          () =>
            tx.propriedade.create({
              data: {
                empresa_id: empresa.id,
                nome: '[DEMO] Fazenda Teste',
                municipio: 'Petrolina',
                estado: 'PE',
                area_total: 10,
                latitude: -9.3891,
                longitude: -40.5027,
                status: 'ativo',
              },
            }),
        );
        const talhao = await obterOuCriar(
          'Talhão [DEMO] Talhão 1',
          () =>
            tx.talhao.findFirst({
              where: {
                propriedade_id: propriedade.id,
                nome: '[DEMO] Talhão 1',
              },
              orderBy: { id: 'asc' },
            }),
          () =>
            tx.talhao.create({
              data: {
                propriedade_id: propriedade.id,
                nome: '[DEMO] Talhão 1',
                area: 1.5,
                status: 'ativo',
              },
            }),
        );
        const talhaoCultura = await obterOuCriar(
          'Talhao_Cultura (Talhão 1 → Manga)',
          () =>
            tx.talhao_Cultura.findFirst({
              where: { talhao_id: talhao.id, cultura_id: manga.id },
              orderBy: { id: 'asc' },
            }),
          () =>
            tx.talhao_Cultura.create({
              data: {
                talhao_id: talhao.id,
                cultura_id: manga.id,
                data_plantio: new Date('2026-01-15T00:00:00.000Z'),
                status: 'ativo',
              },
            }),
        );
        await obterOuCriar(
          'Colheita (Manga, prevista 01/11/2026)',
          () =>
            tx.colheita.findFirst({
              where: {
                talhao_cultura_id: talhaoCultura.id,
                data_prevista: new Date('2026-11-01T00:00:00.000Z'),
              },
              orderBy: { id: 'asc' },
            }),
          () =>
            tx.colheita.create({
              data: {
                talhao_cultura_id: talhaoCultura.id,
                data_prevista: new Date('2026-11-01T00:00:00.000Z'),
                quantidade_prevista: 5000,
                unidade_medida: 'kg',
                status: 'PLANEJADA',
              },
            }),
        );
        return linhas;
      },
      { timeout: 30_000 },
    );

    console.log('Dados de demonstração E7 — apenas testes, não produção.');
    console.table(tabela);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    'Seed de demonstração não concluído. Verifique DATABASE_URL, conexão, migrations e possível colisão do CNPJ 99.999.999/0001-91. Nenhum registro existente foi atualizado ou apagado.',
  );
  process.exitCode = 1;
});
