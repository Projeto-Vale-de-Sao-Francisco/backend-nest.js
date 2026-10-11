import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Populando dados iniciais para testes (seed)...');

  // 1. Empresa
  const empresa = await prisma.empresa.upsert({
    where: { cpf_cnpj: '12.345.678/0001-90' },
    update: {},
    create: {
      razao_social: 'Agro Vale do São Francisco S.A.',
      nome_fantasia: 'Vale Vivo Agro',
      cpf_cnpj: '12.345.678/0001-90',
      tipo: 'Produtor',
      status: 'ativo',
    },
  });

  // 2. Propriedade
  let propriedade = await prisma.propriedade.findFirst({
    where: { empresa_id: empresa.id },
  });

  if (!propriedade) {
    propriedade = await prisma.propriedade.create({
      data: {
        empresa_id: empresa.id,
        nome: 'Fazenda Vale do Sol',
        municipio: 'Petrolina',
        estado: 'PE',
        area_total: 120.5,
        status: 'ativo',
      },
    });
  }

  // 3. Talhão
  let talhao = await prisma.talhao.findFirst({
    where: { propriedade_id: propriedade.id },
  });

  if (!talhao) {
    talhao = await prisma.talhao.create({
      data: {
        propriedade_id: propriedade.id,
        nome: 'Talhão 01 - Lote de Uvas',
        area: 15.0,
        latitude: -9.3891,
        longitude: -40.5027,
        status: 'ativo',
      },
    });
  }

  // 4. Cultura com limites climáticos para disparar alertas (Requisito 9.1)
  let cultura = await prisma.cultura.findFirst({
    where: { nome: 'Uva Vitória' },
  });

  if (!cultura) {
    cultura = await prisma.cultura.create({
      data: {
        nome: 'Uva Vitória',
        variedade: 'Sem semente',
        temperatura_min: 18.0,
        temperatura_max: 32.0, // Acima de 32°C dispara alerta climático!
        umidade_min: 40.0,
        umidade_max: 80.0,
        ciclo_medio_dias: 110,
        descricao: 'Uva de mesa cultivada no Vale do São Francisco',
      },
    });
  }

  // 5. Vínculo Talhão + Cultura
  let talhaoCultura = await prisma.talhao_Cultura.findFirst({
    where: { talhao_id: talhao.id, cultura_id: cultura.id },
  });

  if (!talhaoCultura) {
    talhaoCultura = await prisma.talhao_Cultura.create({
      data: {
        talhao_id: talhao.id,
        cultura_id: cultura.id,
        data_plantio: new Date(),
        status: 'ativo',
      },
    });
  }

  // 6. Dispositivos e Sensores simulados
  const dispositivosParaCriar = [
    { codigo: 'ESP32-TALHAO-01', modelo: 'ESP32-DHT22' },
    { codigo: 'SEN-TH-02', modelo: 'SEN-TH-02' },
  ];

  for (const item of dispositivosParaCriar) {
    let disp = await prisma.dispositivo.findUnique({
      where: { codigo: item.codigo },
      include: { sensores: true },
    });

    if (!disp) {
      disp = await prisma.dispositivo.create({
        data: {
          codigo: item.codigo,
          modelo: item.modelo,
          status: 'ativo',
          data_instalacao: new Date(),
          talhao_id: talhao.id,
          sensores: {
            create: {
              tipo: 'temperatura_umidade',
              unidade_medida: '°C, %',
              status: 'ativo',
            },
          },
        },
        include: { sensores: true },
      });
      console.log(`Dispositivo criado: ${disp.codigo}`);
    }
  }

  console.log('Seed executado com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });