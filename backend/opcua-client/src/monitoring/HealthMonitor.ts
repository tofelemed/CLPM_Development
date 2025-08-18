import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { HealthStatus, ConnectionStatus } from '../types/index.js';

interface SystemMetrics {
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  uptime: number;
  pid: number;
}

interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: any;
  lastCheck: Date;
  responseTime: number;
}

export class HealthMonitor extends EventEmitter {
  private logger: Logger;
  private checkInterval: NodeJS.Timeout;
  private checkIntervalMs: number;
  private healthStatus: HealthStatus;
  private lastMetrics: SystemMetrics;
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private isRunning = false;

  constructor(logger: Logger, checkIntervalMs: number = 30000) {
    super();
    this.logger = logger.child({ component: 'HealthMonitor' });
    this.checkIntervalMs = checkIntervalMs;
    this.healthStatus = this.initializeHealthStatus();
    this.lastMetrics = this.initializeMetrics();
  }

  /**
   * Initialize health status
   */
  private initializeHealthStatus(): HealthStatus {
    return {
      status: 'starting',
      timestamp: new Date(),
      uptime: 0,
      version: process.env.npm_package_version || '1.0.0',
      connections: {
        total: 0,
        connected: 0,
        disconnected: 0,
        failed: 0,
        errors: 0
      },
      subscriptions: {
        total: 0,
        active: 0,
        failed: 0
      },
      dataFlow: {
        samplesPerSecond: 0,
        batchesPerSecond: 0,
        lastSampleTime: undefined
      },
      memory: {
        used: 0,
        free: 0,
        total: 0,
        percentage: 0
      },
      certificates: {
        trusted: 0,
        rejected: 0,
        revoked: 0,
        expiringSoon: 0
      }
    };
  }

  /**
   * Initialize system metrics
   */
  private initializeMetrics(): SystemMetrics {
    return {
      memory: { used: 0, free: 0, total: 0, percentage: 0 },
      cpu: { usage: 0, loadAverage: [0, 0, 0] },
      uptime: 0,
      pid: process.pid
    };
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.healthStatus.status = 'healthy';
    
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.checkIntervalMs);

    // Perform initial check
    this.performHealthCheck();

    this.logger.info({ 
      intervalMs: this.checkIntervalMs 
    }, 'Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.healthStatus.status = 'stopped';
    this.logger.info('Health monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      // Update system metrics
      this.updateSystemMetrics();

      // Run individual health checks
      await this.checkMemoryHealth();
      await this.checkProcessHealth();
      await this.checkFileSystemHealth();

      // Calculate overall health status
      this.calculateOverallHealth();

      // Update timestamp and emit event
      this.healthStatus.timestamp = new Date();
      this.healthStatus.uptime = process.uptime();

      const responseTime = Date.now() - startTime;
      
      this.emit('healthCheck', {
        status: this.healthStatus,
        responseTime,
        checks: Array.from(this.healthChecks.values())
      });

      // Log health status periodically
      if (this.shouldLogHealth()) {
        this.logHealthStatus();
      }

    } catch (error) {
      this.logger.error({ error }, 'Health check failed');
      this.healthStatus.status = 'unhealthy';
    }
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.lastMetrics = {
      memory: {
        used: memUsage.heapUsed,
        free: memUsage.heapTotal - memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpu: {
        usage: 0, // Would need more sophisticated CPU tracking
        loadAverage: [0, 0, 0] // loadAvg not available on Windows
      },
      uptime: process.uptime(),
      pid: process.pid
    };

    // Update health status memory
    this.healthStatus.memory = this.lastMetrics.memory;
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<void> {
    const startTime = Date.now();
    const memoryPercentage = this.lastMetrics.memory.percentage;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Memory usage normal';

    if (memoryPercentage > 90) {
      status = 'unhealthy';
      message = `Critical memory usage: ${memoryPercentage.toFixed(1)}%`;
    } else if (memoryPercentage > 75) {
      status = 'degraded';
      message = `High memory usage: ${memoryPercentage.toFixed(1)}%`;
    }

    this.healthChecks.set('memory', {
      component: 'memory',
      status,
      message,
      details: {
        used: this.lastMetrics.memory.used,
        total: this.lastMetrics.memory.total,
        percentage: memoryPercentage
      },
      lastCheck: new Date(),
      responseTime: Date.now() - startTime
    });
  }

  /**
   * Check process health
   */
  private async checkProcessHealth(): Promise<void> {
    const startTime = Date.now();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Process running normally';
    
    const uptime = process.uptime();
    const loadAverage = this.lastMetrics.cpu.loadAverage[0];

    // Check if process has been running for a reasonable time
    if (uptime < 10) {
      status = 'degraded';
      message = 'Process recently started';
    }

    // Check load average (simplified check)
    if (loadAverage > 2.0) {
      status = 'degraded';
      message = `High system load: ${loadAverage.toFixed(2)}`;
    }

    this.healthChecks.set('process', {
      component: 'process',
      status,
      message,
      details: {
        uptime,
        pid: process.pid,
        loadAverage: this.lastMetrics.cpu.loadAverage
      },
      lastCheck: new Date(),
      responseTime: Date.now() - startTime
    });
  }

  /**
   * Check filesystem health
   */
  private async checkFileSystemHealth(): Promise<void> {
    const startTime = Date.now();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Filesystem accessible';

    try {
      // Test write/read to temp directory
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');
      
      const testFile = path.join(os.tmpdir(), `health-check-${process.pid}.tmp`);
      const testData = Date.now().toString();
      
      await fs.writeFile(testFile, testData);
      const readData = await fs.readFile(testFile, 'utf-8');
      await fs.unlink(testFile);
      
      if (readData !== testData) {
        status = 'unhealthy';
        message = 'Filesystem write/read test failed';
      }

    } catch (error: any) {
      status = 'unhealthy';
      message = `Filesystem error: ${error.message}`;
    }

    this.healthChecks.set('filesystem', {
      component: 'filesystem',
      status,
      message,
      lastCheck: new Date(),
      responseTime: Date.now() - startTime
    });
  }

  /**
   * Calculate overall health status
   */
  private calculateOverallHealth(): void {
    const checks = Array.from(this.healthChecks.values());
    
    if (checks.some(check => check.status === 'unhealthy')) {
      this.healthStatus.status = 'unhealthy';
    } else if (checks.some(check => check.status === 'degraded')) {
      this.healthStatus.status = 'degraded';
    } else {
      this.healthStatus.status = 'healthy';
    }
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(statuses: ConnectionStatus[]): void {
    const connected = statuses.filter(s => s.status === 'connected').length;
    const disconnected = statuses.filter(s => s.status === 'disconnected').length;
    const errors = statuses.filter(s => s.status === 'error').length;

    this.healthStatus.connections = {
      total: statuses.length,
      connected,
      disconnected,
      failed: disconnected + errors,
      errors
    };

    // Update connection health check
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'All connections healthy';

    if (errors > 0) {
      status = 'unhealthy';
      message = `${errors} connection(s) in error state`;
    } else if (disconnected > connected) {
      status = 'degraded';
      message = `More disconnected (${disconnected}) than connected (${connected}) servers`;
    } else if (connected === 0 && statuses.length > 0) {
      status = 'unhealthy';
      message = 'No servers connected';
    }

    this.healthChecks.set('connections', {
      component: 'connections',
      status,
      message,
      details: this.healthStatus.connections,
      lastCheck: new Date(),
      responseTime: 0
    });
  }

  /**
   * Update data processing status
   */
  updateDataStatus(samplesProcessed: number, batchesPublished: number, publishErrors: number): void {
    // Initialize data object if it doesn't exist
    if (!this.healthStatus.data) {
      this.healthStatus.data = {
        samplesProcessed: 0,
        batchesPublished: 0,
        publishErrors: 0,
        lastSampleTime: undefined
      };
    }
    
    this.healthStatus.data.samplesProcessed = samplesProcessed;
    this.healthStatus.data.batchesPublished = batchesPublished;
    this.healthStatus.data.publishErrors = publishErrors;
    this.healthStatus.data.lastSampleTime = new Date();

    // Update data health check
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Data processing normal';

    const errorRate = publishErrors / Math.max(batchesPublished, 1);
    
    if (errorRate > 0.1) { // More than 10% error rate
      status = 'unhealthy';
      message = `High publish error rate: ${(errorRate * 100).toFixed(1)}%`;
    } else if (errorRate > 0.05) { // More than 5% error rate
      status = 'degraded';
      message = `Elevated publish error rate: ${(errorRate * 100).toFixed(1)}%`;
    }

    this.healthChecks.set('data', {
      component: 'data',
      status,
      message,
      details: this.healthStatus.data,
      lastCheck: new Date(),
      responseTime: 0
    });
  }

  /**
   * Check if we should log health status
   */
  private shouldLogHealth(): boolean {
    // Log every 10 minutes, or immediately if unhealthy
    const logInterval = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    const lastLog = this.healthStatus.timestamp.getTime();
    
    return this.healthStatus.status === 'unhealthy' || 
           this.healthStatus.status === 'degraded' ||
           (now - lastLog) > logInterval;
  }

  /**
   * Log current health status
   */
  private logHealthStatus(): void {
    const unhealthyChecks = Array.from(this.healthChecks.values())
      .filter(check => check.status !== 'healthy');

    if (unhealthyChecks.length > 0) {
      this.logger.warn({ 
        status: this.healthStatus,
        unhealthyChecks: unhealthyChecks.map(check => ({
          component: check.component,
          status: check.status,
          message: check.message
        }))
      }, 'Health check issues detected');
    } else {
      this.logger.info({ 
        status: this.healthStatus.status,
        uptime: this.healthStatus.uptime,
        connections: this.healthStatus.connections,
        memory: this.healthStatus.memory
      }, 'Health check passed');
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Get detailed health checks
   */
  getHealthChecks(): HealthCheckResult[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.lastMetrics };
  }

  /**
   * Register custom health check
   */
  registerHealthCheck(name: string, checkFn: () => Promise<Omit<HealthCheckResult, 'lastCheck' | 'responseTime'>>): void {
    // This would be used to register custom health checks from other components
    this.logger.debug({ name }, 'Custom health check registered');
  }

  /**
   * Check if system is healthy enough to continue operation
   */
  isHealthy(): boolean {
    return this.healthStatus.status === 'healthy' || this.healthStatus.status === 'degraded';
  }

  /**
   * Get health summary for external systems
   */
  getHealthSummary(): {
    status: string;
    timestamp: string;
    uptime: number;
    checks: { [key: string]: string };
  } {
    const checks: { [key: string]: string } = {};
    
    this.healthChecks.forEach((check, name) => {
      checks[name] = check.status;
    });

    return {
      status: this.healthStatus.status,
      timestamp: this.healthStatus.timestamp.toISOString(),
      uptime: this.healthStatus.uptime,
      checks
    };
  }
}