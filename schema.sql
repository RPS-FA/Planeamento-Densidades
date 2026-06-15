-- ============================================================
-- Planeamento DENSIDADES — Schema Postgres
-- Executado automaticamente no arranque por db.initSchema().
-- Idempotente: todos os CREATE têm IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS ops (
  id           SERIAL PRIMARY KEY,
  op           TEXT NOT NULL,
  payload      JSONB NOT NULL,   -- toda a OP serializada (todos os campos)
  maquina      TEXT,             -- duplicado fora do JSON para queries rápidas
  week_key     TEXT,
  sort_idx     REAL DEFAULT 0,
  dia_idx      SMALLINT DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_by   TEXT
);
CREATE INDEX IF NOT EXISTS ops_machine_week ON ops(maquina, week_key);

CREATE TABLE IF NOT EXISTS settings (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
