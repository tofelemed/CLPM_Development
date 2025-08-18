import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { DataSample } from '../types/index.js';

interface CLPMConfig {
  // RabbitMQ configuration
  rabbitmq?: {
    enabled: boolean;
    url: string;
    exchange: string;
    routingKey: string;
    queue?: string;
  };
  
  // HTTP endpoint configuration
  http?: {
    enabled: boolean;
    endpoint: string;
    timeout: number;
    retries: number;
    headers?: Record<string, string>;
  };
  
  // Database configuration
  database?: {
    enabled: boolean;
    connectionString: string;
    table: string;
    batchSize: number;
  };
  
  // General settings
  batchSize: number;
  batchTimeoutMs: number;
  maxQueueSize: number;
  enableRetry: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

interface BatchedSample {
  sample: DataSample;
  timestamp: Date;
  retryCount: number;
}

export class DataPublisher extends EventEmitter {
  private logger: Logger;
  private config: CLPMConfig;
  private sampleQueue: BatchedSample[] = [];
  private batchTimer?: NodeJS.Timeout;
  private httpClient?: any; // axios instance
  private rabbitConnection?: any;
  private rabbitChannel?: any;
  private dbConnection?: any;
  private isShutdown = false;

  constructor(logger: Logger, config: CLPMConfig) {
    super();
    this.logger = logger.child({ component: 'DataPublisher' });
    this.config = config;
  }

  /**
   * Initialize data publisher
   */
  async initialize(): Promise<void> {
    try {
      // Initialize HTTP client
      if (this.config.http?.enabled) {
        await this.initializeHttpClient();
      }

      // Initialize RabbitMQ
      if (this.config.rabbitmq?.enabled) {
        await this.initializeRabbitMQ();
      }

      // Initialize database connection
      if (this.config.database?.enabled) {
        await this.initializeDatabase();
      }

      this.startBatchTimer();
      
      this.logger.info({
        http: this.config.http?.enabled,
        rabbitmq: this.config.rabbitmq?.enabled,
        database: this.config.database?.enabled,
        batchSize: this.config.batchSize
      }, 'Data publisher initialized');

    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize data publisher');
      throw error;
    }
  }

  /**
   * Initialize HTTP client for REST API publishing
   */
  private async initializeHttpClient(): Promise<void> {
    try {
      const axios = await import('axios');
      
      this.httpClient = axios.default.create({
        baseURL: this.config.http!.endpoint,
        timeout: this.config.http!.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CLPM-OPC-UA-Client/1.0',
          ...this.config.http?.headers
        }
      });

      this.logger.info({ endpoint: this.config.http!.endpoint }, 'HTTP client initialized');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize HTTP client');
      throw error;
    }
  }

  /**
   * Initialize RabbitMQ connection
   */
  private async initializeRabbitMQ(): Promise<void> {
    try {
      const amqp = await import('amqplib');
      
      this.rabbitConnection = await amqp.connect(this.config.rabbitmq!.url);
      this.rabbitChannel = await this.rabbitConnection.createChannel();
      
      // Declare exchange if it doesn't exist
      await this.rabbitChannel.assertExchange(
        this.config.rabbitmq!.exchange,
        'topic',
        { durable: true }
      );

      // Declare queue if specified
      if (this.config.rabbitmq!.queue) {
        await this.rabbitChannel.assertQueue(this.config.rabbitmq!.queue, {
          durable: true
        });
        
        await this.rabbitChannel.bindQueue(
          this.config.rabbitmq!.queue,
          this.config.rabbitmq!.exchange,
          this.config.rabbitmq!.routingKey
        );
      }

      // Handle connection events
      this.rabbitConnection.on('error', (error: Error) => {
        this.logger.error({ error }, 'RabbitMQ connection error');
        this.emit('publishError', { type: 'rabbitmq', error });
      });

      this.rabbitConnection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        if (!this.isShutdown) {
          this.scheduleRabbitMQReconnect();
        }
      });

      this.logger.info({ 
        url: this.config.rabbitmq!.url,
        exchange: this.config.rabbitmq!.exchange 
      }, 'RabbitMQ initialized');

    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize RabbitMQ');
      throw error;
    }
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // For PostgreSQL
      if (this.config.database!.connectionString.includes('postgresql')) {
        const { Pool } = await import('pg');
        this.dbConnection = new Pool({
          connectionString: this.config.database!.connectionString
        });

        // Test connection
        const client = await this.dbConnection.connect();
        await client.query('SELECT NOW()');
        client.release();
      }
      // For other databases, add similar initialization

      this.logger.info('Database connection initialized');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize database');
      throw error;
    }
  }

  /**
   * Publish data sample
   */
  async publishSample(sample: DataSample): Promise<void> {
    if (this.isShutdown) {
      return;
    }

    try {
      const batchedSample: BatchedSample = {
        sample,
        timestamp: new Date(),
        retryCount: 0
      };

      // Add to queue
      this.sampleQueue.push(batchedSample);

      // Check if we need to flush immediately
      if (this.sampleQueue.length >= this.config.batchSize) {
        await this.flushBatch();
      }

      // Check queue size limit
      if (this.sampleQueue.length > this.config.maxQueueSize) {
        const removed = this.sampleQueue.splice(0, this.sampleQueue.length - this.config.maxQueueSize);
        this.logger.warn({ 
          removedCount: removed.length,
          queueSize: this.sampleQueue.length 
        }, 'Queue size limit exceeded, dropping oldest samples');
      }

    } catch (error) {
      this.logger.error({ error, sample }, 'Failed to queue sample for publishing');
      this.emit('publishError', { type: 'queue', error, sample });
    }
  }

  /**
   * Start batch timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(async () => {
      if (this.sampleQueue.length > 0) {
        await this.flushBatch();
      }
    }, this.config.batchTimeoutMs);
  }

  /**
   * Flush current batch
   */
  private async flushBatch(): Promise<void> {
    if (this.sampleQueue.length === 0) {
      return;
    }

    const batch = this.sampleQueue.splice(0, this.config.batchSize);
    const samples = batch.map(b => b.sample);

    this.logger.debug({ 
      batchSize: batch.length,
      queueRemaining: this.sampleQueue.length 
    }, 'Flushing batch');

    // Try each configured publisher
    const publishPromises: Promise<void>[] = [];

    if (this.config.http?.enabled) {
      publishPromises.push(this.publishToHttp(samples));
    }

    if (this.config.rabbitmq?.enabled) {
      publishPromises.push(this.publishToRabbitMQ(samples));
    }

    if (this.config.database?.enabled) {
      publishPromises.push(this.publishToDatabase(samples));
    }

    try {
      await Promise.allSettled(publishPromises);
      
      this.emit('batchPublished', { 
        sampleCount: samples.length,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error({ error, batchSize: batch.length }, 'Failed to publish batch');
      
      // Handle retry logic
      if (this.config.enableRetry) {
        await this.handleRetry(batch);
      }
    }
  }

  /**
   * Publish samples to HTTP endpoint
   */
  private async publishToHttp(samples: DataSample[]): Promise<void> {
    if (!this.httpClient) {
      throw new Error('HTTP client not initialized');
    }

    try {
      const payload = {
        source: 'opcua-client',
        timestamp: new Date().toISOString(),
        samples: samples.map(sample => ({
          loop_id: sample.loopId,
          timestamp: sample.timestamp.toISOString(),
          server_timestamp: sample.serverTimestamp.toISOString(),
          quality_code: sample.qualityCode,
          server_id: sample.serverId,
          pv: sample.pv,
          op: sample.op,
          sp: sample.sp,
          mode: sample.mode,
          valve: sample.valve
        }))
      };

      const response = await this.httpClient.post('/api/v1/raw-samples', payload);
      
      this.logger.debug({ 
        sampleCount: samples.length,
        status: response.status 
      }, 'Published to HTTP endpoint');

    } catch (error: any) {
      this.logger.error({ 
        error: error.message,
        status: error.response?.status,
        sampleCount: samples.length 
      }, 'Failed to publish to HTTP endpoint');
      throw error;
    }
  }

  /**
   * Publish samples to RabbitMQ
   */
  private async publishToRabbitMQ(samples: DataSample[]): Promise<void> {
    if (!this.rabbitChannel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    try {
      const message = {
        source: 'opcua-client',
        timestamp: new Date().toISOString(),
        samples
      };

      const published = this.rabbitChannel.publish(
        this.config.rabbitmq!.exchange,
        this.config.rabbitmq!.routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          timestamp: Date.now(),
          contentType: 'application/json'
        }
      );

      if (!published) {
        throw new Error('Failed to publish to RabbitMQ - channel full');
      }

      this.logger.debug({ 
        sampleCount: samples.length,
        exchange: this.config.rabbitmq!.exchange,
        routingKey: this.config.rabbitmq!.routingKey
      }, 'Published to RabbitMQ');

    } catch (error) {
      this.logger.error({ error, sampleCount: samples.length }, 'Failed to publish to RabbitMQ');
      throw error;
    }
  }

  /**
   * Publish samples to database
   */
  private async publishToDatabase(samples: DataSample[]): Promise<void> {
    if (!this.dbConnection) {
      throw new Error('Database connection not initialized');
    }

    try {
      const client = await this.dbConnection.connect();
      
      try {
        await client.query('BEGIN');

        const insertQuery = `
          INSERT INTO ${this.config.database!.table} 
          (loop_id, timestamp, server_timestamp, quality_code, server_id, pv, op, sp, mode, valve, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        `;

        for (const sample of samples) {
          await client.query(insertQuery, [
            sample.loopId,
            sample.timestamp,
            sample.serverTimestamp,
            sample.qualityCode,
            sample.serverId,
            sample.pv,
            sample.op,
            sample.sp,
            sample.mode,
            sample.valve
          ]);
        }

        await client.query('COMMIT');
        
        this.logger.debug({ sampleCount: samples.length }, 'Published to database');

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      this.logger.error({ error, sampleCount: samples.length }, 'Failed to publish to database');
      throw error;
    }
  }

  /**
   * Handle retry logic for failed batches
   */
  private async handleRetry(batch: BatchedSample[]): Promise<void> {
    const retryableSamples = batch.filter(sample => 
      sample.retryCount < this.config.maxRetries
    );

    if (retryableSamples.length === 0) {
      this.logger.warn({ 
        droppedCount: batch.length 
      }, 'Dropping samples after max retries');
      return;
    }

    // Increment retry count and add delay
    retryableSamples.forEach(sample => sample.retryCount++);

    setTimeout(() => {
      // Add back to the front of the queue
      this.sampleQueue.unshift(...retryableSamples);
      
      this.logger.info({ 
        retryCount: retryableSamples.length,
        averageRetries: retryableSamples.reduce((sum, s) => sum + s.retryCount, 0) / retryableSamples.length
      }, 'Retrying failed samples');
      
    }, this.config.retryDelayMs);
  }

  /**
   * Schedule RabbitMQ reconnection
   */
  private async scheduleRabbitMQReconnect(): Promise<void> {
    setTimeout(async () => {
      if (!this.isShutdown) {
        try {
          await this.initializeRabbitMQ();
          this.logger.info('RabbitMQ reconnected successfully');
        } catch (error) {
          this.logger.error({ error }, 'Failed to reconnect to RabbitMQ');
          this.scheduleRabbitMQReconnect();
        }
      }
    }, 5000); // Retry after 5 seconds
  }

  /**
   * Get publisher statistics
   */
  getStatistics(): {
    queueSize: number;
    totalPublished: number;
    failedPublications: number;
    avgBatchSize: number;
    uptime: number;
  } {
    // This would track actual metrics in a real implementation
    return {
      queueSize: this.sampleQueue.length,
      totalPublished: 0, // Would be tracked
      failedPublications: 0, // Would be tracked
      avgBatchSize: this.config.batchSize,
      uptime: process.uptime()
    };
  }

  /**
   * Force flush all pending samples
   */
  async flush(): Promise<void> {
    while (this.sampleQueue.length > 0) {
      await this.flushBatch();
    }
  }

  /**
   * Shutdown data publisher
   */
  async shutdown(): Promise<void> {
    this.isShutdown = true;
    
    // Clear batch timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Flush remaining samples
    await this.flush();

    // Close connections
    if (this.rabbitConnection) {
      await this.rabbitConnection.close();
    }

    if (this.dbConnection) {
      await this.dbConnection.end();
    }

    this.logger.info('Data publisher shutdown complete');
  }
}