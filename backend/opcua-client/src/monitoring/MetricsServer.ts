import express, { Express, Request, Response } from 'express';
import { Logger } from 'pino';
import { MetricsCollector } from './MetricsCollector.js';
import { HealthMonitor } from './HealthMonitor.js';
import { OPCUAClient } from '../OPCUAClient.js';

interface MetricsServerConfig {
  port: number;
  host?: string;
  path?: string;
  enableOpenMetrics?: boolean;
  enableJsonMetrics?: boolean;
}

export class MetricsServer {
  private app: Express;
  private server?: any;
  private logger: Logger;
  private config: MetricsServerConfig;
  private metricsCollector: MetricsCollector;
  private healthMonitor: HealthMonitor;
  private opcuaClient: OPCUAClient;

  constructor(
    logger: Logger,
    config: MetricsServerConfig,
    metricsCollector: MetricsCollector,
    healthMonitor: HealthMonitor,
    opcuaClient: OPCUAClient
  ) {
    this.logger = logger.child({ component: 'MetricsServer' });
    this.config = config;
    this.metricsCollector = metricsCollector;
    this.healthMonitor = healthMonitor;
    this.opcuaClient = opcuaClient;
    this.app = express();
    this.setupRoutes();
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Prometheus metrics endpoint
    this.app.get(this.config.path || '/metrics', (req: Request, res: Response) => {
      try {
        const acceptHeader = req.headers.accept || '';
        
        if (acceptHeader.includes('application/openmetrics-text')) {
          // OpenMetrics format
          this.serveOpenMetrics(res);
        } else {
          // Standard Prometheus format
          this.servePrometheusMetrics(res);
        }
      } catch (error: any) {
        this.logger.error({ error }, 'Failed to serve metrics');
        res.status(500).send('Error generating metrics');
      }
    });

    // JSON metrics endpoint
    if (this.config.enableJsonMetrics !== false) {
      this.app.get('/metrics.json', (req: Request, res: Response) => {
        try {
          const metrics = this.getJsonMetrics();
          res.json(metrics);
        } catch (error: any) {
          this.logger.error({ error }, 'Failed to serve JSON metrics');
          res.status(500).json({ error: 'Failed to generate metrics' });
        }
      });
    }

    // Health endpoint for metrics server itself
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'CLPM OPC UA Client Metrics'
      });
    });

    // Metrics summary endpoint
    this.app.get('/summary', (req: Request, res: Response) => {
      try {
        const summary = this.getMetricsSummary();
        res.json(summary);
      } catch (error: any) {
        this.logger.error({ error }, 'Failed to serve metrics summary');
        res.status(500).json({ error: 'Failed to generate summary' });
      }
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).send('Not Found');
    });
  }

  /**
   * Serve Prometheus format metrics
   */
  private servePrometheusMetrics(res: Response): void {
    const lines: string[] = [];
    
    // Update metrics from current state
    this.updateMetrics();
    
    // Get health status
    const health = this.opcuaClient.getHealthStatus();
    const connections = this.opcuaClient.getMetrics().connections;
    
    // Uptime
    lines.push('# HELP opcua_uptime_seconds Application uptime in seconds');
    lines.push('# TYPE opcua_uptime_seconds gauge');
    lines.push(`opcua_uptime_seconds ${health.uptime}`);
    lines.push('');
    
    // Start time
    const startTime = Math.floor((Date.now() - health.uptime * 1000) / 1000);
    lines.push('# HELP opcua_start_time_seconds Application start time as Unix timestamp');
    lines.push('# TYPE opcua_start_time_seconds gauge');
    lines.push(`opcua_start_time_seconds ${startTime}`);
    lines.push('');
    
    // Memory metrics
    lines.push('# HELP opcua_memory_usage_bytes Memory usage in bytes');
    lines.push('# TYPE opcua_memory_usage_bytes gauge');
    lines.push(`opcua_memory_usage_bytes ${health.memory.used}`);
    lines.push('');
    
    lines.push('# HELP opcua_memory_total_bytes Total memory allocated in bytes');
    lines.push('# TYPE opcua_memory_total_bytes gauge');
    lines.push(`opcua_memory_total_bytes ${health.memory.total}`);
    lines.push('');
    
    // Connection metrics
    lines.push('# HELP opcua_connections_total Total number of configured OPC UA connections');
    lines.push('# TYPE opcua_connections_total gauge');
    lines.push(`opcua_connections_total ${health.connections.total}`);
    lines.push('');
    
    lines.push('# HELP opcua_connections_active Number of active OPC UA connections');
    lines.push('# TYPE opcua_connections_active gauge');
    lines.push(`opcua_connections_active ${health.connections.connected}`);
    lines.push('');
    
    lines.push('# HELP opcua_connection_errors_total Total number of connection errors');
    lines.push('# TYPE opcua_connection_errors_total counter');
    lines.push(`opcua_connection_errors_total ${health.connections.errors}`);
    lines.push('');
    
    // Data metrics
    lines.push('# HELP opcua_samples_processed_total Total number of OPC UA samples processed');
    lines.push('# TYPE opcua_samples_processed_total counter');
    lines.push(`opcua_samples_processed_total ${health.data.samplesProcessed}`);
    lines.push('');
    
    lines.push('# HELP opcua_batches_published_total Total number of data batches published');
    lines.push('# TYPE opcua_batches_published_total counter');
    lines.push(`opcua_batches_published_total ${health.data.batchesPublished}`);
    lines.push('');
    
    lines.push('# HELP opcua_publish_errors_total Total number of publish errors');
    lines.push('# TYPE opcua_publish_errors_total counter');
    lines.push(`opcua_publish_errors_total ${health.data.publishErrors}`);
    lines.push('');
    
    // Per-server metrics
    if (Array.isArray(connections)) {
      for (const conn of connections) {
        const serverLabel = `server_id="${conn.serverId}",endpoint="${conn.endpoint}"`;
        
        lines.push('# HELP opcua_server_connected Server connection status (1=connected, 0=disconnected)');
        lines.push('# TYPE opcua_server_connected gauge');
        lines.push(`opcua_server_connected{${serverLabel}} ${conn.status === 'connected' ? 1 : 0}`);
        lines.push('');
        
        if (conn.monitoredItems !== undefined) {
          lines.push('# HELP opcua_monitored_items_count Number of monitored items per server');
          lines.push('# TYPE opcua_monitored_items_count gauge');
          lines.push(`opcua_monitored_items_count{${serverLabel}} ${conn.monitoredItems}`);
          lines.push('');
        }
        
        if (conn.reconnectAttempts !== undefined) {
          lines.push('# HELP opcua_reconnect_attempts_total Total reconnection attempts per server');
          lines.push('# TYPE opcua_reconnect_attempts_total counter');
          lines.push(`opcua_reconnect_attempts_total{${serverLabel}} ${conn.reconnectAttempts}`);
          lines.push('');
        }
      }
    }
    
    // Health status (1=healthy, 0.5=degraded, 0=unhealthy)
    const healthValue = health.status === 'healthy' ? 1 : health.status === 'degraded' ? 0.5 : 0;
    lines.push('# HELP opcua_health_status Overall health status (1=healthy, 0.5=degraded, 0=unhealthy)');
    lines.push('# TYPE opcua_health_status gauge');
    lines.push(`opcua_health_status ${healthValue}`);
    lines.push('');
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(lines.join('\n'));
  }

  /**
   * Serve OpenMetrics format metrics
   */
  private serveOpenMetrics(res: Response): void {
    const lines: string[] = [];
    
    // OpenMetrics header
    lines.push('# TYPE opcua_uptime_seconds gauge');
    lines.push('# UNIT opcua_uptime_seconds seconds');
    lines.push('# HELP opcua_uptime_seconds Application uptime');
    
    // Update metrics and get current data
    this.updateMetrics();
    const health = this.opcuaClient.getHealthStatus();
    
    lines.push(`opcua_uptime_seconds ${health.uptime}`);
    lines.push('# EOF');
    
    res.set('Content-Type', 'application/openmetrics-text; version=1.0.0; charset=utf-8');
    res.send(lines.join('\n'));
  }

  /**
   * Get JSON format metrics
   */
  private getJsonMetrics(): any {
    this.updateMetrics();
    
    const health = this.opcuaClient.getHealthStatus();
    const metrics = this.opcuaClient.getMetrics();
    const systemMetrics = this.healthMonitor.getSystemMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: health.uptime,
      memory: health.memory,
      connections: {
        total: health.connections.total,
        active: health.connections.connected,
        disconnected: health.connections.disconnected,
        errors: health.connections.errors,
        details: metrics.connections
      },
      data: {
        samplesProcessed: health.data.samplesProcessed,
        batchesPublished: health.data.batchesPublished,
        publishErrors: health.data.publishErrors,
        lastSampleTime: health.data.lastSampleTime
      },
      health: {
        status: health.status,
        checks: this.healthMonitor.getHealthChecks()
      },
      system: systemMetrics,
      publisher: metrics.publisher,
      transformer: metrics.transformer
    };
  }

  /**
   * Get metrics summary
   */
  private getMetricsSummary(): any {
    const health = this.opcuaClient.getHealthStatus();
    const metricsCollectorSummary = this.metricsCollector.getMetricSummary();
    
    return {
      service: 'CLPM OPC UA Client',
      version: '1.0.0',
      status: health.status,
      uptime: health.uptime,
      metrics: {
        total: metricsCollectorSummary.totalMetrics,
        dataPoints: metricsCollectorSummary.dataPoints,
        memoryUsage: metricsCollectorSummary.memoryUsage,
        lastUpdate: new Date(metricsCollectorSummary.lastUpdate).toISOString()
      },
      endpoints: {
        prometheus: this.config.path || '/metrics',
        json: '/metrics.json',
        summary: '/summary',
        health: '/health'
      }
    };
  }

  /**
   * Update metrics from current system state
   */
  private updateMetrics(): void {
    const health = this.opcuaClient.getHealthStatus();
    const metrics = this.opcuaClient.getMetrics();
    
    // Update system metrics
    this.metricsCollector.updateSystemMetrics(
      health.memory.used,
      0 // CPU usage would need to be calculated
    );
    
    // Update connection metrics
    if (Array.isArray(metrics.connections)) {
      this.metricsCollector.updateConnectionMetrics(metrics.connections);
    }
    
    // Update health check metrics
    this.metricsCollector.recordHealthCheck(100); // Placeholder duration
  }

  /**
   * Start the metrics server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          this.logger.info({
            port: this.config.port,
            host: this.config.host || '0.0.0.0',
            path: this.config.path || '/metrics'
          }, 'Metrics server started');
          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error({ error }, 'Metrics server error');
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the metrics server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error?: Error) => {
        if (error) {
          this.logger.error({ error }, 'Error stopping metrics server');
          reject(error);
        } else {
          this.logger.info('Metrics server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return !!this.server && this.server.listening;
  }

  /**
   * Get server configuration
   */
  getConfig(): MetricsServerConfig {
    return { ...this.config };
  }
}

/**
 * Create metrics server configuration from environment variables
 */
export function createMetricsServerConfig(): MetricsServerConfig {
  return {
    port: Number(process.env.METRICS_PORT) || 9090,
    host: process.env.METRICS_HOST || '0.0.0.0',
    path: process.env.METRICS_PATH || '/metrics',
    enableOpenMetrics: process.env.ENABLE_OPENMETRICS !== 'false',
    enableJsonMetrics: process.env.ENABLE_JSON_METRICS !== 'false'
  };
}