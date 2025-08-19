-- Migration V5: Populate raw_samples table with realistic data for the past week
-- This will enable proper trend visualization in the Live Trends tab

-- Clear existing data from the past week to avoid duplicates
DELETE FROM raw_samples WHERE ts > NOW() - INTERVAL '7 days';

-- Insert realistic process data for the past week
-- Each loop will have different characteristics (oscillating, stable, with disturbances, etc.)

-- Loop 1: Stable temperature control with occasional disturbances
INSERT INTO raw_samples (loop_id, ts, pv, op, sp, mode, valve_position)
SELECT 
    l.id,
    ts,
    -- PV: Stable around 50°C with some noise and occasional disturbances
    50 + 
    (sin(extract(epoch from ts) / 3600) * 2) + -- Daily cycle
    (sin(extract(epoch from ts) / 300) * 0.5) + -- 5-min oscillation
    (random() - 0.5) * 1 + -- Random noise
    CASE 
        WHEN extract(hour from ts) BETWEEN 8 AND 9 THEN 5 -- Morning disturbance
        WHEN extract(hour from ts) BETWEEN 17 AND 18 THEN -3 -- Evening disturbance
        ELSE 0
    END as pv,
    -- OP: Control signal responding to PV changes
    45 + 
    (sin(extract(epoch from ts) / 3600) * 3) +
    (sin(extract(epoch from ts) / 300) * 1) +
    (random() - 0.5) * 2 as op,
    -- SP: Setpoint changes every 12 hours
    CASE 
        WHEN extract(hour from ts) < 12 THEN 50
        ELSE 52
    END as sp,
    'AUTO' as mode,
    -- Valve position: correlates with OP but with some lag
    45 + 
    (sin(extract(epoch from ts) / 3600) * 2.5) +
    (sin(extract(epoch from ts) / 300) * 0.8) +
    (random() - 0.5) * 1.5 as valve_position
FROM loops l 
CROSS JOIN generate_series(
    NOW() - INTERVAL '7 days',
    NOW(),
    INTERVAL '1 minute'
) as ts
WHERE l.name LIKE '%Temperature%' AND l.deleted_at IS NULL
LIMIT 1;

-- Loop 2: Oscillating pressure control (simulating stiction)
INSERT INTO raw_samples (loop_id, ts, pv, op, sp, mode, valve_position)
SELECT 
    l.id,
    ts,
    -- PV: Oscillating pressure with stiction pattern
    100 + 
    (sin(extract(epoch from ts) / 1800) * 15) + -- 30-min oscillation
    (sin(extract(epoch from ts) / 600) * 5) + -- 10-min oscillation
    (random() - 0.5) * 3 + -- Random noise
    CASE 
        WHEN extract(minute from ts) < 30 THEN 10 -- Stiction effect
        ELSE -5
    END as pv,
    -- OP: Control signal with stiction pattern
    60 + 
    (sin(extract(epoch from ts) / 1800) * 20) +
    (sin(extract(epoch from ts) / 600) * 8) +
    (random() - 0.5) * 4 as op,
    -- SP: Constant setpoint
    100 as sp,
    'AUTO' as mode,
    -- Valve position: shows stiction pattern
    60 + 
    (sin(extract(epoch from ts) / 1800) * 15) +
    (sin(extract(epoch from ts) / 600) * 6) +
    (random() - 0.5) * 3 as valve_position
FROM loops l 
CROSS JOIN generate_series(
    NOW() - INTERVAL '7 days',
    NOW(),
    INTERVAL '1 minute'
) as ts
WHERE l.name LIKE '%Pressure%' AND l.deleted_at IS NULL
LIMIT 1;

-- Loop 3: Flow control with frequent setpoint changes
INSERT INTO raw_samples (loop_id, ts, pv, op, sp, mode, valve_position)
SELECT 
    l.id,
    ts,
    -- PV: Flow rate with some noise
    25 + 
    (sin(extract(epoch from ts) / 3600) * 3) +
    (random() - 0.5) * 2 as pv,
    -- OP: Control signal
    40 + 
    (sin(extract(epoch from ts) / 3600) * 5) +
    (random() - 0.5) * 3 as op,
    -- SP: Frequent setpoint changes (every 4 hours)
    CASE 
        WHEN extract(hour from ts) % 4 = 0 THEN 25
        WHEN extract(hour from ts) % 4 = 1 THEN 30
        WHEN extract(hour from ts) % 4 = 2 THEN 20
        ELSE 35
    END as sp,
    'AUTO' as mode,
    -- Valve position
    40 + 
    (sin(extract(epoch from ts) / 3600) * 4) +
    (random() - 0.5) * 2.5 as valve_position
FROM loops l 
CROSS JOIN generate_series(
    NOW() - INTERVAL '7 days',
    NOW(),
    INTERVAL '1 minute'
) as ts
WHERE l.name LIKE '%Flow%' AND l.deleted_at IS NULL
LIMIT 1;

-- Loop 4: Level control with deadband issues
INSERT INTO raw_samples (loop_id, ts, pv, op, sp, mode, valve_position)
SELECT 
    l.id,
    ts,
    -- PV: Level with deadband pattern
    75 + 
    (sin(extract(epoch from ts) / 7200) * 8) + -- 2-hour cycle
    (random() - 0.5) * 1.5 + -- Random noise
    CASE 
        WHEN extract(minute from ts) < 30 THEN 2 -- Deadband effect
        ELSE -1
    END as pv,
    -- OP: Control signal with deadband
    50 + 
    (sin(extract(epoch from ts) / 7200) * 10) +
    (random() - 0.5) * 2 as op,
    -- SP: Constant setpoint
    75 as sp,
    'AUTO' as mode,
    -- Valve position
    50 + 
    (sin(extract(epoch from ts) / 7200) * 8) +
    (random() - 0.5) * 1.5 as valve_position
FROM loops l 
CROSS JOIN generate_series(
    NOW() - INTERVAL '7 days',
    NOW(),
    INTERVAL '1 minute'
) as ts
WHERE l.name LIKE '%Level%' AND l.deleted_at IS NULL
LIMIT 1;

-- Loop 5: pH control with saturation issues
INSERT INTO raw_samples (loop_id, ts, pv, op, sp, mode, valve_position)
SELECT 
    l.id,
    ts,
    -- PV: pH with saturation pattern
    7.0 + 
    (sin(extract(epoch from ts) / 3600) * 0.3) +
    (random() - 0.5) * 0.1 as pv,
    -- OP: Control signal with saturation
    CASE 
        WHEN extract(hour from ts) % 4 < 2 THEN 90 -- Saturation
        ELSE 30 + (sin(extract(epoch from ts) / 3600) * 20)
    END as op,
    -- SP: Constant setpoint
    7.0 as sp,
    'AUTO' as mode,
    -- Valve position: shows saturation
    CASE 
        WHEN extract(hour from ts) % 4 < 2 THEN 95
        ELSE 30 + (sin(extract(epoch from ts) / 3600) * 15)
    END as valve_position
FROM loops l 
CROSS JOIN generate_series(
    NOW() - INTERVAL '7 days',
    NOW(),
    INTERVAL '1 minute'
) as ts
WHERE l.name LIKE '%pH%' AND l.deleted_at IS NULL
LIMIT 1;

-- Add data for remaining loops with different patterns
INSERT INTO raw_samples (loop_id, ts, pv, op, sp, mode, valve_position)
SELECT 
    l.id,
    ts,
    -- PV: Various patterns based on loop importance
    CASE 
        WHEN l.importance > 8 THEN 200 + (sin(extract(epoch from ts) / 1800) * 25) -- High importance: oscillating
        WHEN l.importance > 5 THEN 150 + (sin(extract(epoch from ts) / 3600) * 10) -- Medium importance: stable
        ELSE 100 + (sin(extract(epoch from ts) / 7200) * 5) -- Low importance: very stable
    END + (random() - 0.5) * 3 as pv,
    -- OP: Control signal
    CASE 
        WHEN l.importance > 8 THEN 70 + (sin(extract(epoch from ts) / 1800) * 30)
        WHEN l.importance > 5 THEN 60 + (sin(extract(epoch from ts) / 3600) * 15)
        ELSE 50 + (sin(extract(epoch from ts) / 7200) * 8)
    END + (random() - 0.5) * 2 as op,
    -- SP: Setpoint
    CASE 
        WHEN l.importance > 8 THEN 200
        WHEN l.importance > 5 THEN 150
        ELSE 100
    END as sp,
    'AUTO' as mode,
    -- Valve position
    CASE 
        WHEN l.importance > 8 THEN 70 + (sin(extract(epoch from ts) / 1800) * 25)
        WHEN l.importance > 5 THEN 60 + (sin(extract(epoch from ts) / 3600) * 12)
        ELSE 50 + (sin(extract(epoch from ts) / 7200) * 6)
    END + (random() - 0.5) * 1.5 as valve_position
FROM loops l 
CROSS JOIN generate_series(
    NOW() - INTERVAL '7 days',
    NOW(),
    INTERVAL '1 minute'
) as ts
WHERE l.deleted_at IS NULL 
AND l.id NOT IN (
    SELECT DISTINCT loop_id FROM raw_samples WHERE ts > NOW() - INTERVAL '7 days'
);

-- Add some manual mode changes for variety
UPDATE raw_samples 
SET mode = 'MANUAL' 
WHERE extract(hour from ts) BETWEEN 8 AND 8 
AND extract(dow from ts) IN (1, 3, 5); -- Monday, Wednesday, Friday

UPDATE raw_samples 
SET mode = 'CASCADE' 
WHERE extract(hour from ts) BETWEEN 14 AND 14 
AND extract(dow from ts) IN (2, 4); -- Tuesday, Thursday

-- Add some valve position anomalies
UPDATE raw_samples 
SET valve_position = valve_position * 1.2 
WHERE extract(hour from ts) BETWEEN 12 AND 12 
AND extract(dow from ts) = 6; -- Saturday

-- Verify the data insertion
SELECT 
    COUNT(*) as total_samples,
    COUNT(DISTINCT loop_id) as loops_with_data,
    MIN(ts) as earliest_timestamp,
    MAX(ts) as latest_timestamp
FROM raw_samples 
WHERE ts > NOW() - INTERVAL '7 days';
