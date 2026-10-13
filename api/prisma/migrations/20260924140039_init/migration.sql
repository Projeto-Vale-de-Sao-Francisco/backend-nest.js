-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMINISTRADOR', 'GESTOR', 'TECNICO', 'PRODUTOR');

-- CreateEnum
CREATE TYPE "NivelAlerta" AS ENUM ('ATENCAO', 'CRITICO');

-- CreateEnum
CREATE TYPE "OrigemValor" AS ENUM ('MANUAL', 'ATUALIZACAO');

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "senha" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'PRODUTOR',
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "dataCadastro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propriedade" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "localizacao" TEXT NOT NULL,
    "municipio" TEXT,
    "estado" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "areaTotal" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "dataCadastro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarioPropriedade" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "dataAssociacao" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarioPropriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cultura" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "variedade" TEXT,
    "temperaturaMin" DOUBLE PRECISION NOT NULL,
    "temperaturaMax" DOUBLE PRECISION NOT NULL,
    "umidadeMin" DOUBLE PRECISION NOT NULL,
    "umidadeMax" DOUBLE PRECISION NOT NULL,
    "cicloMedioDias" INTEGER,
    "descricao" TEXT,
    "dataCadastro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cultura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talhao" (
    "id" SERIAL NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "culturaId" INTEGER,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "area" DOUBLE PRECISION,
    "dataPlantio" DATE,
    "previsaoColheita" DATE,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "dataCadastro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talhao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivo" (
    "id" SERIAL NOT NULL,
    "talhaoId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'ESP32',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "dataInstalacao" TIMESTAMPTZ(6),
    "dataCadastro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor" (
    "id" SERIAL NOT NULL,
    "dispositivoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "unidadeMedida" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "dataCadastro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicao" (
    "id" SERIAL NOT NULL,
    "dispositivoId" INTEGER NOT NULL,
    "dataHora" TIMESTAMPTZ(6) NOT NULL,
    "temperatura" DOUBLE PRECISION NOT NULL,
    "umidade" DOUBLE PRECISION NOT NULL,
    "umidadeSolo" DOUBLE PRECISION,
    "luminosidade" DOUBLE PRECISION,
    "precipitacao" DOUBLE PRECISION,

    CONSTRAINT "medicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta" (
    "id" SERIAL NOT NULL,
    "talhaoId" INTEGER NOT NULL,
    "medicaoId" INTEGER,
    "tipo" TEXT NOT NULL DEFAULT 'CLIMATICO',
    "nivel" "NivelAlerta" NOT NULL DEFAULT 'ATENCAO',
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dataHora" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visualizado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valorMercado" (
    "id" SERIAL NOT NULL,
    "culturaId" INTEGER NOT NULL,
    "mercadoDestino" TEXT NOT NULL,
    "precoMedio" DOUBLE PRECISION NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "dataReferencia" DATE NOT NULL,
    "demandaEstimada" TEXT,
    "origem" "OrigemValor" NOT NULL DEFAULT 'MANUAL',
    "dataCadastro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valorMercado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operacaoLogistica" (
    "id" SERIAL NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "talhaoId" INTEGER,
    "origem" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "modal" TEXT NOT NULL,
    "dataPrevista" DATE,
    "tempoEstimado" TEXT,
    "custoEstimado" DOUBLE PRECISION,
    "transportadora" TEXT,
    "situacao" TEXT NOT NULL DEFAULT 'PLANEJADA',
    "dataCadastro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operacaoLogistica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_cpf_key" ON "usuario"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuarioPropriedade_propriedadeId_idx" ON "usuarioPropriedade"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarioPropriedade_usuarioId_propriedadeId_key" ON "usuarioPropriedade"("usuarioId", "propriedadeId");

-- CreateIndex
CREATE INDEX "talhao_propriedadeId_idx" ON "talhao"("propriedadeId");

-- CreateIndex
CREATE INDEX "talhao_culturaId_idx" ON "talhao"("culturaId");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_codigo_key" ON "dispositivo"("codigo");

-- CreateIndex
CREATE INDEX "dispositivo_talhaoId_idx" ON "dispositivo"("talhaoId");

-- CreateIndex
CREATE INDEX "sensor_dispositivoId_idx" ON "sensor"("dispositivoId");

-- CreateIndex
CREATE INDEX "medicao_dispositivoId_dataHora_idx" ON "medicao"("dispositivoId", "dataHora");

-- CreateIndex
CREATE INDEX "alerta_talhaoId_visualizado_idx" ON "alerta"("talhaoId", "visualizado");

-- CreateIndex
CREATE INDEX "valorMercado_culturaId_dataReferencia_idx" ON "valorMercado"("culturaId", "dataReferencia");

-- CreateIndex
CREATE INDEX "operacaoLogistica_propriedadeId_idx" ON "operacaoLogistica"("propriedadeId");

-- AddForeignKey
ALTER TABLE "usuarioPropriedade" ADD CONSTRAINT "usuarioPropriedade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarioPropriedade" ADD CONSTRAINT "usuarioPropriedade_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talhao" ADD CONSTRAINT "talhao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talhao" ADD CONSTRAINT "talhao_culturaId_fkey" FOREIGN KEY ("culturaId") REFERENCES "cultura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo" ADD CONSTRAINT "dispositivo_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "talhao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor" ADD CONSTRAINT "sensor_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "dispositivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicao" ADD CONSTRAINT "medicao_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "dispositivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "talhao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_medicaoId_fkey" FOREIGN KEY ("medicaoId") REFERENCES "medicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valorMercado" ADD CONSTRAINT "valorMercado_culturaId_fkey" FOREIGN KEY ("culturaId") REFERENCES "cultura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacaoLogistica" ADD CONSTRAINT "operacaoLogistica_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operacaoLogistica" ADD CONSTRAINT "operacaoLogistica_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "talhao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
