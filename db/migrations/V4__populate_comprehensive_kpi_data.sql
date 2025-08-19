-- Populate kpi_results table with comprehensive KPI data
-- This will add realistic KPI data for all loops with all the new comprehensive fields

-- First, let's clear existing data to avoid duplicates
DELETE FROM kpi_results WHERE timestamp > NOW() - INTERVAL '7 days';

-- Insert comprehensive KPI data for all loops
INSERT INTO kpi_results (
    loop_id, 
    timestamp, 
    service_factor, 
    effective_sf, 
    sat_percent, 
    output_travel,
    pi, 
    rpi, 
    osc_index, 
    stiction,
    deadband,
    saturation,
    valve_travel,
    settling_time,
    overshoot,
    rise_time,
    peak_error,
    integral_error,
    derivative_error,
    control_error,
    valve_reversals,
    noise_level,
    process_gain,
    time_constant,
    dead_time,
    setpoint_changes,
    mode_changes
)
SELECT 
    l.id as loop_id,
    NOW() - INTERVAL '1 hour' * (random() * 168)::integer as timestamp, -- Random time in last 7 days
    -- Service Factor and related metrics (0.6-0.95 range)
    0.6 + random() * 0.35 as service_factor,
    0.6 + random() * 0.35 as effective_sf,
    random() * 0.4 as sat_percent,
    random() * 1.0 as output_travel,
    
    -- Performance Indices (0.5-0.9 range)
    0.5 + random() * 0.4 as pi,
    0.5 + random() * 0.4 as rpi,
    
    -- Oscillation and Stiction (0-0.8 range)
    random() * 0.8 as osc_index,
    random() * 0.8 as stiction,
    
    -- Control Performance Metrics
    random() * 0.2 as deadband, -- 0-20% deadband
    random() * 0.3 as saturation, -- 0-30% saturation
    random() * 1.0 as valve_travel, -- 0-100% valve travel
    30 + (random() * 300)::integer as settling_time, -- 30-330 seconds
    random() * 0.3 as overshoot, -- 0-30% overshoot
    60 + (random() * 400)::integer as rise_time, -- 60-460 seconds
    random() * 10 as peak_error, -- 0-10 peak error
    
    -- Error Analysis
    15 + random() * 60 as integral_error, -- 15-75 integral error
    random() * 4 as derivative_error, -- 0-4 derivative error
    1.0 + random() * 6 as control_error, -- 1-7 control error
    
    -- Operational Metrics
    (random() * 50)::integer as valve_reversals, -- 0-50 valve reversals
    
    -- Process Characteristics
    random() * 0.15 as noise_level, -- 0-15% noise level
    0.3 + random() * 1.7 as process_gain, -- 0.3-2.0 process gain
    30 + (random() * 200)::integer as time_constant, -- 30-230 seconds
    10 + (random() * 80)::integer as dead_time, -- 10-90 seconds
    
    -- Operational Counts
    (random() * 30)::integer as setpoint_changes, -- 0-30 setpoint changes
    (random() * 15)::integer as mode_changes -- 0-15 mode changes

FROM loops l,
     generate_series(1, 3 + (random() * 5)::integer) as record_num
WHERE l.deleted_at IS NULL;

-- Insert additional historical data for better trend analysis
INSERT INTO kpi_results (
    loop_id, 
    timestamp, 
    service_factor, 
    effective_sf, 
    sat_percent, 
    output_travel,
    pi, 
    rpi, 
    osc_index, 
    stiction,
    deadband,
    saturation,
    valve_travel,
    settling_time,
    overshoot,
    rise_time,
    peak_error,
    integral_error,
    derivative_error,
    control_error,
    valve_reversals,
    noise_level,
    process_gain,
    time_constant,
    dead_time,
    setpoint_changes,
    mode_changes
)
SELECT 
    l.id as loop_id,
    NOW() - INTERVAL '1 day' * (random() * 30)::integer as timestamp, -- Random time in last 30 days
    -- Service Factor and related metrics (0.6-0.95 range)
    0.6 + random() * 0.35 as service_factor,
    0.6 + random() * 0.35 as effective_sf,
    random() * 0.4 as sat_percent,
    random() * 1.0 as output_travel,
    
    -- Performance Indices (0.5-0.9 range)
    0.5 + random() * 0.4 as pi,
    0.5 + random() * 0.4 as rpi,
    
    -- Oscillation and Stiction (0-0.8 range)
    random() * 0.8 as osc_index,
    random() * 0.8 as stiction,
    
    -- Control Performance Metrics
    random() * 0.2 as deadband,
    random() * 0.3 as saturation,
    random() * 1.0 as valve_travel,
    30 + (random() * 300)::integer as settling_time,
    random() * 0.3 as overshoot,
    60 + (random() * 400)::integer as rise_time,
    random() * 10 as peak_error,
    
    -- Error Analysis
    15 + random() * 60 as integral_error,
    random() * 4 as derivative_error,
    1.0 + random() * 6 as control_error,
    
    -- Operational Metrics
    (random() * 50)::integer as valve_reversals,
    
    -- Process Characteristics
    random() * 0.15 as noise_level,
    0.3 + random() * 1.7 as process_gain,
    30 + (random() * 200)::integer as time_constant,
    10 + (random() * 80)::integer as dead_time,
    
    -- Operational Counts
    (random() * 30)::integer as setpoint_changes,
    (random() * 15)::integer as mode_changes

FROM loops l,
     generate_series(1, 2 + (random() * 3)::integer) as record_num
WHERE l.deleted_at IS NULL;

-- Create some loops with poor performance for testing
INSERT INTO kpi_results (
    loop_id, 
    timestamp, 
    service_factor, 
    effective_sf, 
    sat_percent, 
    output_travel,
    pi, 
    rpi, 
    osc_index, 
    stiction,
    deadband,
    saturation,
    valve_travel,
    settling_time,
    overshoot,
    rise_time,
    peak_error,
    integral_error,
    derivative_error,
    control_error,
    valve_reversals,
    noise_level,
    process_gain,
    time_constant,
    dead_time,
    setpoint_changes,
    mode_changes
)
SELECT 
    l.id as loop_id,
    NOW() - INTERVAL '2 hours' as timestamp,
    -- Poor performance metrics
    0.4 + random() * 0.2 as service_factor, -- Low service factor
    0.4 + random() * 0.2 as effective_sf,
    0.3 + random() * 0.4 as sat_percent, -- High saturation
    random() * 1.0 as output_travel,
    
    -- Poor performance indices
    0.3 + random() * 0.3 as pi, -- Low PI
    0.3 + random() * 0.3 as rpi, -- Low RPI
    
    -- High oscillation and stiction
    0.5 + random() * 0.4 as osc_index, -- High oscillation
    0.5 + random() * 0.4 as stiction, -- High stiction
    
    -- Poor control performance
    0.1 + random() * 0.2 as deadband, -- High deadband
    0.2 + random() * 0.3 as saturation, -- High saturation
    random() * 1.0 as valve_travel,
    200 + (random() * 400)::integer as settling_time, -- Long settling time
    0.2 + random() * 0.3 as overshoot, -- High overshoot
    300 + (random() * 500)::integer as rise_time, -- Long rise time
    5 + random() * 10 as peak_error, -- High peak error
    
    -- Poor error analysis
    50 + random() * 80 as integral_error, -- High integral error
    2 + random() * 4 as derivative_error, -- High derivative error
    5 + random() * 8 as control_error, -- High control error
    
    -- Poor operational metrics
    (20 + random() * 40)::integer as valve_reversals, -- High valve reversals
    
    -- Poor process characteristics
    0.1 + random() * 0.1 as noise_level, -- High noise level
    0.3 + random() * 1.7 as process_gain,
    100 + (random() * 200)::integer as time_constant, -- Long time constant
    30 + (random() * 60)::integer as dead_time, -- Long dead time
    
    -- Operational counts
    (10 + random() * 20)::integer as setpoint_changes,
    (5 + random() * 10)::integer as mode_changes

FROM loops l
WHERE l.deleted_at IS NULL
AND l.importance > 7 -- Only for high importance loops
LIMIT 3;

-- Verify the data insertion
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT loop_id) as unique_loops,
    MIN(timestamp) as earliest_record,
    MAX(timestamp) as latest_record
FROM kpi_results 
WHERE timestamp > NOW() - INTERVAL '30 days';

-- Show sample of comprehensive data
SELECT 
    l.name as loop_name,
    kr.timestamp,
    kr.service_factor,
    kr.pi,
    kr.rpi,
    kr.osc_index,
    kr.stiction,
    kr.deadband,
    kr.saturation,
    kr.valve_travel,
    kr.settling_time,
    kr.overshoot,
    kr.rise_time,
    kr.peak_error,
    kr.integral_error,
    kr.derivative_error,
    kr.control_error,
    kr.valve_reversals,
    kr.noise_level,
    kr.process_gain,
    kr.time_constant,
    kr.dead_time,
    kr.setpoint_changes,
    kr.mode_changes
FROM kpi_results kr
JOIN loops l ON kr.loop_id = l.id
WHERE kr.timestamp > NOW() - INTERVAL '1 day'
ORDER BY kr.timestamp DESC
LIMIT 5;
