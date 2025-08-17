import pino from 'pino';
import { Pool } from 'pg';

const log = pino({ name: 'ingestion-db' });

export class DatabaseService {
  constructor() {
    this.pool = null;
    this.connected = false;
  }

  async connect() {
    try {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'clpm',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      this.connected = true;
      log.info('Database connection established');
    } catch (error) {
      log.error({ error: error.message }, 'Failed to connect to database');
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      log.info('Database connection closed');
    }
  }

  async getActiveLoops() {
    try {
      const query = `
        SELECT id, name, pv_tag, op_tag, sp_tag, mode_tag, valve_tag
        FROM loops 
        WHERE deleted_at IS NULL
        ORDER BY importance DESC, created_at ASC
      `;
      
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      log.error({ error: error.message }, 'Failed to get active loops');
      throw error;
    }
  }

  async insertRawSample(sample) {
    try {
      // Use UPSERT to handle duplicate timestamps
      const query = `
        INSERT INTO raw_samples (ts, loop_id, pv, op, sp, mode, valve_position, quality_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (ts, loop_id) 
        DO UPDATE SET
          pv = EXCLUDED.pv,
          op = EXCLUDED.op,
          sp = EXCLUDED.sp,
          mode = EXCLUDED.mode,
          valve_position = EXCLUDED.valve_position,
          quality_code = EXCLUDED.quality_code,
          created_at = now()
      `;
      
      const values = [
        sample.ts,
        sample.loop_id,
        sample.pv,
        sample.op,
        sample.sp,
        sample.mode,
        sample.valve_position,
        sample.quality_code
      ];
      
      await this.pool.query(query, values);
    } catch (error) {
      log.error({ 
        loopId: sample.loop_id, 
        timestamp: sample.ts, 
        error: error.message 
      }, 'Failed to insert raw sample');
      throw error;
    }
  }

  async getLoopConfiguration(loopId) {
    try {
      const query = `
        SELECT l.*, lc.*
        FROM loops l
        LEFT JOIN loop_config lc ON l.id = lc.loop_id
        WHERE l.id = $1 AND l.deleted_at IS NULL
      `;
      
      const result = await this.pool.query(query, [loopId]);
      return result.rows[0] || null;
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to get loop configuration');
      throw error;
    }
  }

  async updateLoopConfiguration(loopId, config) {
    try {
      const query = `
        UPDATE loop_config 
        SET 
          sf_low = $1,
          sf_high = $2,
          sat_high = $3,
          rpi_low = $4,
          rpi_high = $5,
          osc_limit = $6,
          kpi_window = $7,
          updated_at = now()
        WHERE loop_id = $8
      `;
      
      const values = [
        config.sf_low,
        config.sf_high,
        config.sat_high,
        config.rpi_low,
        config.rpi_high,
        config.osc_limit,
        config.kpi_window,
        loopId
      ];
      
      await this.pool.query(query, values);
      log.info({ loopId }, 'Loop configuration updated');
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to update loop configuration');
      throw error;
    }
  }

  async getRawSamples(loopId, startTime, endTime, limit = 1000) {
    try {
      const query = `
        SELECT ts, pv, op, sp, mode, valve_position, quality_code
        FROM raw_samples
        WHERE loop_id = $1 
          AND ts >= $2 
          AND ts <= $3
        ORDER BY ts DESC
        LIMIT $4
      `;
      
      const result = await this.pool.query(query, [loopId, startTime, endTime, limit]);
      return result.rows;
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to get raw samples');
      throw error;
    }
  }

  async getAggregatedData(loopId, startTime, endTime, interval = '1m') {
    try {
      let tableName = 'agg_1m';
      let timeColumn = 'bucket';
      
      if (interval === '1h') {
        tableName = 'agg_1h';
      }
      
      const query = `
        SELECT ${timeColumn}, pv_avg, pv_min, pv_max, pv_count, op_avg, sp_avg
        FROM ${tableName}
        WHERE loop_id = $1 
          AND ${timeColumn} >= $2 
          AND ${timeColumn} <= $3
        ORDER BY ${timeColumn} DESC
      `;
      
      const result = await this.pool.query(query, [loopId, startTime, endTime]);
      return result.rows;
    } catch (error) {
      log.error({ loopId, interval, error: error.message }, 'Failed to get aggregated data');
      throw error;
    }
  }
}
