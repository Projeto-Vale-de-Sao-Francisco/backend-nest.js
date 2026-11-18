CREATE OR REPLACE FUNCTION "prevent_audit_log_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Audit_Log records are append-only';
END;
$$;

CREATE TRIGGER "Audit_Log_append_only"
BEFORE UPDATE OR DELETE ON "Audit_Log"
FOR EACH ROW
EXECUTE FUNCTION "prevent_audit_log_mutation"();
