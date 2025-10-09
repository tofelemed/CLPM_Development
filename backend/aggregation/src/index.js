import 'dotenv/config';
import pino from 'pino';
import { Pool } from 'pg';
import { InfluxDBClient } from './influxClient.js';

const log = pino({ name: 'aggregation-service' });

class AggregationService {
  constructor() {
    this.db = null;
    this.influxClient = null;
    this.aggregationIntervals = {
      '1m': 60 * 1000,      // 1 minute
      '1h': 60 * 60 * 1000  // 1 hour
    };
    this.activeLoops = new Map();
    this.isRunning = false;
    this.pollingInterval = null;
  }

  async connect() {
    try {
      // Connect to PostgreSQL database
      this.db = new Pool({
        host: process.env.DB_HOST || 'postgres',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'clpm',
        user: process.env.DB_USER || 'clpm',
        password: process.env.DB_PASSWORD || 'clpm_pwd',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test database connection
      const client = await this.db.connect();
      await client.query('SELECT 1');
      client.release();

      // Initialize InfluxDB client
      this.influxClient = new InfluxDBClient({
        url: process.env.INFLUXDB_URL || 'http://influxdb:8086/',
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

      log.info('Aggregation service connected to PostgreSQL and InfluxDB');
    } catch (error) {
      log.error({ error: error.message }, 'Failed to connect to services');
      throw error;
    }
  }

  async initializeLoops() {
    try {
      const loops = await this.getActiveLoops();
      for (const loop of loops) {
        this.activeLoops.set(loop.loop_id, loop);
      }
      log.info({ count: loops.length, activeCount: this.activeLoops.size }, 'Initialized loops from database');
    } catch (error) {
      log.error({ error: error.message }, 'Failed to initialize loops from database');
    }
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

  async startPolling() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Poll InfluxDB every 30 seconds for new data
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollInfluxDBData();
      } catch (error) {
        log.error({ error: error.message }, 'Polling InfluxDB failed');
      }
    }, 30000); // 30 seconds
    
    log.info('Started polling InfluxDB for data');
  }

  async stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isRunning = false;
    log.info('Stopped polling InfluxDB');
  }

  async pollInfluxDBData() {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // Query last 5 minutes

      log.info({ loopCount: this.activeLoops.size }, 'Polling InfluxDB for new data');

      for (const [loopId, loop] of this.activeLoops) {
        try {
          // Query recent data from InfluxDB
          const data = await this.influxClient.queryData(
            loop.loop_id, // Use loop_id from the loop object
            fiveMinutesAgo.toISOString(),
            now.toISOString()
          );

          log.info({ loopId: loop.loop_id, dataPoints: data.length }, 'Retrieved data from InfluxDB');

          if (data.length > 0) {
            // Process and aggregate the data
            await this.processInfluxDBData(loop.loop_id, data);
          } else {
            log.debug({ loopId: loop.loop_id }, 'No data found for loop in this interval');
          }
        } catch (error) {
          log.error({ loopId, error: error.message }, 'Failed to poll data for loop');
        }
      }
    } catch (error) {
      log.error({ error: error.message }, 'Failed to poll InfluxDB data');
    }
  }

  async processInfluxDBData(loopId, data) {
    try {
      // Group data by time buckets
      const buckets = this.groupDataByBuckets(data);
      
      // Process each bucket
      for (const [bucketKey, bucketData] of buckets) {
        await this.processBucket(loopId, bucketData);
      }
      
      log.debug({ loopId, dataCount: data.length, bucketCount: buckets.size }, 'Processed InfluxDB data');
    } catch (error) {
      log.error({ loopId, error: error.message }, 'Failed to process InfluxDB data');
    }
  }

  groupDataByBuckets(data) {
    const buckets = new Map();
    
    for (const sample of data) {
      // Create 1-minute buckets
      const bucketTime = this.getBucketTimestamp(sample.ts, this.aggregationIntervals['1m']);
      const bucketKey = bucketTime.toISOString();
      
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          bucket: bucketTime,
          loop_id: sample.loop_id,
          pv_values: [],
          op_values: [],
          sp_values: [],
          mode_values: [],
          valve_values: [],
          count: 0
        });
      }
      
      const bucket = buckets.get(bucketKey);
      
      if (sample.pv !== null) bucket.pv_values.push(sample.pv);
      if (sample.op !== null) bucket.op_values.push(sample.op);
      if (sample.sp !== null) bucket.sp_values.push(sample.sp);
      if (sample.mode !== null) bucket.mode_values.push(sample.mode);
      if (sample.valve_position !== null) bucket.valve_values.push(sample.valve_position);
      bucket.count++;
    }
    
    return buckets;
  }

  getBucketTimestamp(timestamp, intervalMs) {
    const date = new Date(timestamp);
    const bucketTime = new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
    return bucketTime;
  }

  async processBucket(loopId, bucketData) {
    try {
      const { bucket, pv_values, op_values, sp_values, count } = bucketData;
      
      if (count === 0) return;
      
      // Calculate aggregates
      const pv_avg = pv_values.length > 0 ? pv_values.reduce((a, b) => a + b, 0) / pv_values.length : null;
      const pv_min = pv_values.length > 0 ? Math.min(...pv_values) : null;
      const pv_max = pv_values.length > 0 ? Math.max(...pv_values) : null;
      
      const op_avg = op_values.length > 0 ? op_values.reduce((a, b) => a + b, 0) / op_values.length : null;
      const sp_avg = sp_values.length > 0 ? sp_values.reduce((a, b) => a + b, 0) / sp_values.length : null;
      
      // Store aggregated data in PostgreSQL
      await this.storeAggregatedData(loopId, bucket, {
        pv_avg,
        pv_min,
        pv_max,
        pv_count: count,
        op_avg,
        sp_avg
      });
      
      log.debug({ 
        loopId, 
        bucket: bucket.toISOString(), 
        count,
        pv_avg,
        op_avg,
        sp_avg
      }, 'Bucket processed and stored');
      
    } catch (error) {
      log.error({ 
        loopId, 
        bucket: bucketData.bucket, 
        error: error.message 
      }, 'Failed to process bucket');
      throw error;
    }
  }

  async storeAggregatedData(loopId, bucket, aggregates) {
    try {
      const query = `
        INSERT INTO agg_1m (bucket, loop_id, pv_avg, pv_min, pv_max, pv_count, op_avg, sp_avg)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (bucket, loop_id) 
        DO UPDATE SET
          pv_avg = EXCLUDED.pv_avg,
          pv_min = EXCLUDED.pv_min,
          pv_max = EXCLUDED.pv_max,
          pv_count = EXCLUDED.pv_count,
          op_avg = EXCLUDED.op_avg,
          sp_avg = EXCLUDED.sp_avg,
          created_at = now()
      `;
      
      const values = [
        bucket,
        loopId,
        aggregates.pv_avg,
        aggregates.pv_min,
        aggregates.pv_max,
        aggregates.pv_count,
        aggregates.op_avg,
        aggregates.sp_avg
      ];
      
      await this.db.query(query, values);
      
    } catch (error) {
      log.error({ 
        loopId, 
        bucket: bucket.toISOString(), 
        error: error.message 
      }, 'Failed to store aggregated data');
      throw error;
    }
  }

  async performHistoricalAggregation() {
    try {
      log.info('Starting historical aggregation for all loops');
      
      for (const [loopId, loop] of this.activeLoops) {
        try {
          // Get data range from InfluxDB
          const dataRange = await this.influxClient.getDataRange(loop.loop_id);
          
          // Query aggregated data from InfluxDB
          const aggregatedData = await this.influxClient.queryAggregatedData(
            loop.loop_id,
            dataRange.start.toISOString(),
            dataRange.end.toISOString(),
            '1m'
          );
          
          // Store aggregated data in PostgreSQL
          for (const data of aggregatedData) {
            await this.storeAggregatedData(loop.loop_id, data.bucket, {
              pv_avg: data.pv_avg,
              pv_min: null, // InfluxDB aggregation doesn't provide min/max
              pv_max: null,
              pv_count: data.pv_count,
              op_avg: data.op_avg,
              sp_avg: data.sp_avg
            });
          }
          
          log.info({ loopId: loop.loop_id, count: aggregatedData.length }, 'Historical aggregation completed for loop');
          
        } catch (error) {
          log.error({ loopId: loop.loop_id, error: error.message }, 'Failed to perform historical aggregation for loop');
        }
      }
      
      log.info('Historical aggregation completed for all loops');
    } catch (error) {
      log.error({ error: error.message }, 'Failed to perform historical aggregation');
    }
  }

  async disconnect() {
    try {
      await this.stopPolling();
      
      if (this.influxClient) {
        await this.influxClient.close();
      }
      
      if (this.db) {
        await this.db.end();
      }
      
      log.info('Aggregation service disconnected');
    } catch (error) {
      log.error({ error: error.message }, 'Error during disconnect');
    }
  }
}

// Main execution
const aggregationService = new AggregationService();

(async () => {
  try {
    await aggregationService.connect();
    await aggregationService.initializeLoops();
    await aggregationService.startPolling();
    
    // Perform initial historical aggregation
    await aggregationService.performHistoricalAggregation();
    
    log.info('Aggregation service started successfully');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      log.info('Shutting down aggregation service...');
      await aggregationService.disconnect();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      log.info('Shutting down aggregation service...');
      await aggregationService.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    log.error({ error: error.message }, 'Failed to start aggregation service');
    process.exit(1);
  }
})().catch(error => {
  log.error({ error: error.message }, 'Aggregation service startup failed');
  process.exit(1);
});
