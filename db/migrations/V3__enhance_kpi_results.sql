-- Enhance kpi_results table with comprehensive performance KPIs
-- Based on frontend requirements from LoopDetail.tsx

-- Add missing columns to kpi_results table
ALTER TABLE kpi_results 
ADD COLUMN IF NOT EXISTS deadband NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS saturation NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS valve_travel NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS settling_time INTEGER,
ADD COLUMN IF NOT EXISTS overshoot NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS rise_time INTEGER,
ADD COLUMN IF NOT EXISTS peak_error NUMERIC(8,3),
ADD COLUMN IF NOT EXISTS integral_error NUMERIC(8,3),
ADD COLUMN IF NOT EXISTS derivative_error NUMERIC(8,3),
ADD COLUMN IF NOT EXISTS control_error NUMERIC(8,3),
ADD COLUMN IF NOT EXISTS valve_reversals INTEGER,
ADD COLUMN IF NOT EXISTS noise_level NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS process_gain NUMERIC(8,3),
ADD COLUMN IF NOT EXISTS time_constant INTEGER,
ADD COLUMN IF NOT EXISTS dead_time INTEGER,
ADD COLUMN IF NOT EXISTS setpoint_changes INTEGER,
ADD COLUMN IF NOT EXISTS mode_changes INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN kpi_results.deadband IS 'Deadband percentage (0-1)';
COMMENT ON COLUMN kpi_results.saturation IS 'Saturation percentage (0-1)';
COMMENT ON COLUMN kpi_results.valve_travel IS 'Valve travel percentage (0-1)';
COMMENT ON COLUMN kpi_results.settling_time IS 'Settling time in seconds';
COMMENT ON COLUMN kpi_results.overshoot IS 'Overshoot percentage (0-1)';
COMMENT ON COLUMN kpi_results.rise_time IS 'Rise time in seconds';
COMMENT ON COLUMN kpi_results.peak_error IS 'Peak error value';
COMMENT ON COLUMN kpi_results.integral_error IS 'Integral error value';
COMMENT ON COLUMN kpi_results.derivative_error IS 'Derivative error value';
COMMENT ON COLUMN kpi_results.control_error IS 'Control error value';
COMMENT ON COLUMN kpi_results.valve_reversals IS 'Number of valve reversals';
COMMENT ON COLUMN kpi_results.noise_level IS 'Noise level (0-1)';
COMMENT ON COLUMN kpi_results.process_gain IS 'Process gain value';
COMMENT ON COLUMN kpi_results.time_constant IS 'Time constant in seconds';
COMMENT ON COLUMN kpi_results.dead_time IS 'Dead time in seconds';
COMMENT ON COLUMN kpi_results.setpoint_changes IS 'Number of setpoint changes';
COMMENT ON COLUMN kpi_results.mode_changes IS 'Number of mode changes';

-- Create a comprehensive view for easy querying
CREATE OR REPLACE VIEW comprehensive_kpi_results AS
SELECT 
    kr.*,
    l.name as loop_name,
    l.description as loop_description,
    l.pv_tag,
    l.op_tag,
    l.sp_tag,
    l.importance,
    -- Calculated fields for performance summary
    (kr.service_factor + kr.pi + kr.rpi) / 3.0 as overall_performance,
    CASE 
        WHEN kr.osc_index < 0.3 AND kr.stiction < 0.3 THEN 'Good'
        ELSE 'Poor'
    END as control_quality,
    CASE 
        WHEN kr.stiction < 0.3 AND kr.valve_reversals < 15 THEN 'Good'
        ELSE 'Poor'
    END as valve_health,
    CASE 
        WHEN kr.noise_level < 0.1 AND kr.overshoot < 0.1 THEN 'Stable'
        ELSE 'Unstable'
    END as process_stability
FROM kpi_results kr
JOIN loops l ON kr.loop_id = l.id
WHERE l.deleted_at IS NULL;

-- Create indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_kpi_deadband ON kpi_results(deadband);
CREATE INDEX IF NOT EXISTS idx_kpi_saturation ON kpi_results(saturation);
CREATE INDEX IF NOT EXISTS idx_kpi_valve_travel ON kpi_results(valve_travel);
CREATE INDEX IF NOT EXISTS idx_kpi_settling_time ON kpi_results(settling_time);
CREATE INDEX IF NOT EXISTS idx_kpi_overshoot ON kpi_results(overshoot);
CREATE INDEX IF NOT EXISTS idx_kpi_rise_time ON kpi_results(rise_time);
CREATE INDEX IF NOT EXISTS idx_kpi_peak_error ON kpi_results(peak_error);
CREATE INDEX IF NOT EXISTS idx_kpi_integral_error ON kpi_results(integral_error);
CREATE INDEX IF NOT EXISTS idx_kpi_derivative_error ON kpi_results(derivative_error);
CREATE INDEX IF NOT EXISTS idx_kpi_control_error ON kpi_results(control_error);
CREATE INDEX IF NOT EXISTS idx_kpi_valve_reversals ON kpi_results(valve_reversals);
CREATE INDEX IF NOT EXISTS idx_kpi_noise_level ON kpi_results(noise_level);
CREATE INDEX IF NOT EXISTS idx_kpi_process_gain ON kpi_results(process_gain);
CREATE INDEX IF NOT EXISTS idx_kpi_time_constant ON kpi_results(time_constant);
CREATE INDEX IF NOT EXISTS idx_kpi_dead_time ON kpi_results(dead_time);
CREATE INDEX IF NOT EXISTS idx_kpi_setpoint_changes ON kpi_results(setpoint_changes);
CREATE INDEX IF NOT EXISTS idx_kpi_mode_changes ON kpi_results(mode_changes);

-- Insert sample data for testing (optional)
INSERT INTO kpi_results (
    loop_id, timestamp, service_factor, effective_sf, sat_percent, output_travel,
    pi, rpi, osc_index, stiction, deadband, saturation, valve_travel,
    settling_time, overshoot, rise_time, peak_error, integral_error,
    derivative_error, control_error, valve_reversals, noise_level,
    process_gain, time_constant, dead_time, setpoint_changes, mode_changes
) 
SELECT 
    l.id,
    NOW() - INTERVAL '1 hour' * (random() * 24)::integer,
    0.7 + random() * 0.3, -- service_factor
    0.7 + random() * 0.3, -- effective_sf
    random() * 0.4, -- sat_percent
    random() * 1.0, -- output_travel
    0.6 + random() * 0.4, -- pi
    0.6 + random() * 0.4, -- rpi
    random() * 0.8, -- osc_index
    random() * 0.7, -- stiction
    random() * 0.3, -- deadband
    random() * 0.4, -- saturation
    random() * 1.0, -- valve_travel
    30 + (random() * 300)::integer, -- settling_time
    random() * 0.4, -- overshoot
    60 + (random() * 400)::integer, -- rise_time
    random() * 15, -- peak_error
    20 + random() * 50, -- integral_error
    random() * 5, -- derivative_error
    1.0 + random() * 5, -- control_error
    (random() * 40)::integer, -- valve_reversals
    random() * 0.2, -- noise_level
    0.5 + random() * 1.5, -- process_gain
    60 + (random() * 180)::integer, -- time_constant
    20 + (random() * 60)::integer, -- dead_time
    (random() * 25)::integer, -- setpoint_changes
    (random() * 10)::integer -- mode_changes
FROM loops l
WHERE l.deleted_at IS NULL
AND NOT EXISTS (
    SELECT 1 FROM kpi_results kr 
    WHERE kr.loop_id = l.id 
    AND kr.timestamp > NOW() - INTERVAL '1 day'
)
LIMIT 50;
