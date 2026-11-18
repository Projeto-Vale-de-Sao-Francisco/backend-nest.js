CREATE TABLE "Dispositivo_Credencial" (
    "id" SERIAL NOT NULL,
    "dispositivo_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    CONSTRAINT "Dispositivo_Credencial_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Dispositivo_Credencial_dispositivo_id_fkey"
        FOREIGN KEY ("dispositivo_id") REFERENCES "Dispositivo"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Dispositivo_Credencial_dispositivo_id_key"
    ON "Dispositivo_Credencial"("dispositivo_id");
CREATE UNIQUE INDEX "Dispositivo_Credencial_token_hash_key"
    ON "Dispositivo_Credencial"("token_hash");
CREATE INDEX "Dispositivo_Credencial_revoked_at_idx"
    ON "Dispositivo_Credencial"("revoked_at");

CREATE TABLE "Login_Rate_Limit" (
    "bucket_key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMPTZ(3) NOT NULL,
    "blocked_until" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Login_Rate_Limit_pkey" PRIMARY KEY ("bucket_key")
);

CREATE INDEX "Login_Rate_Limit_updated_at_idx"
    ON "Login_Rate_Limit"("updated_at");
