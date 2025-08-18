#!/usr/bin/env node

import pino from 'pino';
import { OPCUAClient } from './OPCUAClient.js';
import { ClientConfig } from './types/index.js';
import { validateEnvironment } from './utils/validation.js';
import { ApiServer, createServerConfig } from './api/server.js';
import { MetricsServer, createMetricsServerConfig } from './monitoring/MetricsServer.js';

/**
 * Create logger configuration
 */
function createLogger() {
  const level = process.env.LOG_LEVEL || 'info';
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return pino({
    level,
    ...(isDevelopment && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'hostname,pid'
        }
      }
    })
  });
}

/**
 * Create client configuration from environment variables
 */
function createClientConfig(): ClientConfig {
  return {
    applicationName: process.env.APPLICATION_NAME || 'CLPM OPC UA Client',
    applicationUri: process.env.APPLICATION_URI || 'urn:clpm:opcua:client',
    productUri: process.env.PRODUCT_URI || 'urn:clpm:opcua:client',
    
    certificateDir: process.env.CERTIFICATE_DIR || './certificates',
    certificateLifetimeDays: Number(process.env.CERTIFICATE_LIFETIME_DAYS) || 365,
    autoTrustUnknownCerts: process.env.AUTO_TRUST_UNKNOWN_CERTS?.toLowerCase() === 'true',
    
    defaultSamplingInterval: Number(process.env.DEFAULT_SAMPLING_INTERVAL) || 200,
    maxSessionSubscriptions: Number(process.env.MAX_SESSION_SUBSCRIPTIONS) || 1000,
    connectionTimeoutMs: Number(process.env.CONNECTION_TIMEOUT_MS) || 30000,
    reconnectDelayMs: Number(process.env.RECONNECT_DELAY_MS) || 5000,
    maxReconnectDelayMs: Number(process.env.MAX_RECONNECT_DELAY_MS) || 60000,
    maxReconnectAttempts: Number(process.env.MAX_RECONNECT_ATTEMPTS) || 10,
    healthCheckIntervalMs: Number(process.env.HEALTH_CHECK_INTERVAL_MS) || 60000,
    
    batchSize: Number(process.env.BATCH_SIZE) || 100,
    batchTimeoutMs: Number(process.env.BATCH_TIMEOUT_MS) || 5000,
    maxQueueSize: Number(process.env.MAX_QUEUE_SIZE) || 10000,
    
    metricsPort: Number(process.env.METRICS_PORT) || 3001,
    port: Number(process.env.PORT) || 4840,
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    jwtSecret: process.env.JWT_SECRET || 'default-secret',
    apiKey: process.env.API_KEY || 'default-api-key'
  };
}

/**
 * Setup process signal handlers
 */
function setupSignalHandlers(client: OPCUAClient, apiServer: ApiServer, metricsServer: MetricsServer, logger: pino.Logger) {
  let shutdownInProgress = false;

  const gracefulShutdown = async (signal: string) => {
    if (shutdownInProgress) {
      logger.warn(`Received ${signal} again, forcing exit`);
      process.exit(1);
    }

    shutdownInProgress = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      // Stop servers first
      await Promise.all([
        apiServer.stop(),
        metricsServer.stop()
      ]);
      
      // Then shutdown OPC UA client
      await client.shutdown();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled promise rejection');
    process.exit(1);
  });
}

/**
 * Setup health monitoring
 */
function setupHealthMonitoring(client: OPCUAClient, logger: pino.Logger) {
  setInterval(() => {
    const health = client.getHealthStatus();
    
    if (health.status === 'error') {
      logger.error({ health }, 'Client health check failed');
    } else {
      logger.debug({ health }, 'Client health check');
    }
    
    // Log memory usage if it's high
    if (health.memory.percentage > 90) {
      logger.warn({ 
        memoryUsage: health.memory 
      }, 'High memory usage detected');
    }
    
  }, 60000); // Every minute
}

/**
 * Main application entry point
 */
async function main() {
  const logger = createLogger();
  
  try {
    logger.info('Starting CLPM OPC UA Client...');

    // Validate environment
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      logger.error({ errors: envValidation.errors }, 'Environment validation failed');
      process.exit(1);
    }

    logger.info('Environment validation passed');

    // Create configuration
    const config = createClientConfig();
    logger.info({ 
      applicationName: config.applicationName,
      applicationUri: config.applicationUri,
      certificateDir: config.certificateDir,
      autoTrustCerts: config.autoTrustUnknownCerts,
      samplingInterval: config.defaultSamplingInterval,
      batchSize: config.batchSize
    }, 'Client configuration loaded');

    // Create and initialize client
    const client = new OPCUAClient(logger, config);
    
    // Create API server
    const serverConfig = createServerConfig();
    const apiServer = new ApiServer(logger, client, serverConfig);
    
    // Create metrics server
    const metricsConfig = createMetricsServerConfig();
    const metricsServer = new MetricsServer(
      logger,
      metricsConfig,
      client.getMetricsCollector(),
      client.getHealthMonitor(),
      client
    );
    
    // Setup signal handlers
    setupSignalHandlers(client, apiServer, metricsServer, logger);
    
    // Setup health monitoring
    setupHealthMonitoring(client, logger);

    // Setup client event handlers
    client.on('initialized', () => {
      logger.info('OPC UA client ready');
    });

    client.on('serverConnected', (event) => {
      logger.info({ serverId: event.serverId }, 'Connected to OPC UA server');
    });

    client.on('serverDisconnected', (event) => {
      logger.warn({ serverId: event.serverId }, 'Disconnected from OPC UA server');
    });

    client.on('serverConnectionFailed', (event) => {
      logger.error({ 
        serverId: event.serverId, 
        error: event.error.message 
      }, 'Failed to connect to OPC UA server');
    });

    client.on('dataReceived', (event) => {
      logger.debug({ 
        serverId: event.serverId,
        loopId: event.loopId,
        tagType: event.tagType,
        value: event.sample[event.tagType]
      }, 'Data received from OPC UA server');
    });

    // Initialize the client
    await client.initialize();

    // Start servers
    await Promise.all([
      apiServer.start(),
      metricsServer.start()
    ]);

    // Log startup completion
    const health = client.getHealthStatus();
    logger.info({ 
      status: health.status,
      connections: health.connections,
      uptime: health.uptime,
      apiPort: serverConfig.port,
      metricsPort: metricsConfig.port
    }, 'CLPM OPC UA Client started successfully');

  } catch (error: any) {
    logger.fatal({ 
      error: error.message,
      stack: error.stack 
    }, 'Failed to start OPC UA client');
    console.error('Startup error:', error);
    process.exit(1);
  }
}

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

export { OPCUAClient, createClientConfig, createLogger, main };