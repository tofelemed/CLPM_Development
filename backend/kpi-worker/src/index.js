import 'dotenv/config';
import pino from 'pino';
import { Pool } from 'pg';
import { InfluxDBClient } from './influxClient.js';
import cron from 'node-cron';

const log = pino({ name: 'kpi-worker' });

class KPIWorkerService {
  constructor() {
    this.db = null;
    this.influxClient = null;
    this.isRunning = false;
    this.kpiWindowMinutes = parseInt(process.env.KPI_WINDOW_MIN) || 1440; // Default 24 hours
    this.cronSchedule = process.env.KPI_CRON_SCHEDULE || '*/15 * * * *'; // Every 15 minutes
    this.maxConcurrency = parseInt(process.env.KPI_MAX_CONCURRENCY) || 5;
    this.activeJobs = new Set();
  }

  async connect() {
    try {
      // Connect to PostgreSQL database
      this.db = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'clpm',
        user: process.env.DB_USER || 'clpm',
        password: process.env.DB_PASSWORD || 'clpm_pwd',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test database connection
      const client = await this.db.connect();
      await client.query('SELECT 1');
      client.release();

      // Initialize InfluxDB client
      this.influxClient = new InfluxDBClient({
        url: process.env.INFLUXDB_URL || 'http://localhost:8086',
        token: process.env.INFLUXDB_TOKEN || 'o6cjAfkS_jFCvEePxDyz33zMQaJgbbSz_oqkSPzMTbROImhLlwDHwh8la4VMkMyNJsHWrVYs_JEHpWZGtFeaDw==',
        org: process.env.INFLUXDB_ORG || 'clpm',
        bucket: process.env.INFLUXDB_BUCKET || 'clpm_data',
        measurement: process.env.INFLUXDB_MEASUREMENT || 'control_loops'
      });

      // Test InfluxDB connection
      const influxConnected = await this.influxClient.testConnection();
      if (!influxConnected) {
        throw new Error('Failed to connect to InfluxDB');
      }

      log.info('KPI worker connected to PostgreSQL and InfluxDB');
    } catch (error) {
      log.error({ error: error.message }, 'Failed to connect to services');
      throw error;
    }
  }

  async initializeLoopConfigs() {
    try {
      // Get all active loops
      const loopsQuery = `
        SELECT loop_id, name
        FROM loops
        WHERE deleted_at IS NULL
      `;
      const loopsResult = await this.db.query(loopsQuery);
      const loops = loopsResult.rows;

      // Get existing loop configs
      const configsQuery = `SELECT loop_id FROM loop_configs`;
      const configsResult = await this.db.query(configsQuery);
      const existingConfigs = new Set(configsResult.rows.map(r => r.loop_id));

      // Find loops without configs
      const missingConfigs = loops.filter(loop => !existingConfigs.has(loop.loop_id));

      if (missingConfigs.length > 0) {
        log.info({ count: missingConfigs.length, loops: missingConfigs.map(l => l.loop_id) },
          'Found loops without configurations, creating default configs');

        // Insert default configs for missing loops
        const insertQuery = `
          INSERT INTO loop_configs (
            loop_id, sf_low, sf_high, sat_high, rpi_low, rpi_high,
            osc_limit, kpi_window, sampling_interval,
            service_factor_low_alarm, pi_low_alarm,
            oscillation_high_alarm, stiction_high_alarm
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;

        for (const loop of missingConfigs) {
          try {
            await this.db.query(insertQuery, [
              loop.loop_id,
              0.8,   // sf_low
              0.95,  // sf_high
              0.2,   // sat_high
              0.7,   // rpi_low
              0.9,   // rpi_high
              0.3,   // osc_limit
              1440,  // kpi_window (24 hours in minutes)
              200,   // sampling_interval (milliseconds)
              0.75,  // service_factor_low_alarm
              0.65,  // pi_low_alarm
              0.4,   // oscillation_high_alarm
              0.5    // stiction_high_alarm
            ]);
            log.info({ loopId: loop.loop_id, name: loop.name }, 'Created default configuration for loop');
          } catch (error) {
            log.error({ loopId: loop.loop_id, error: error.message }, 'Failed to create default config');
          }
        }

        log.info({ created: missingConfigs.length }, 'Loop configuration initialization completed');
      } else {
        log.info('All loops have configurations');
      }

      // Verify consistency
      const finalCount = await this.db.query('SELECT COUNT(*) as count FROM loop_configs');
      log.info({
        totalLoops: loops.length,
        totalConfigs: parseInt(finalCount.rows[0].count)
      }, 'Loop configuration status');

    } catch (error) {
      log.error({ error: error.message }, 'Failed to initialize loop configurations');
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
    const jobId = `kpi-${loop.loop_id}-${Date.now()}`;

    if (this.activeJobs.has(jobId)) {
      log.warn({ loopId: loop.loop_id }, 'KPI calculation already in progress for loop');
      return;
    }

    this.activeJobs.add(jobId);

    try {
      log.info({ loopId: loop.loop_id, name: loop.name }, 'Starting KPI calculation');

      // Get analysis window
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (this.kpiWindowMinutes * 60 * 1000));

      // Get loop configuration
      const config = await this.getLoopConfiguration(loop.loop_id);

      // Always get data from InfluxDB (aggregated data lacks mode field)
      const data = await this.getInfluxDBData(loop.loop_id, startTime, endTime);

      if (data.length === 0) {
        log.warn({ loopId: loop.loop_id }, 'No data available for KPI calculation');
        await this.insertEmptyKPIResult(loop.loop_id, endTime);
        return;
      }

      log.info({ loopId: loop.loop_id, dataPoints: data.length }, 'Retrieved data for KPI calculation');

      // Calculate KPIs
      const kpis = this.calculateKPIs(data, config, loop);

      // Store KPI results
      await this.insertKPIResult(loop.loop_id, endTime, kpis);

      log.info({ loopId: loop.loop_id, kpis }, 'KPI calculation completed successfully');

    } catch (error) {
      log.error({ loopId: loop.loop_id, error: error.message, stack: error.stack }, 'KPI calculation failed');

      // Insert error result
      try {
        await this.insertErrorKPIResult(loop.loop_id, new Date(), error.message);
      } catch (insertError) {
        log.error({ loopId: loop.loop_id, error: insertError.message }, 'Failed to insert error KPI result');
      }
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  calculateKPIs(data, config, loop) {
    try {
      // Filter valid data
      const validData = data.filter(d =>
        d.pv !== null && d.op !== null && d.sp !== null &&
        d.quality_code === 192 // Good quality
      );

      if (validData.length === 0) {
        log.warn({ loopId: loop.loop_id }, 'No valid data for KPI calculation');
        return this.getEmptyKPIs();
      }

      // Sort by timestamp
      validData.sort((a, b) => new Date(a.ts) - new Date(b.ts));

      log.debug({ loopId: loop.loop_id, validDataCount: validData.length }, 'Processing valid data');

      // Calculate basic statistics
      const pvValues = validData.map(d => d.pv);
      const opValues = validData.map(d => d.op);
      const spValues = validData.map(d => d.sp);
      const modes = validData.map(d => d.mode);
      const valveValues = validData.filter(d => d.valve_position !== null).map(d => d.valve_position);

      // Service Factor - percentage of time in auto mode
      const autoModeCount = modes.filter(m =>
        m && (m.toString().toUpperCase().includes('AUT') || m.toString().toUpperCase().includes('CAS'))
      ).length;
      const serviceFactor = validData.length > 0 ? autoModeCount / validData.length : 0;

      // Saturation Analysis
      const opMin = Math.min(...opValues);
      const opMax = Math.max(...opValues);
      const opRange = opMax - opMin || 1; // Avoid division by zero
      const saturationThreshold = 5; // 5% from limits (0-100 scale)
      const saturatedCount = opValues.filter(op =>
        op <= saturationThreshold || op >= (100 - saturationThreshold)
      ).length;
      const saturationPercentage = validData.length > 0 ? saturatedCount / validData.length : 0;

      // Effective Service Factor
      const effectiveServiceFactor = serviceFactor * (1 - saturationPercentage);

      // Output Travel
      let outputTravel = 0;
      for (let i = 1; i < opValues.length; i++) {
        outputTravel += Math.abs(opValues[i] - opValues[i - 1]);
      }

      // Valve Travel (if valve position data available)
      let valveTravel = null;
      if (valveValues.length > 1) {
        valveTravel = 0;
        for (let i = 1; i < valveValues.length; i++) {
          valveTravel += Math.abs(valveValues[i] - valveValues[i - 1]);
        }
      }

      // Valve Reversals
      let valveReversals = 0;
      if (opValues.length > 2) {
        for (let i = 2; i < opValues.length; i++) {
          const prevDiff = opValues[i - 1] - opValues[i - 2];
          const currDiff = opValues[i] - opValues[i - 1];
          if ((prevDiff > 0 && currDiff < 0) || (prevDiff < 0 && currDiff > 0)) {
            valveReversals++;
          }
        }
      }

      // Performance Index (PI)
      const pvMean = pvValues.reduce((a, b) => a + b, 0) / pvValues.length;
      const spMean = spValues.reduce((a, b) => a + b, 0) / spValues.length;

      const pvVariance = pvValues.reduce((sum, val) => sum + Math.pow(val - pvMean, 2), 0) / pvValues.length;
      const errorVariance = validData.reduce((sum, d) => sum + Math.pow(d.pv - d.sp, 2), 0) / validData.length;

      const pi = pvVariance > 0 ? Math.max(0, Math.min(1, 1 - (errorVariance / pvVariance))) : 0;

      // Relative Performance Index
      const rpi = pi * serviceFactor;

      // Oscillation Index (first-lag autocorrelation of PV)
      let oscillationIndex = 0;
      if (pvValues.length > 1) {
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

      // Stiction Severity (cross-correlation between OP and PV changes)
      let stictionSeverity = 0;
      if (opValues.length > 1 && pvValues.length > 1) {
        const opMean = opValues.reduce((a, b) => a + b, 0) / opValues.length;
        const maxLag = Math.min(10, Math.floor(opValues.length / 2));
        let maxCorrelation = 0;

        for (let lag = 1; lag <= maxLag; lag++) {
          let numerator = 0;
          let opDenom = 0;
          let pvDenom = 0;
          let count = 0;

          for (let i = lag; i < opValues.length && i < pvValues.length; i++) {
            const opDiff = opValues[i] - opMean;
            const pvDiff = pvValues[i - lag] - pvMean;
            numerator += opDiff * pvDiff;
            opDenom += opDiff * opDiff;
            pvDenom += pvDiff * pvDiff;
            count++;
          }

          if (count > 0 && opDenom > 0 && pvDenom > 0) {
            const correlation = Math.abs(numerator / Math.sqrt(opDenom * pvDenom));
            maxCorrelation = Math.max(maxCorrelation, correlation);
          }
        }

        stictionSeverity = maxCorrelation;
      }

      // Deadband Detection
      const opChanges = [];
      for (let i = 1; i < opValues.length; i++) {
        const change = Math.abs(opValues[i] - opValues[i - 1]);
        if (change > 0) opChanges.push(change);
      }
      const deadband = opChanges.length > 0 ? Math.min(...opChanges) : null;

      // Control Error Metrics
      const errors = validData.map(d => d.sp - d.pv);
      const peakError = errors.length > 0 ? Math.max(...errors.map(Math.abs)) : null;
      const integralError = errors.reduce((sum, e) => sum + Math.abs(e), 0) / errors.length;

      // Derivative of error
      const errorDerivatives = [];
      for (let i = 1; i < errors.length; i++) {
        errorDerivatives.push(Math.abs(errors[i] - errors[i - 1]));
      }
      const derivativeError = errorDerivatives.length > 0
        ? errorDerivatives.reduce((a, b) => a + b, 0) / errorDerivatives.length
        : null;

      // Control Error (RMS)
      const controlError = Math.sqrt(errorVariance);

      // Noise Level (high-frequency variation in PV)
      let noiseLevel = 0;
      if (pvValues.length > 2) {
        const secondDerivatives = [];
        for (let i = 2; i < pvValues.length; i++) {
          const secondDeriv = Math.abs((pvValues[i] - 2 * pvValues[i - 1] + pvValues[i - 2]));
          secondDerivatives.push(secondDeriv);
        }
        noiseLevel = secondDerivatives.length > 0
          ? secondDerivatives.reduce((a, b) => a + b, 0) / secondDerivatives.length
          : 0;
      }

      // Setpoint Changes
      let setpointChanges = 0;
      const spChangeThreshold = 0.5; // Minimum change to count as setpoint change
      for (let i = 1; i < spValues.length; i++) {
        if (Math.abs(spValues[i] - spValues[i - 1]) > spChangeThreshold) {
          setpointChanges++;
        }
      }

      // Mode Changes
      let modeChanges = 0;
      for (let i = 1; i < modes.length; i++) {
        if (modes[i] !== modes[i - 1]) {
          modeChanges++;
        }
      }

      const result = {
        service_factor: this.roundToDecimals(serviceFactor, 6),
        effective_sf: this.roundToDecimals(effectiveServiceFactor, 6),
        sat_percent: this.roundToDecimals(saturationPercentage, 6),
        saturation: this.roundToDecimals(saturationPercentage, 6), // Alias
        output_travel: this.roundToDecimals(outputTravel, 3),
        valve_travel: valveTravel !== null ? this.roundToDecimals(valveTravel, 6) : null,
        valve_reversals: valveReversals,
        pi: this.roundToDecimals(pi, 6),
        rpi: this.roundToDecimals(rpi, 6),
        osc_index: this.roundToDecimals(oscillationIndex, 6),
        stiction: this.roundToDecimals(stictionSeverity, 6),
        deadband: deadband !== null ? this.roundToDecimals(deadband, 6) : null,
        peak_error: peakError !== null ? this.roundToDecimals(peakError, 3) : null,
        integral_error: this.roundToDecimals(integralError, 3),
        derivative_error: derivativeError !== null ? this.roundToDecimals(derivativeError, 3) : null,
        control_error: this.roundToDecimals(controlError, 3),
        noise_level: this.roundToDecimals(noiseLevel, 6),
        setpoint_changes: setpointChanges,
        mode_changes: modeChanges,
        // Additional metrics set to null for now (require more complex analysis)
        settling_time: null,
        overshoot: null,
        rise_time: null,
        process_gain: null,
        time_constant: null,
        dead_time: null
      };

      return result;

    } catch (error) {
      log.error({ error: error.message, stack: error.stack }, 'Error calculating KPIs');
      return this.getEmptyKPIs();
    }
  }

  roundToDecimals(value, decimals) {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }

  getEmptyKPIs() {
    return {
      service_factor: null,
      effective_sf: null,
      sat_percent: null,
      saturation: null,
      output_travel: null,
      valve_travel: null,
      valve_reversals: null,
      pi: null,
      rpi: null,
      osc_index: null,
      stiction: null,
      deadband: null,
      settling_time: null,
      overshoot: null,
      rise_time: null,
      peak_error: null,
      integral_error: null,
      derivative_error: null,
      control_error: null,
      noise_level: null,
      process_gain: null,
      time_constant: null,
      dead_time: null,
      setpoint_changes: null,
      mode_changes: null
    };
  }

  async getActiveLoops() {
    try {
      const query = `
        SELECT loop_id, name, pv_tag, op_tag, sp_tag, mode_tag, valve_tag, importance
        FROM loops
        WHERE deleted_at IS NULL AND active = true
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
        FROM loop_configs lc
        WHERE lc.loop_id = $1
      `;

      const result = await this.db.query(query, [loopId]);
      return result.rows[0] || {};
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to get loop configuration');
      return {};
    }
  }

  async getInfluxDBData(loopId, startTime, endTime) {
    try {
      // Query raw data from InfluxDB
      const data = await this.influxClient.queryData(
        loopId,
        startTime.toISOString(),
        endTime.toISOString()
      );

      return data;
    } catch (error) {
      log.error({ loopId, error: error.message, stack: error.stack }, 'Failed to get InfluxDB data');
      return [];
    }
  }

  async insertKPIResult(loopId, timestamp, kpis) {
    try {
      const query = `
        INSERT INTO kpi_results (
          loop_id, timestamp, service_factor, effective_sf,
          sat_percent, saturation, output_travel, valve_travel, valve_reversals,
          pi, rpi, osc_index, stiction, deadband,
          settling_time, overshoot, rise_time,
          peak_error, integral_error, derivative_error, control_error,
          noise_level, process_gain, time_constant, dead_time,
          setpoint_changes, mode_changes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      `;

      const values = [
        loopId,
        timestamp,
        kpis.service_factor,
        kpis.effective_sf,
        kpis.sat_percent,
        kpis.saturation,
        kpis.output_travel,
        kpis.valve_travel,
        kpis.valve_reversals,
        kpis.pi,
        kpis.rpi,
        kpis.osc_index,
        kpis.stiction,
        kpis.deadband,
        kpis.settling_time,
        kpis.overshoot,
        kpis.rise_time,
        kpis.peak_error,
        kpis.integral_error,
        kpis.derivative_error,
        kpis.control_error,
        kpis.noise_level,
        kpis.process_gain,
        kpis.time_constant,
        kpis.dead_time,
        kpis.setpoint_changes,
        kpis.mode_changes
      ];

      await this.db.query(query, values);

      log.debug({ loopId, timestamp, kpis }, 'KPI result inserted successfully');
    } catch (error) {
      log.error({ loopId, error: error.message, stack: error.stack }, 'Failed to insert KPI result');
      throw error;
    }
  }

  async insertEmptyKPIResult(loopId, timestamp) {
    try {
      const emptyKpis = this.getEmptyKPIs();
      await this.insertKPIResult(loopId, timestamp, emptyKpis);

      log.info({ loopId, timestamp }, 'Empty KPI result inserted (no data available)');
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to insert empty KPI result');
    }
  }

  async insertErrorKPIResult(loopId, timestamp, errorMessage) {
    try {
      const emptyKpis = this.getEmptyKPIs();
      await this.insertKPIResult(loopId, timestamp, emptyKpis);

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

      if (this.influxClient) {
        await this.influxClient.close();
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
    await kpiWorker.initializeLoopConfigs();
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
