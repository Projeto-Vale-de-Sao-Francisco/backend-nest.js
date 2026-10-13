ALTER TABLE "usuario" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "auditLog" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "acao" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "recursoId" TEXT,
    "ipOrigem" TEXT,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "criadoEm" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditLog_usuarioId_criadoEm_idx" ON "auditLog"("usuarioId", "criadoEm");
ALTER TABLE "auditLog" ADD CONSTRAINT "auditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
