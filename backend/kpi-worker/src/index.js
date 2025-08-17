import 'dotenv/config';
import pino from 'pino';
import { Pool } from 'pg';
import { createChannel } from './rabbit.js';
import cron from 'node-cron';

const log = pino({ name: 'kpi-worker' });

class KPIWorkerService {
  constructor() {
    this.db = null;
    this.rabbitChannel = null;
    this.isRunning = false;
    this.kpiWindowMinutes = parseInt(process.env.KPI_WINDOW_MIN) || 1440; // Default 24 hours
    this.cronSchedule = process.env.KPI_CRON_SCHEDULE || '*/15 * * * *'; // Every 15 minutes
    this.maxConcurrency = parseInt(process.env.KPI_MAX_CONCURRENCY) || 5;
    this.activeJobs = new Set();
  }

  async connect() {
    try {
      // Connect to database
      this.db = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'clpm',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test database connection
      const client = await this.db.connect();
      await client.query('SELECT 1');
      client.release();

      // Connect to RabbitMQ
      this.rabbitChannel = await createChannel(
        process.env.RABBITMQ_URL || 'amqp://localhost',
        process.env.RABBITMQ_EXCHANGE || 'clpm'
      );

      log.info('KPI worker connected to database and RabbitMQ');
    } catch (error) {
      log.error({ error: error.message }, 'Failed to connect to services');
      throw error;
    }
  }

  async startScheduler() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Schedule KPI calculations
    cron.schedule(this.cronSchedule, async () => {
      try {
        await this.calculateAllLoopKPIs();
      } catch (error) {
        log.error({ error: error.message }, 'Scheduled KPI calculation failed');
      }
    });
    
    log.info({ schedule: this.cronSchedule }, 'KPI scheduler started');
  }

  async stopScheduler() {
    if (this.cronSchedule) {
      cron.getTasks().forEach(task => task.stop());
    }
    this.isRunning = false;
    log.info('KPI scheduler stopped');
  }

  async calculateAllLoopKPIs() {
    try {
      log.info('Starting KPI calculation for all loops');
      
      // Get all active loops
      const loops = await this.getActiveLoops();
      log.info({ count: loops.length }, 'Found active loops for KPI calculation');
      
      // Calculate KPIs for each loop with concurrency control
      const chunks = this.chunkArray(loops, this.maxConcurrency);
      
      for (const chunk of chunks) {
        const promises = chunk.map(loop => this.calculateLoopKPI(loop));
        await Promise.allSettled(promises);
      }
      
      log.info('KPI calculation completed for all loops');
    } catch (error) {
      log.error({ error: error.message }, 'Failed to calculate KPIs for all loops');
      throw error;
    }
  }

  async calculateLoopKPI(loop) {
    const jobId = `kpi-${loop.id}-${Date.now()}`;
    
    if (this.activeJobs.has(jobId)) {
      log.warn({ loopId: loop.id }, 'KPI calculation already in progress for loop');
      return;
    }
    
    this.activeJobs.add(jobId);
    
    try {
      log.info({ loopId: loop.id, name: loop.name }, 'Starting KPI calculation');
      
      // Get analysis window
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (this.kpiWindowMinutes * 60 * 1000));
      
      // Get loop configuration
      const config = await this.getLoopConfiguration(loop.id);
      
      // Get data for analysis window
      const data = await this.getAnalysisData(loop.id, startTime, endTime);
      
      if (data.length === 0) {
        log.warn({ loopId: loop.id }, 'No data available for KPI calculation');
        await this.insertEmptyKPIResult(loop.id, endTime);
        return;
      }
      
      // Calculate KPIs
      const kpis = this.calculateKPIs(data, config);
      
      // Store KPI results
      await this.insertKPIResult(loop.id, endTime, kpis);
      
      log.info({ loopId: loop.id, kpis }, 'KPI calculation completed successfully');
      
    } catch (error) {
      log.error({ loopId: loop.id, error: error.message }, 'KPI calculation failed');
      
      // Insert error result
      try {
        await this.insertErrorKPIResult(loop.id, new Date(), error.message);
      } catch (insertError) {
        log.error({ loopId: loop.id, error: insertError.message }, 'Failed to insert error KPI result');
      }
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  calculateKPIs(data, config) {
    try {
      // Filter valid data
      const validData = data.filter(d => 
        d.pv !== null && d.op !== null && d.sp !== null && 
        d.quality_code === 192 // Good quality
      );
      
      if (validData.length === 0) {
        return this.getEmptyKPIs();
      }
      
      // Sort by timestamp
      validData.sort((a, b) => new Date(a.ts) - new Date(b.ts));
      
      // Calculate basic statistics
      const pvValues = validData.map(d => d.pv);
      const opValues = validData.map(d => d.op);
      const spValues = validData.map(d => d.sp);
      const modes = validData.map(d => d.mode);
      
      // Service Factor
      const autoModeCount = modes.filter(m => 
        m && (m.toString().toUpperCase().includes('AUTO') || m.toString().toUpperCase().includes('CASCADE'))
      ).length;
      const serviceFactor = validData.length > 0 ? autoModeCount / validData.length : 0;
      
      // Saturation Percentage
      const opMin = Math.min(...opValues);
      const opMax = Math.max(...opValues);
      const opRange = opMax - opMin;
      const saturationThreshold = opRange * 0.05; // 5% of range
      const saturatedCount = opValues.filter(op => 
        Math.abs(op - opMin) <= saturationThreshold || Math.abs(op - opMax) <= saturationThreshold
      ).length;
      const saturationPercentage = validData.length > 0 ? saturatedCount / validData.length : 0;
      
      // Effective Service Factor
      const effectiveServiceFactor = serviceFactor * (1 - saturationPercentage);
      
      // Output Travel
      let outputTravel = 0;
      for (let i = 1; i < opValues.length; i++) {
        outputTravel += Math.abs(opValues[i] - opValues[i - 1]);
      }
      
      // Performance Index (PI) - Simplified calculation
      const pvMean = pvValues.reduce((a, b) => a + b, 0) / pvValues.length;
      const spMean = spValues.reduce((a, b) => a + b, 0) / spValues.length;
      
      const pvVariance = pvValues.reduce((sum, val) => sum + Math.pow(val - pvMean, 2), 0) / pvValues.length;
      const errorVariance = validData.reduce((sum, d) => sum + Math.pow(d.pv - d.sp, 2), 0) / validData.length;
      
      const pi = pvVariance > 0 ? 1 - (errorVariance / pvVariance) : 0;
      
      // Relative Performance Index
      const rpi = pi * serviceFactor;
      
      // Oscillation Index (first-lag autocorrelation of PV)
      let oscillationIndex = 0;
      if (pvValues.length > 1) {
        const pvMean = pvValues.reduce((a, b) => a + b, 0) / pvValues.length;
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 1; i < pvValues.length; i++) {
          const diff1 = pvValues[i] - pvMean;
          const diff2 = pvValues[i - 1] - pvMean;
          numerator += diff1 * diff2;
          denominator += diff1 * diff1;
        }
        
        oscillationIndex = denominator > 0 ? Math.abs(numerator / denominator) : 0;
      }
      
      // Stiction Severity (simplified cross-correlation)
      let stictionSeverity = 0;
      if (opValues.length > 1 && pvValues.length > 1) {
        const maxLag = Math.min(10, Math.floor(opValues.length / 2));
        let maxCorrelation = 0;
        
        for (let lag = 1; lag <= maxLag; lag++) {
          let correlation = 0;
          let count = 0;
          
          for (let i = lag; i < opValues.length; i++) {
            if (i < pvValues.length) {
              correlation += opValues[i] * pvValues[i - lag];
              count++;
            }
          }
          
          if (count > 0) {
            correlation = Math.abs(correlation / count);
            maxCorrelation = Math.max(maxCorrelation, correlation);
          }
        }
        
        stictionSeverity = maxCorrelation;
      }
      
      return {
        service_factor: Math.round(serviceFactor * 1000) / 1000,
        effective_sf: Math.round(effectiveServiceFactor * 1000) / 1000,
        sat_percent: Math.round(saturationPercentage * 1000) / 1000,
        output_travel: Math.round(outputTravel * 1000) / 1000,
        pi: Math.round(pi * 1000) / 1000,
        rpi: Math.round(rpi * 1000) / 1000,
        osc_index: Math.round(oscillationIndex * 1000) / 1000,
        stiction: Math.round(stictionSeverity * 1000) / 1000
      };
      
    } catch (error) {
      log.error({ error: error.message }, 'Error calculating KPIs');
      return this.getEmptyKPIs();
    }
  }

  getEmptyKPIs() {
    return {
      service_factor: null,
      effective_sf: null,
      sat_percent: null,
      output_travel: null,
      pi: null,
      rpi: null,
      osc_index: null,
      stiction: null
    };
  }

  async getActiveLoops() {
    try {
      const query = `
        SELECT id, name, pv_tag, op_tag, sp_tag, mode_tag, valve_tag
        FROM loops 
        WHERE deleted_at IS NULL
        ORDER BY importance DESC, created_at ASC
      `;
      
      const result = await this.db.query(query);
      return result.rows;
    } catch (error) {
      log.error({ error: error.message }, 'Failed to get active loops');
      throw error;
    }
  }

  async getLoopConfiguration(loopId) {
    try {
      const query = `
        SELECT lc.*
        FROM loop_config lc
        WHERE lc.loop_id = $1
      `;
      
      const result = await this.db.query(query, [loopId]);
      return result.rows[0] || {};
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to get loop configuration');
      return {};
    }
  }

  async getAnalysisData(loopId, startTime, endTime) {
    try {
      // Try to get aggregated data first for efficiency
      let data = await this.getAggregatedData(loopId, startTime, endTime);
      
      // If not enough aggregated data, fall back to raw samples
      if (data.length < 10) {
        data = await this.getRawSamples(loopId, startTime, endTime);
      }
      
      return data;
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to get analysis data');
      return [];
    }
  }

  async getAggregatedData(loopId, startTime, endTime) {
    try {
      const query = `
        SELECT bucket as ts, pv_avg as pv, op_avg as op, sp_avg as sp, 
               pv_count, pv_min, pv_max
        FROM agg_1m
        WHERE loop_id = $1 
          AND bucket >= $2 
          AND bucket <= $3
        ORDER BY bucket ASC
      `;
      
      const result = await this.db.query(query, [loopId, startTime, endTime]);
      return result.rows;
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to get aggregated data');
      return [];
    }
  }

  async getRawSamples(loopId, startTime, endTime) {
    try {
      const query = `
        SELECT ts, pv, op, sp, mode, valve_position, quality_code
        FROM raw_samples
        WHERE loop_id = $1 
          AND ts >= $2 
          AND ts <= $3
        ORDER BY ts ASC
      `;
      
      const result = await this.db.query(query, [loopId, startTime, endTime]);
      return result.rows;
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to get raw samples');
      return [];
    }
  }

  async insertKPIResult(loopId, timestamp, kpis) {
    try {
      const query = `
        INSERT INTO kpi_results (loop_id, timestamp, service_factor, effective_sf, 
                                sat_percent, output_travel, pi, rpi, osc_index, stiction)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      const values = [
        loopId,
        timestamp,
        kpis.service_factor,
        kpis.effective_sf,
        kpis.sat_percent,
        kpis.output_travel,
        kpis.pi,
        kpis.rpi,
        kpis.osc_index,
        kpis.stiction
      ];
      
      await this.db.query(query, values);
      
      log.debug({ loopId, timestamp, kpis }, 'KPI result inserted successfully');
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to insert KPI result');
      throw error;
    }
  }

  async insertEmptyKPIResult(loopId, timestamp) {
    try {
      const query = `
        INSERT INTO kpi_results (loop_id, timestamp, service_factor, effective_sf, 
                                sat_percent, output_travel, pi, rpi, osc_index, stiction)
        VALUES ($1, $2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
      `;
      
      await this.db.query(query, [loopId, timestamp]);
      
      log.info({ loopId, timestamp }, 'Empty KPI result inserted (no data available)');
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to insert empty KPI result');
    }
  }

  async insertErrorKPIResult(loopId, timestamp, errorMessage) {
    try {
      const query = `
        INSERT INTO kpi_results (loop_id, timestamp, service_factor, effective_sf, 
                                sat_percent, output_travel, pi, rpi, osc_index, stiction)
        VALUES ($1, $2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
      `;
      
      await this.db.query(query, [loopId, timestamp]);
      
      log.info({ loopId, timestamp, errorMessage }, 'Error KPI result inserted');
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to insert error KPI result');
    }
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async disconnect() {
    try {
      await this.stopScheduler();
      
      if (this.rabbitChannel) {
        await this.rabbitChannel.close();
      }
      
      if (this.db) {
        await this.db.end();
      }
      
      log.info('KPI worker disconnected');
    } catch (error) {
      log.error({ error: error.message }, 'Error during disconnect');
    }
  }
}

// Main execution
const kpiWorker = new KPIWorkerService();

(async () => {
  try {
    await kpiWorker.connect();
    await kpiWorker.startScheduler();
    
    log.info('KPI worker started successfully');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      log.info('Shutting down KPI worker...');
      await kpiWorker.disconnect();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      log.info('Shutting down KPI worker...');
      await kpiWorker.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    log.error({ error: error.message }, 'Failed to start KPI worker');
    process.exit(1);
  }
})().catch(error => {
  log.error({ error: error.message }, 'KPI worker startup failed');
  process.exit(1);
});
