-- Perfil "Produtor" passa a se chamar "Agricultor" (documento de perfis e telas).
ALTER TYPE "Perfil" RENAME VALUE 'PRODUTOR' TO 'AGRICULTOR';
ALTER TABLE "usuario" ALTER COLUMN "perfil" SET DEFAULT 'AGRICULTOR';

-- Vinculo usuario <-> empresa passa a ser N:N.
CREATE TABLE "usuarioEmpresa" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "dataAssociacao" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarioEmpresa_pkey" PRIMARY KEY ("id")
);

-- Preserva os vinculos existentes (usuario.empresaId) antes de remover a coluna.
INSERT INTO "usuarioEmpresa" ("usuarioId", "empresaId")
SELECT "id", "empresaId" FROM "usuario" WHERE "empresaId" IS NOT NULL;

CREATE INDEX "usuarioEmpresa_empresaId_idx" ON "usuarioEmpresa"("empresaId");
CREATE UNIQUE INDEX "usuarioEmpresa_usuarioId_empresaId_key" ON "usuarioEmpresa"("usuarioId", "empresaId");
ALTER TABLE "usuarioEmpresa" ADD CONSTRAINT "usuarioEmpresa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usuarioEmpresa" ADD CONSTRAINT "usuarioEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "usuario" DROP CONSTRAINT "usuario_empresaId_fkey";
ALTER TABLE "usuario" DROP COLUMN "empresaId";
