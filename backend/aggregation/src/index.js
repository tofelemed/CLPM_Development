import 'dotenv/config';
import pino from 'pino';
import { Pool } from 'pg';
import { createChannel } from './rabbit.js';

const log = pino({ name: 'aggregation-service' });

class AggregationService {
  constructor() {
    this.db = null;
    this.rabbitChannel = null;
    this.aggregationIntervals = {
      '1m': 60 * 1000,      // 1 minute
      '1h': 60 * 60 * 1000  // 1 hour
    };
    this.aggregationBuffer = new Map(); // loopId -> buffer
    this.isRunning = false;
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
        max: 10,
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

      // Set up consumer for raw samples
      await this.setupRawSampleConsumer();

      log.info('Aggregation service connected to database and RabbitMQ');
    } catch (error) {
      log.error({ error: error.message }, 'Failed to connect to services');
      throw error;
    }
  }

  async setupRawSampleConsumer() {
    try {
      const queueName = 'aggregation-raw-samples';
      
      // Ensure queue exists
      await this.rabbitChannel.assertQueue(queueName, { durable: true });
      
      // Bind to all loop routing keys
      await this.rabbitChannel.bindQueue(queueName, process.env.RABBITMQ_EXCHANGE || 'clpm', 'loop.*');
      
      // Consume messages
      await this.rabbitChannel.consume(queueName, async (msg) => {
        if (msg) {
          try {
            const sample = JSON.parse(msg.content.toString());
            await this.processRawSample(sample);
            this.rabbitChannel.ack(msg);
          } catch (error) {
            log.error({ error: error.message, content: msg.content.toString() }, 'Failed to process raw sample');
            // Reject message and requeue
            this.rabbitChannel.nack(msg, false, true);
          }
        }
      });

      log.info('Raw sample consumer set up successfully');
    } catch (error) {
      log.error({ error: error.message }, 'Failed to set up raw sample consumer');
      throw error;
    }
  }

  async processRawSample(sample) {
    try {
      const { loop_id, ts } = sample;
      
      // Add to aggregation buffer
      if (!this.aggregationBuffer.has(loop_id)) {
        this.aggregationBuffer.set(loop_id, new Map());
      }
      
      const loopBuffer = this.aggregationBuffer.get(loop_id);
      
      // Process for each aggregation interval
      for (const [interval, intervalMs] of Object.entries(this.aggregationIntervals)) {
        const bucket = this.getBucketTimestamp(ts, intervalMs);
        const bucketKey = bucket.toISOString();
        
        if (!loopBuffer.has(interval)) {
          loopBuffer.set(interval, new Map());
        }
        
        const intervalBuffer = loopBuffer.get(interval);
        
        if (!intervalBuffer.has(bucketKey)) {
          intervalBuffer.set(bucketKey, {
            bucket,
            loop_id,
            pv_values: [],
            op_values: [],
            sp_values: [],
            mode_changes: 0,
            count: 0
          });
        }
        
        const bucketData = intervalBuffer.get(bucketKey);
        
        // Add values
        if (sample.pv !== undefined) bucketData.pv_values.push(sample.pv);
        if (sample.op !== undefined) bucketData.op_values.push(sample.op);
        if (sample.sp !== undefined) bucketData.sp_values.push(sample.sp);
        bucketData.count++;
        
        // Check for mode changes (if we have previous value)
        if (sample.mode !== undefined) {
          const lastKey = Array.from(intervalBuffer.keys()).sort().pop();
          if (lastKey && lastKey !== bucketKey) {
            const lastBucket = intervalBuffer.get(lastKey);
            if (lastBucket.mode !== sample.mode) {
              bucketData.mode_changes++;
            }
          }
        }
      }
      
      // Flush completed buckets
      await this.flushCompletedBuckets();
      
    } catch (error) {
      log.error({ sample, error: error.message }, 'Failed to process raw sample');
      throw error;
    }
  }

  getBucketTimestamp(timestamp, intervalMs) {
    const date = new Date(timestamp);
    const bucketTime = new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
    return bucketTime;
  }

  async flushCompletedBuckets() {
    try {
      const now = new Date();
      
      for (const [loopId, loopBuffer] of this.aggregationBuffer) {
        for (const [interval, intervalBuffer] of loopBuffer) {
          const intervalMs = this.aggregationIntervals[interval];
          const currentBucket = this.getBucketTimestamp(now, intervalMs);
          
          // Find completed buckets (older than current bucket)
          const completedBuckets = Array.from(intervalBuffer.entries())
            .filter(([bucketKey, bucketData]) => bucketData.bucket < currentBucket);
          
          for (const [bucketKey, bucketData] of completedBuckets) {
            try {
              await this.flushBucket(loopId, interval, bucketData);
              intervalBuffer.delete(bucketKey);
            } catch (error) {
              log.error({ 
                loopId, 
                interval, 
                bucket: bucketKey, 
                error: error.message 
              }, 'Failed to flush bucket');
            }
          }
        }
      }
    } catch (error) {
      log.error({ error: error.message }, 'Failed to flush completed buckets');
    }
  }

  async flushBucket(loopId, interval, bucketData) {
    try {
      const { bucket, pv_values, op_values, sp_values, mode_changes, count } = bucketData;
      
      if (count === 0) return;
      
      // Calculate aggregates
      const pv_avg = pv_values.length > 0 ? pv_values.reduce((a, b) => a + b, 0) / pv_values.length : null;
      const pv_min = pv_values.length > 0 ? Math.min(...pv_values) : null;
      const pv_max = pv_values.length > 0 ? Math.max(...pv_values) : null;
      
      const op_avg = op_values.length > 0 ? op_values.reduce((a, b) => a + b, 0) / op_values.length : null;
      const sp_avg = sp_values.length > 0 ? sp_values.reduce((a, b) => a + b, 0) / sp_values.length : null;
      
      // Determine table name based on interval
      const tableName = interval === '1h' ? 'agg_1h' : 'agg_1m';
      const timeColumn = interval === '1h' ? 'bucket' : 'bucket';
      
      // Insert aggregated data
      const query = `
        INSERT INTO ${tableName} (${timeColumn}, loop_id, pv_avg, pv_min, pv_max, pv_count, op_avg, sp_avg)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (${timeColumn}, loop_id) 
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
        pv_avg,
        pv_min,
        pv_max,
        count,
        op_avg,
        sp_avg
      ];
      
      await this.db.query(query, values);
      
      log.debug({ 
        loopId, 
        interval, 
        bucket: bucket.toISOString(), 
        count 
      }, 'Bucket flushed successfully');
      
    } catch (error) {
      log.error({ 
        loopId, 
        interval, 
        bucket: bucketData.bucket, 
        error: error.message 
      }, 'Failed to flush bucket');
      throw error;
    }
  }

  async startPeriodicFlush() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Flush every 30 seconds
    const flushInterval = setInterval(async () => {
      try {
        await this.flushCompletedBuckets();
      } catch (error) {
        log.error({ error: error.message }, 'Periodic flush failed');
      }
    }, 30000);
    
    // Store interval for cleanup
    this.flushInterval = flushInterval;
    
    log.info('Periodic flush started');
  }

  async stopPeriodicFlush() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.isRunning = false;
    log.info('Periodic flush stopped');
  }

  async disconnect() {
    try {
      await this.stopPeriodicFlush();
      
      if (this.rabbitChannel) {
        await this.rabbitChannel.close();
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
    await aggregationService.startPeriodicFlush();
    
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
