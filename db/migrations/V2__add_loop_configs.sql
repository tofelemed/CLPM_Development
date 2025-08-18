-- Add loop_configs table
CREATE TABLE loop_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loop_id UUID NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
    
    -- KPI Thresholds
    sf_low DECIMAL(5,3) DEFAULT 0.8 NOT NULL,
    sf_high DECIMAL(5,3) DEFAULT 0.95 NOT NULL,
    sat_high DECIMAL(5,3) DEFAULT 0.2 NOT NULL,
    rpi_low DECIMAL(5,3) DEFAULT 0.7 NOT NULL,
    rpi_high DECIMAL(5,3) DEFAULT 0.9 NOT NULL,
    osc_limit DECIMAL(5,3) DEFAULT 0.3 NOT NULL,
    
    -- Monitoring Configuration
    kpi_window INTEGER DEFAULT 1440 NOT NULL, -- minutes
    sampling_interval INTEGER DEFAULT 200 NOT NULL, -- milliseconds
    
    -- Alarm Thresholds
    service_factor_low_alarm DECIMAL(5,3) DEFAULT 0.75 NOT NULL,
    pi_low_alarm DECIMAL(5,3) DEFAULT 0.65 NOT NULL,
    oscillation_high_alarm DECIMAL(5,3) DEFAULT 0.4 NOT NULL,
    stiction_high_alarm DECIMAL(5,3) DEFAULT 0.5 NOT NULL,
    
    -- OPC UA Integration
    connection_id VARCHAR(255),
    monitored_items JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(loop_id)
);

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_loop_configs_updated_at 
    BEFORE UPDATE ON loop_configs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_loop_configs_loop_id ON loop_configs(loop_id);
CREATE INDEX idx_loop_configs_connection_id ON loop_configs(connection_id);