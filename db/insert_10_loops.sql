-- Insert 10 new loops with mixed statuses (normal, stiction, oscillation)

-- Insert 10 new loops with different characteristics
INSERT INTO loops (name, description, pv_tag, op_tag, sp_tag, mode_tag, valve_tag, importance) VALUES
('Level Control Loop 1', 'Tank level control with stiction issues', 'LEVEL_PV_01', 'LEVEL_OP_01', 'LEVEL_SP_01', 'LEVEL_MODE_01', 'LEVEL_VALVE_01', 8),
('Flow Control Loop 2', 'Flow control with oscillation problems', 'FLOW_PV_02', 'FLOW_OP_02', 'FLOW_SP_02', 'FLOW_MODE_02', 'FLOW_VALVE_02', 7),
('Pressure Control Loop 2', 'High pressure control - normal operation', 'PRESS_PV_02', 'PRESS_OP_02', 'PRESS_SP_02', 'PRESS_MODE_02', 'PRESS_VALVE_02', 6),
('Temperature Control Loop 2', 'Reactor temperature with stiction', 'TEMP_PV_02', 'TEMP_OP_02', 'TEMP_SP_02', 'TEMP_MODE_02', 'TEMP_VALVE_02', 9),
('pH Control Loop', 'pH control with oscillation', 'PH_PV_01', 'PH_OP_01', 'PH_SP_01', 'PH_MODE_01', 'PH_VALVE_01', 8),
('Density Control Loop', 'Density control - normal operation', 'DENSITY_PV_01', 'DENSITY_OP_01', 'DENSITY_SP_01', 'DENSITY_MODE_01', 'DENSITY_VALVE_01', 5),
('Viscosity Control Loop', 'Viscosity control with stiction', 'VISCOSITY_PV_01', 'VISCOSITY_OP_01', 'VISCOSITY_SP_01', 'VISCOSITY_MODE_01', 'VISCOSITY_VALVE_01', 7),
('Concentration Control Loop', 'Concentration control - normal', 'CONC_PV_01', 'CONC_OP_01', 'CONC_SP_01', 'CONC_MODE_01', 'CONC_VALVE_01', 6),
('Speed Control Loop', 'Motor speed control with oscillation', 'SPEED_PV_01', 'SPEED_OP_01', 'SPEED_SP_01', 'SPEED_MODE_01', 'SPEED_VALVE_01', 8),
('Torque Control Loop', 'Torque control - normal operation', 'TORQUE_PV_01', 'TORQUE_OP_01', 'TORQUE_SP_01', 'TORQUE_MODE_01', 'TORQUE_VALVE_01', 5)
ON CONFLICT DO NOTHING;

-- Insert loop configurations for new loops
INSERT INTO loop_configs (loop_id, sf_low, sf_high, sat_high, rpi_low, rpi_high, osc_limit, kpi_window, sampling_interval)
SELECT 
    id,
    0.8,
    0.95,
    0.2,
    0.7,
    0.9,
    0.3,
    1440,
    200
FROM loops
WHERE name IN (
    'Level Control Loop 1',
    'Flow Control Loop 2',
    'Pressure Control Loop 2',
    'Temperature Control Loop 2',
    'pH Control Loop',
    'Density Control Loop',
    'Viscosity Control Loop',
    'Concentration Control Loop',
    'Speed Control Loop',
    'Torque Control Loop'
)
ON CONFLICT (loop_id) DO NOTHING;

-- Insert raw data for new loops with different characteristics
INSERT INTO raw_samples (ts, loop_id, pv, op, sp, mode, valve_position, quality_code)
SELECT 
    generate_series(
        NOW() - INTERVAL '24 hours',
        NOW(),
        INTERVAL '1 minute'
    ) as ts,
    l.id as loop_id,
    -- Different PV patterns based on loop type and status
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 
            -- Stiction pattern: PV gets stuck at certain values
            50 + CASE WHEN EXTRACT(MINUTE FROM generate_series(NOW() - INTERVAL '24 hours', NOW(), INTERVAL '1 minute')) % 30 < 15 
                      THEN 20 ELSE -10 END + (random() - 0.5) * 3
        WHEN l.name LIKE '%oscillation%' THEN 
            -- Oscillation pattern: PV oscillates around setpoint
            50 + 15 * sin(EXTRACT(EPOCH FROM generate_series(NOW() - INTERVAL '24 hours', NOW(), INTERVAL '1 minute')) / 300) + (random() - 0.5) * 8
        ELSE 
            -- Normal pattern: PV follows setpoint with small variations
            50 + 5 * sin(EXTRACT(EPOCH FROM generate_series(NOW() - INTERVAL '24 hours', NOW(), INTERVAL '1 minute')) / 3600) + (random() - 0.5) * 2
    END as pv,
    -- OP patterns
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 
            -- OP gets stuck due to stiction
            45 + CASE WHEN EXTRACT(MINUTE FROM generate_series(NOW() - INTERVAL '24 hours', NOW(), INTERVAL '1 minute')) % 30 < 15 
                      THEN 15 ELSE -5 END + (random() - 0.5) * 2
        WHEN l.name LIKE '%oscillation%' THEN 
            -- OP oscillates
            45 + 10 * sin(EXTRACT(EPOCH FROM generate_series(NOW() - INTERVAL '24 hours', NOW(), INTERVAL '1 minute')) / 300) + (random() - 0.5) * 5
        ELSE 
            -- Normal OP
            45 + 3 * sin(EXTRACT(EPOCH FROM generate_series(NOW() - INTERVAL '24 hours', NOW(), INTERVAL '1 minute')) / 1800) + (random() - 0.5) * 2
    END as op,
    50 as sp,
    'AUTO' as mode,
    -- Valve position patterns
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 
            -- Valve gets stuck
            45 + CASE WHEN EXTRACT(MINUTE FROM generate_series(NOW() - INTERVAL '24 hours', NOW(), INTERVAL '1 minute')) % 30 < 15 
                      THEN 15 ELSE -5 END + (random() - 0.5) * 2
        WHEN l.name LIKE '%oscillation%' THEN 
            -- Valve oscillates
            45 + 10 * sin(EXTRACT(EPOCH FROM generate_series(NOW() - INTERVAL '24 hours', NOW(), INTERVAL '1 minute')) / 300) + (random() - 0.5) * 5
        ELSE 
            -- Normal valve movement
            45 + 3 * sin(EXTRACT(EPOCH FROM generate_series(NOW() - INTERVAL '24 hours', NOW(), INTERVAL '1 minute')) / 1800) + (random() - 0.5) * 2
    END as valve_position,
    192 as quality_code
FROM loops l
WHERE l.name IN (
    'Level Control Loop 1',
    'Flow Control Loop 2',
    'Pressure Control Loop 2',
    'Temperature Control Loop 2',
    'pH Control Loop',
    'Density Control Loop',
    'Viscosity Control Loop',
    'Concentration Control Loop',
    'Speed Control Loop',
    'Torque Control Loop'
)
ON CONFLICT DO NOTHING;

-- Insert KPI results for new loops with status-specific patterns
INSERT INTO kpi_results (loop_id, timestamp, service_factor, effective_sf, sat_percent, output_travel, pi, rpi, osc_index, stiction)
SELECT 
    l.id as loop_id,
    generate_series(
        NOW() - INTERVAL '7 days',
        NOW(),
        INTERVAL '1 hour'
    ) as timestamp,
    -- Service factor based on loop status
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 0.65 + (random() - 0.5) * 0.15  -- Lower SF for stiction
        WHEN l.name LIKE '%oscillation%' THEN 0.70 + (random() - 0.5) * 0.20  -- Lower SF for oscillation
        ELSE 0.85 + (random() - 0.5) * 0.10  -- Normal SF
    END as service_factor,
    -- Effective service factor
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 0.60 + (random() - 0.5) * 0.12
        WHEN l.name LIKE '%oscillation%' THEN 0.65 + (random() - 0.5) * 0.15
        ELSE 0.82 + (random() - 0.5) * 0.08
    END as effective_sf,
    -- Saturation percent
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 0.25 + (random() - 0.5) * 0.15  -- Higher saturation
        WHEN l.name LIKE '%oscillation%' THEN 0.20 + (random() - 0.5) * 0.10
        ELSE 0.15 + (random() - 0.5) * 0.08
    END as sat_percent,
    -- Output travel
    45.5 + (random() - 0.5) * 10 as output_travel,
    -- Performance index
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 0.55 + (random() - 0.5) * 0.20  -- Lower PI
        WHEN l.name LIKE '%oscillation%' THEN 0.60 + (random() - 0.5) * 0.25
        ELSE 0.78 + (random() - 0.5) * 0.15
    END as pi,
    -- Robust performance index
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 0.50 + (random() - 0.5) * 0.18
        WHEN l.name LIKE '%oscillation%' THEN 0.55 + (random() - 0.5) * 0.22
        ELSE 0.82 + (random() - 0.5) * 0.12
    END as rpi,
    -- Oscillation index
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 0.15 + (random() - 0.5) * 0.10  -- Lower oscillation
        WHEN l.name LIKE '%oscillation%' THEN 0.45 + (random() - 0.5) * 0.25  -- Higher oscillation
        ELSE 0.25 + (random() - 0.5) * 0.15
    END as osc_index,
    -- Stiction index
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 0.45 + (random() - 0.5) * 0.20  -- Higher stiction
        WHEN l.name LIKE '%oscillation%' THEN 0.20 + (random() - 0.5) * 0.15
        ELSE 0.15 + (random() - 0.5) * 0.10
    END as stiction
FROM loops l
WHERE l.name IN (
    'Level Control Loop 1',
    'Flow Control Loop 2',
    'Pressure Control Loop 2',
    'Temperature Control Loop 2',
    'pH Control Loop',
    'Density Control Loop',
    'Viscosity Control Loop',
    'Concentration Control Loop',
    'Speed Control Loop',
    'Torque Control Loop'
)
ON CONFLICT DO NOTHING;

-- Insert diagnostic results for new loops with status-specific classifications
INSERT INTO diagnostic_results (loop_id, timestamp, stiction_S, stiction_J, stiction_pct, osc_period, classification, details)
SELECT 
    l.id as loop_id,
    generate_series(
        NOW() - INTERVAL '7 days',
        NOW(),
        INTERVAL '6 hours'
    ) as timestamp,
    -- Stiction S parameter
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 0.35 + (random() - 0.5) * 0.20  -- Higher stiction S
        WHEN l.name LIKE '%oscillation%' THEN 0.15 + (random() - 0.5) * 0.10
        ELSE 0.10 + (random() - 0.5) * 0.08
    END as stiction_S,
    -- Stiction J parameter
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 0.30 + (random() - 0.5) * 0.15  -- Higher stiction J
        WHEN l.name LIKE '%oscillation%' THEN 0.12 + (random() - 0.5) * 0.08
        ELSE 0.08 + (random() - 0.5) * 0.06
    END as stiction_J,
    -- Stiction percentage
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 35.0 + (random() - 0.5) * 20  -- Higher stiction %
        WHEN l.name LIKE '%oscillation%' THEN 15.0 + (random() - 0.5) * 10
        ELSE 8.0 + (random() - 0.5) * 8
    END as stiction_pct,
    -- Oscillation period
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 180.0 + (random() - 0.5) * 60  -- Longer period for stiction
        WHEN l.name LIKE '%oscillation%' THEN 90.0 + (random() - 0.5) * 40  -- Shorter period for oscillation
        ELSE 150.0 + (random() - 0.5) * 50
    END as osc_period,
    -- Classification based on loop characteristics
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 'STICTION'
        WHEN l.name LIKE '%oscillation%' THEN 'OSCILLATION'
        ELSE 'NORMAL'
    END as classification,
    -- Details JSON with status-specific recommendations
    CASE 
        WHEN l.name LIKE '%stiction%' THEN 
            '{"confidence": 0.92, "recommendation": "Valve maintenance required - high stiction detected", "severity": "HIGH"}'::jsonb
        WHEN l.name LIKE '%oscillation%' THEN 
            '{"confidence": 0.88, "recommendation": "Tune controller parameters - oscillation detected", "severity": "MEDIUM"}'::jsonb
        ELSE 
            '{"confidence": 0.85, "recommendation": "Loop performing normally - continue monitoring", "severity": "LOW"}'::jsonb
    END as details
FROM loops l
WHERE l.name IN (
    'Level Control Loop 1',
    'Flow Control Loop 2',
    'Pressure Control Loop 2',
    'Temperature Control Loop 2',
    'pH Control Loop',
    'Density Control Loop',
    'Viscosity Control Loop',
    'Concentration Control Loop',
    'Speed Control Loop',
    'Torque Control Loop'
)
ON CONFLICT DO NOTHING;

-- Insert aggregated data for new loops
INSERT INTO agg_1m (bucket, loop_id, pv_avg, pv_min, pv_max, pv_count, op_avg, sp_avg)
SELECT 
    date_trunc('minute', ts) as bucket,
    loop_id,
    AVG(pv) as pv_avg,
    MIN(pv) as pv_min,
    MAX(pv) as pv_max,
    COUNT(pv) as pv_count,
    AVG(op) as op_avg,
    AVG(sp) as sp_avg
FROM raw_samples
WHERE ts >= NOW() - INTERVAL '24 hours'
  AND loop_id IN (
    SELECT id FROM loops WHERE name IN (
        'Level Control Loop 1',
        'Flow Control Loop 2',
        'Pressure Control Loop 2',
        'Temperature Control Loop 2',
        'pH Control Loop',
        'Density Control Loop',
        'Viscosity Control Loop',
        'Concentration Control Loop',
        'Speed Control Loop',
        'Torque Control Loop'
    )
  )
GROUP BY date_trunc('minute', ts), loop_id
ON CONFLICT (bucket, loop_id) DO NOTHING;
