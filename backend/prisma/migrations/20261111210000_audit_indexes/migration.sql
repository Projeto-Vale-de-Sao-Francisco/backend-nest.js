CREATE INDEX "Audit_Log_usuario_id_criado_em_idx"
  ON "Audit_Log"("usuario_id", "criado_em");

CREATE INDEX "Audit_Log_acao_criado_em_idx"
  ON "Audit_Log"("acao", "criado_em");

CREATE INDEX "Audit_Log_recurso_recurso_id_idx"
  ON "Audit_Log"("recurso", "recurso_id");

CREATE INDEX "Audit_Log_criado_em_idx"
  ON "Audit_Log"("criado_em");
