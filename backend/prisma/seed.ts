// import { PrismaClient } from '../src/generated/prisma/client.js';
// import { PrismaPg } from '@prisma/adapter-pg';

// const adapter = new PrismaPg({
//   connectionString: process.env.DATABASE_URL as string,
// });

// const prisma = new PrismaClient({ adapter });

// async function main() {
//   const propriedade = await prisma.propriedade.create({
//     data: {
//       nome: 'Propriedade POC VSF',
//       localizacao: 'Vale do São Francisco',
//       status: 'ATIVO',
//     },
//   });

//   const talhao = await prisma.talhao.create({
//     data: {
//       nome: 'Talhão POC 01',
//       descricao: 'Talhão utilizado para teste da integração IoT',
//       propriedadeId: propriedade.id,
//       status: 'ATIVO',
//       dataCadastro: new Date(),
//     },
//   });

//   const dispositivo = await prisma.dispositivo.create({
//     data: {
//       nome: 'ESP32 - POC ThingSpeak',
//       status: 'ATIVO',
//       tipo: 'ESP32',
//       talhaoId: talhao.id,
//     },
//   });

//   console.log('Propriedade criada:', propriedade.id);
//   console.log('Talhão criado:', talhao.id);
//   console.log('Dispositivo criado:', dispositivo.id);
// }

// main()
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });