CREATE TABLE "Pipeline_Execucao" (
    "id" SERIAL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "duration_ms" INTEGER,
    "total_received" INTEGER NOT NULL DEFAULT 0,
    "total_processed" INTEGER NOT NULL DEFAULT 0,
    "total_valid" INTEGER NOT NULL DEFAULT 0,
    "total_corrected" INTEGER NOT NULL DEFAULT 0,
    "total_filled" INTEGER NOT NULL DEFAULT 0,
    "total_duplicates_removed" INTEGER NOT NULL DEFAULT 0,
    "total_invalid" INTEGER NOT NULL DEFAULT 0,
    "total_outliers" INTEGER NOT NULL DEFAULT 0,
    "total_discarded" INTEGER NOT NULL DEFAULT 0,
    "summary_json" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Pipeline_Problema" (
    "id" SERIAL PRIMARY KEY,
    "execution_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "tipo_dado" TEXT NOT NULL,
    "tipo_problema" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "motivo" TEXT,
    "detalhes" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pipeline_Problema_execution_id_fkey"
        FOREIGN KEY ("execution_id") REFERENCES "Pipeline_Execucao"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX "Pipeline_Execucao_source_started_at_idx"
    ON "Pipeline_Execucao" ("source", "started_at");

CREATE INDEX "Pipeline_Problema_execution_id_idx"
    ON "Pipeline_Problema" ("execution_id");
