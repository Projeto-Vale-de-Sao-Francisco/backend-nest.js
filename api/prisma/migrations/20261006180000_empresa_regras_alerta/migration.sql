-- AlterTable
ALTER TABLE "alerta" ADD COLUMN     "dispositivoId" INTEGER,
ADD COLUMN     "resolvido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolvidoEm" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "dispositivo" ADD COLUMN     "chaveApiHash" TEXT;

-- AlterTable
ALTER TABLE "propriedade" ADD COLUMN     "empresaId" INTEGER;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "empresaId" INTEGER;

-- CreateTable
CREATE TABLE "empresa" (
    "id" SERIAL NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cpfCnpj" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "responsavel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "dataCadastro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_cpfCnpj_key" ON "empresa"("cpfCnpj");

-- CreateIndex
CREATE INDEX "alerta_dispositivoId_titulo_resolvido_idx" ON "alerta"("dispositivoId", "titulo", "resolvido");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_chaveApiHash_key" ON "dispositivo"("chaveApiHash");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propriedade" ADD CONSTRAINT "propriedade_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "dispositivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

