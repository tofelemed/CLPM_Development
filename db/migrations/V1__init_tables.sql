CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  pv_tag VARCHAR(255) NOT NULL,
  op_tag VARCHAR(255) NOT NULL,
  sp_tag VARCHAR(255) NOT NULL,
  mode_tag VARCHAR(255) NOT NULL,
  valve_tag VARCHAR(255),
  importance SMALLINT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS loop_config (
  loop_id UUID PRIMARY KEY REFERENCES loops(id) ON DELETE CASCADE,
  sf_low NUMERIC(4,3),
  sf_high NUMERIC(4,3),
  sat_high NUMERIC(4,3),
  rpi_low NUMERIC(4,3),
  rpi_high NUMERIC(4,3),
  osc_limit NUMERIC(4,3),
  kpi_window INTEGER DEFAULT 60,
  importance SMALLINT DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw_samples (
  ts TIMESTAMPTZ NOT NULL,
  loop_id UUID NOT NULL REFERENCES loops(id),
  pv DOUBLE PRECISION,
  op DOUBLE PRECISION,
  sp DOUBLE PRECISION,
  mode VARCHAR(16),
  valve_position DOUBLE PRECISION,
  quality_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
SELECT create_hypertable('raw_samples', 'ts', if_not_exists => TRUE, chunk_time_interval => INTERVAL '7 days');
CREATE INDEX IF NOT EXISTS idx_raw_samples_loop_ts ON raw_samples (loop_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_raw_samples_ts ON raw_samples (ts DESC);

CREATE TABLE IF NOT EXISTS agg_1m (
  bucket TIMESTAMPTZ NOT NULL,
  loop_id UUID NOT NULL REFERENCES loops(id),
  pv_avg DOUBLE PRECISION, pv_min DOUBLE PRECISION, pv_max DOUBLE PRECISION, pv_count BIGINT,
  op_avg DOUBLE PRECISION, sp_avg DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (bucket, loop_id)
);
SELECT create_hypertable('agg_1m', 'bucket', if_not_exists => TRUE, chunk_time_interval => INTERVAL '30 days');
CREATE INDEX IF NOT EXISTS idx_agg1m_loop_bucket ON agg_1m (loop_id, bucket DESC);

CREATE TABLE IF NOT EXISTS kpi_results (
  id BIGSERIAL PRIMARY KEY,
  loop_id UUID NOT NULL REFERENCES loops(id),
  timestamp TIMESTAMPTZ NOT NULL,
  service_factor NUMERIC(4,3),
  effective_sf NUMERIC(4,3),
  sat_percent NUMERIC(4,3),
  output_travel NUMERIC(8,3),
  pi NUMERIC(4,3),
  rpi NUMERIC(4,3),
  osc_index NUMERIC(4,3),
  stiction NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kpi_loop_ts ON kpi_results (loop_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS diagnostic_results (
  id BIGSERIAL PRIMARY KEY,
  loop_id UUID NOT NULL REFERENCES loops(id),
  timestamp TIMESTAMPTZ NOT NULL,
  stiction_S NUMERIC(8,4),
  stiction_J NUMERIC(8,4),
  stiction_pct NUMERIC(5,2),
  osc_period NUMERIC(8,3),
  root_cause UUID,
  classification VARCHAR(32),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diag_loop_ts ON diagnostic_results (loop_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS apc_attainment (
  id BIGSERIAL PRIMARY KEY,
  controller_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  usefulness NUMERIC(4,3),
  criticality NUMERIC(4,3),
  reliability NUMERIC(4,3),
  acceptance NUMERIC(4,3),
  value NUMERIC(4,3),
  uptime NUMERIC(4,3),
  overall_attainment NUMERIC(4,3)
);
