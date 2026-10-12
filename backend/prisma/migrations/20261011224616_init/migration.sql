-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('ADMIN', 'COMUM');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'INATIVO');

-- CreateTable
CREATE TABLE "Permissao" (
    "id" SERIAL NOT NULL,
    "chave" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "Permissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario_Permissao" (
    "usuario_id" INTEGER NOT NULL,
    "permissao_id" INTEGER NOT NULL,
    "concedido_por" INTEGER NOT NULL,
    "concedido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_Permissao_pkey" PRIMARY KEY ("usuario_id","permissao_id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "tipo" "TipoUsuario" NOT NULL,
    "vinculo" TEXT NOT NULL,
    "status" "StatusUsuario" NOT NULL DEFAULT 'ATIVO',
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit_Log" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER,
    "acao" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "recurso_id" TEXT,
    "ip_origem" TEXT,
    "dados_antes" JSONB,
    "dados_depois" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario_Empresa" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "papel_empresa" TEXT NOT NULL,
    "data_vinculo" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Usuario_Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" SERIAL NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cpf_cnpj" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario_Propriedade" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "propriedade_id" INTEGER NOT NULL,
    "papel_vinculo" TEXT NOT NULL,
    "data_vinculo" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Usuario_Propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Propriedade" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "area_total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talhao" (
    "id" SERIAL NOT NULL,
    "propriedade_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" TEXT NOT NULL,

    CONSTRAINT "Talhao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cultura" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "variedade" TEXT,
    "temperatura_min" DOUBLE PRECISION,
    "temperatura_max" DOUBLE PRECISION,
    "umidade_min" DOUBLE PRECISION,
    "umidade_max" DOUBLE PRECISION,
    "ciclo_medio_dias" INTEGER,
    "descricao" TEXT,

    CONSTRAINT "Cultura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talhao_Cultura" (
    "id" SERIAL NOT NULL,
    "talhao_id" INTEGER NOT NULL,
    "cultura_id" INTEGER NOT NULL,
    "data_plantio" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Talhao_Cultura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valor_Mercado" (
    "id" SERIAL NOT NULL,
    "cultura_id" INTEGER NOT NULL,
    "data_referencia" TIMESTAMP(3) NOT NULL,
    "mercado_destino" TEXT NOT NULL,
    "pais_destino" TEXT NOT NULL,
    "preco" DECIMAL(65,30) NOT NULL,
    "moeda" TEXT NOT NULL,
    "unidade_medida" TEXT NOT NULL,
    "demanda_estimada" DOUBLE PRECISION,

    CONSTRAINT "Valor_Mercado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recomendacao_Exportacao" (
    "id" SERIAL NOT NULL,
    "talhao_cultura_id" INTEGER NOT NULL,
    "valor_mercado_id" INTEGER NOT NULL,
    "data_geracao" TIMESTAMP(3) NOT NULL,
    "inicio_janela" TIMESTAMP(3),
    "fim_janela" TIMESTAMP(3),
    "destino_recomendado" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "justificativa" TEXT,

    CONSTRAINT "Recomendacao_Exportacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recomendacao_Colheita" (
    "id" SERIAL NOT NULL,
    "talhao_cultura_id" INTEGER NOT NULL,
    "data_geracao" TIMESTAMP(3) NOT NULL,
    "inicio_janela" TIMESTAMP(3),
    "fim_janela" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "classificacao" TEXT,
    "justificativa" TEXT,
    "modelo_versao" TEXT,

    CONSTRAINT "Recomendacao_Colheita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colheita" (
    "id" SERIAL NOT NULL,
    "talhao_cultura_id" INTEGER NOT NULL,
    "data_prevista" TIMESTAMP(3),
    "data_realizada" TIMESTAMP(3),
    "quantidade_prevista" DOUBLE PRECISION,
    "quantidade_colhida" DOUBLE PRECISION,
    "unidade_medida" TEXT,
    "status" TEXT NOT NULL,

    CONSTRAINT "Colheita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operacao_Logistica" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "colheita_id" INTEGER NOT NULL,
    "origem" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "modal" TEXT NOT NULL,
    "transportadora" TEXT,
    "data_prevista" TIMESTAMP(3),
    "tempo_estimado_horas" DOUBLE PRECISION,
    "custo_estimado" DOUBLE PRECISION,
    "status" TEXT NOT NULL,

    CONSTRAINT "Operacao_Logistica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id" SERIAL NOT NULL,
    "talhao_id" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data_instalacao" TIMESTAMP(3),

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" SERIAL NOT NULL,
    "dispositivo_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "unidade_medida" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicao" (
    "id" SERIAL NOT NULL,
    "sensor_id" INTEGER NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "temperatura" DOUBLE PRECISION,
    "umidade" DOUBLE PRECISION,
    "umidade_solo" DOUBLE PRECISION,
    "luminosidade" DOUBLE PRECISION,
    "precipitacao" DOUBLE PRECISION,

    CONSTRAINT "Medicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" SERIAL NOT NULL,
    "medicao_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "visualizado" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cpf_key" ON "Usuario"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_Empresa_usuario_id_empresa_id_key" ON "Usuario_Empresa"("usuario_id", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cpf_cnpj_key" ON "Empresa"("cpf_cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_Propriedade_usuario_id_propriedade_id_key" ON "Usuario_Propriedade"("usuario_id", "propriedade_id");

-- CreateIndex
CREATE INDEX "Propriedade_empresa_id_idx" ON "Propriedade"("empresa_id");

-- CreateIndex
CREATE INDEX "Talhao_propriedade_id_idx" ON "Talhao"("propriedade_id");

-- CreateIndex
CREATE INDEX "Valor_Mercado_cultura_id_data_referencia_idx" ON "Valor_Mercado"("cultura_id", "data_referencia");

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_codigo_key" ON "Dispositivo"("codigo");

-- CreateIndex
CREATE INDEX "Sensor_dispositivo_id_idx" ON "Sensor"("dispositivo_id");

-- CreateIndex
CREATE INDEX "Medicao_sensor_id_data_hora_idx" ON "Medicao"("sensor_id", "data_hora");

-- AddForeignKey
ALTER TABLE "Usuario_Permissao" ADD CONSTRAINT "Usuario_Permissao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario_Permissao" ADD CONSTRAINT "Usuario_Permissao_permissao_id_fkey" FOREIGN KEY ("permissao_id") REFERENCES "Permissao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario_Permissao" ADD CONSTRAINT "Usuario_Permissao_concedido_por_fkey" FOREIGN KEY ("concedido_por") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit_Log" ADD CONSTRAINT "Audit_Log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario_Empresa" ADD CONSTRAINT "Usuario_Empresa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario_Empresa" ADD CONSTRAINT "Usuario_Empresa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario_Propriedade" ADD CONSTRAINT "Usuario_Propriedade_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario_Propriedade" ADD CONSTRAINT "Usuario_Propriedade_propriedade_id_fkey" FOREIGN KEY ("propriedade_id") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Propriedade" ADD CONSTRAINT "Propriedade_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao" ADD CONSTRAINT "Talhao_propriedade_id_fkey" FOREIGN KEY ("propriedade_id") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao_Cultura" ADD CONSTRAINT "Talhao_Cultura_talhao_id_fkey" FOREIGN KEY ("talhao_id") REFERENCES "Talhao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao_Cultura" ADD CONSTRAINT "Talhao_Cultura_cultura_id_fkey" FOREIGN KEY ("cultura_id") REFERENCES "Cultura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valor_Mercado" ADD CONSTRAINT "Valor_Mercado_cultura_id_fkey" FOREIGN KEY ("cultura_id") REFERENCES "Cultura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recomendacao_Exportacao" ADD CONSTRAINT "Recomendacao_Exportacao_talhao_cultura_id_fkey" FOREIGN KEY ("talhao_cultura_id") REFERENCES "Talhao_Cultura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recomendacao_Exportacao" ADD CONSTRAINT "Recomendacao_Exportacao_valor_mercado_id_fkey" FOREIGN KEY ("valor_mercado_id") REFERENCES "Valor_Mercado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recomendacao_Colheita" ADD CONSTRAINT "Recomendacao_Colheita_talhao_cultura_id_fkey" FOREIGN KEY ("talhao_cultura_id") REFERENCES "Talhao_Cultura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colheita" ADD CONSTRAINT "Colheita_talhao_cultura_id_fkey" FOREIGN KEY ("talhao_cultura_id") REFERENCES "Talhao_Cultura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao_Logistica" ADD CONSTRAINT "Operacao_Logistica_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operacao_Logistica" ADD CONSTRAINT "Operacao_Logistica_colheita_id_fkey" FOREIGN KEY ("colheita_id") REFERENCES "Colheita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_talhao_id_fkey" FOREIGN KEY ("talhao_id") REFERENCES "Talhao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "Dispositivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "Sensor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_medicao_id_fkey" FOREIGN KEY ("medicao_id") REFERENCES "Medicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
