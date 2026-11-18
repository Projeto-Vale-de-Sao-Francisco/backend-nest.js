import { existsSync } from 'node:fs';
import { isIP } from 'node:net';
import { AuditService } from '../src/audit/audit.service.js';
import { DevicesService } from '../src/devices/devices.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

class ProvisioningInputError extends Error {}

if (existsSync('.env')) {
  process.loadEnvFile();
}

function argument(name: string) {
  const prefix = `--${name}=`;
  const value = process.argv
    .slice(2)
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ProvisioningInputError(
      `Informe --${name}=<id> com um inteiro positivo.`,
    );
  }
  return id;
}

function ipOriginArgument() {
  const prefix = '--ip-origem=';
  const ip = process.argv
    .slice(2)
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
  if (!ip || isIP(ip) === 0) {
    throw new ProvisioningInputError(
      'Informe --ip-origem=<ip> com o endereço IP de origem.',
    );
  }
  return ip;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new ProvisioningInputError(
      'DATABASE_URL é obrigatória para provisionar o dispositivo.',
    );
  }

  const deviceId = argument('device-id');
  const adminId = argument('admin-id');
  const ipOrigem = ipOriginArgument();
  const prisma = new PrismaService();

  try {
    await prisma.$connect();
    const admin = await prisma.usuario.findUnique({
      where: { id: adminId },
      select: { id: true, tipo: true, status: true },
    });
    if (admin?.tipo !== 'ADMIN' || admin.status !== 'ATIVO') {
      throw new ProvisioningInputError(
        'O usuário informado não é um administrador ativo.',
      );
    }

    const credentials = await new DevicesService(
      prisma,
      new AuditService(prisma),
    ).rotateCredential(deviceId, adminId, ipOrigem);

    process.stdout.write(
      `Token individual do dispositivo ${deviceId} (exibido uma única vez):\n${credentials.token}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof ProvisioningInputError
      ? error.message
      : 'Falha ao provisionar dispositivo. Verifique a migration, os IDs e a disponibilidade do banco; nenhum token foi exibido.';
  console.error(message);
  process.exitCode = 1;
});
