-- Test query to check what values are in the database
SELECT
  loop_id,
  timestamp,
  service_factor,
  pi,
  rpi,
  osc_index,
  stiction,
  pg_typeof(service_factor) as sf_type,
  pg_typeof(pi) as pi_type
FROM kpi_results
WHERE loop_id = 'TIC208031'
ORDER BY timestamp DESC
LIMIT 5;

-- Check what AVG returns for this loop
SELECT
  COUNT(*) as record_count,
  AVG(CAST(service_factor AS NUMERIC)) as avg_service_factor,
  AVG(CAST(pi AS NUMERIC)) as avg_pi,
  AVG(CAST(rpi AS NUMERIC)) as avg_rpi,
  pg_typeof(AVG(CAST(service_factor AS NUMERIC))) as avg_type
FROM kpi_results
WHERE loop_id = 'TIC208031'
  AND timestamp BETWEEN (NOW() - INTERVAL '24 hours') AND NOW();
