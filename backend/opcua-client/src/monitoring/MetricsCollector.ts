import { Logger } from 'pino';
import { ConnectionStatus } from '../types/index.js';

// Prometheus-style metrics
interface PrometheusMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: Record<string, string>;
  value: number;
  timestamp?: number;
}

interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export class MetricsCollector {
  private logger: Logger;
  private metrics: Map<string, MetricValue[]> = new Map();
  private metricDefinitions: Map<string, Omit<PrometheusMetric, 'value'>> = new Map();
  private startTime: number;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'MetricsCollector' });
    this.startTime = Date.now();
    this.initializeMetrics();
  }

  /**
   * Initialize metric definitions
   */
  private initializeMetrics(): void {
    // Connection metrics
    this.defineMetric('opcua_connections_total', 'counter', 'Total number of OPC UA connections');
    this.defineMetric('opcua_connections_active', 'gauge', 'Number of active OPC UA connections');
    this.defineMetric('opcua_connection_errors_total', 'counter', 'Total number of connection errors');
    this.defineMetric('opcua_reconnection_attempts_total', 'counter', 'Total number of reconnection attempts');

    // Data metrics
    this.defineMetric('opcua_samples_received_total', 'counter', 'Total number of OPC UA samples received');
    this.defineMetric('opcua_samples_published_total', 'counter', 'Total number of samples published to CLPM');
    this.defineMetric('opcua_publish_errors_total', 'counter', 'Total number of publish errors');
    this.defineMetric('opcua_batches_processed_total', 'counter', 'Total number of batches processed');
    this.defineMetric('opcua_queue_size', 'gauge', 'Current size of the sample queue');

    // Performance metrics
    this.defineMetric('opcua_subscription_count', 'gauge', 'Number of active subscriptions');
    this.defineMetric('opcua_monitored_items_count', 'gauge', 'Number of monitored items');
    this.defineMetric('opcua_data_processing_duration_seconds', 'histogram', 'Time spent processing data samples');
    this.defineMetric('opcua_publish_duration_seconds', 'histogram', 'Time spent publishing batches');

    // Health metrics
    this.defineMetric('opcua_health_check_duration_seconds', 'histogram', 'Duration of health checks');
    this.defineMetric('opcua_memory_usage_bytes', 'gauge', 'Memory usage in bytes');
    this.defineMetric('opcua_cpu_usage_percent', 'gauge', 'CPU usage percentage');

    // Quality metrics
    this.defineMetric('opcua_good_quality_samples_total', 'counter', 'Total samples with good quality');
    this.defineMetric('opcua_uncertain_quality_samples_total', 'counter', 'Total samples with uncertain quality');
    this.defineMetric('opcua_bad_quality_samples_total', 'counter', 'Total samples with bad quality');

    // Certificate metrics
    this.defineMetric('opcua_certificates_trusted_total', 'gauge', 'Number of trusted certificates');
    this.defineMetric('opcua_certificates_rejected_total', 'gauge', 'Number of rejected certificates');
    this.defineMetric('opcua_certificates_expiring_soon_total', 'gauge', 'Number of certificates expiring soon');

    // Configuration metrics
    this.defineMetric('opcua_servers_configured_total', 'gauge', 'Number of configured servers');
    this.defineMetric('opcua_loops_configured_total', 'gauge', 'Number of configured loops');
    this.defineMetric('opcua_config_reload_total', 'counter', 'Total number of configuration reloads');

    // System metrics
    this.defineMetric('opcua_uptime_seconds', 'gauge', 'Application uptime in seconds');
    this.defineMetric('opcua_start_time_seconds', 'gauge', 'Application start time as Unix timestamp');

    this.logger.info({ metricCount: this.metricDefinitions.size }, 'Metrics collector initialized');
  }

  /**
   * Define a metric
   */
  private defineMetric(name: string, type: PrometheusMetric['type'], help: string): void {
    this.metricDefinitions.set(name, { name, type, help });
    this.metrics.set(name, []);
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const timestamp = Date.now();
    const metricValues = this.metrics.get(name) || [];
    
    metricValues.push({ value, timestamp, labels });
    
    // Keep only last 1000 values for memory efficiency
    if (metricValues.length > 1000) {
      metricValues.splice(0, metricValues.length - 1000);
    }
    
    this.metrics.set(name, metricValues);
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const current = this.getCurrentValue(name, labels) || 0;
    this.recordMetric(name, current + value, labels);
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  /**
   * Record histogram/summary metric (simplified - just records the value)
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  /**
   * Get current value of a metric
   */
  private getCurrentValue(name: string, labels?: Record<string, string>): number | undefined {
    const metricValues = this.metrics.get(name);
    if (!metricValues || metricValues.length === 0) {
      return undefined;
    }

    // Find the latest value with matching labels
    for (let i = metricValues.length - 1; i >= 0; i--) {
      const metric = metricValues[i];
      if (this.labelsMatch(metric.labels, labels)) {
        return metric.value;
      }
    }

    return undefined;
  }

  /**
   * Check if labels match
   */
  private labelsMatch(labels1?: Record<string, string>, labels2?: Record<string, string>): boolean {
    if (!labels1 && !labels2) return true;
    if (!labels1 || !labels2) return false;

    const keys1 = Object.keys(labels1);
    const keys2 = Object.keys(labels2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every(key => labels1[key] === labels2[key]);
  }

  /**
   * Update connection metrics
   */
  updateConnectionMetrics(statuses: ConnectionStatus[]): void {
    const connected = statuses.filter(s => s.status === 'connected').length;
    const errors = statuses.filter(s => s.status === 'error').length;
    const total = statuses.length;

    this.setGauge('opcua_connections_active', connected);
    this.setGauge('opcua_connections_total', total);
    
    // Update per-server metrics
    for (const status of statuses) {
      const labels = { server_id: status.serverId, endpoint: status.endpoint };
      
      this.setGauge('opcua_monitored_items_count', status.monitoredItems, labels);
      this.setGauge('opcua_subscription_count', status.activeSessions, labels);
      
      if (status.reconnectAttempts > 0) {
        this.incrementCounter('opcua_reconnection_attempts_total', status.reconnectAttempts, labels);
      }
    }
  }

  /**
   * Record data sample metrics
   */
  recordDataSample(serverId: string, loopId: string, qualityCode: number): void {
    const labels = { server_id: serverId, loop_id: loopId };
    
    this.incrementCounter('opcua_samples_received_total', 1, labels);
    
    // Quality metrics based on normalized quality codes
    if (qualityCode === 0) {
      this.incrementCounter('opcua_good_quality_samples_total', 1, labels);
    } else if (qualityCode === 1) {
      this.incrementCounter('opcua_uncertain_quality_samples_total', 1, labels);
    } else {
      this.incrementCounter('opcua_bad_quality_samples_total', 1, labels);
    }
  }

  /**
   * Record batch processing metrics
   */
  recordBatchProcessed(sampleCount: number, processingTimeMs: number, success: boolean): void {
    this.incrementCounter('opcua_batches_processed_total');
    this.recordHistogram('opcua_data_processing_duration_seconds', processingTimeMs / 1000);
    
    if (success) {
      this.incrementCounter('opcua_samples_published_total', sampleCount);
    } else {
      this.incrementCounter('opcua_publish_errors_total');
    }
  }

  /**
   * Record publish metrics
   */
  recordPublish(duration: number, success: boolean, destination: string): void {
    const labels = { destination };
    
    this.recordHistogram('opcua_publish_duration_seconds', duration / 1000, labels);
    
    if (!success) {
      this.incrementCounter('opcua_publish_errors_total', 1, labels);
    }
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(memoryUsed: number, cpuUsage: number): void {
    this.setGauge('opcua_memory_usage_bytes', memoryUsed);
    this.setGauge('opcua_cpu_usage_percent', cpuUsage);
    this.setGauge('opcua_uptime_seconds', (Date.now() - this.startTime) / 1000);
    this.setGauge('opcua_start_time_seconds', this.startTime / 1000);
  }

  /**
   * Update queue metrics
   */
  updateQueueMetrics(queueSize: number): void {
    this.setGauge('opcua_queue_size', queueSize);
  }

  /**
   * Update certificate metrics
   */
  updateCertificateMetrics(trusted: number, rejected: number, expiringSoon: number): void {
    this.setGauge('opcua_certificates_trusted_total', trusted);
    this.setGauge('opcua_certificates_rejected_total', rejected);
    this.setGauge('opcua_certificates_expiring_soon_total', expiringSoon);
  }

  /**
   * Update configuration metrics
   */
  updateConfigurationMetrics(servers: number, loops: number): void {
    this.setGauge('opcua_servers_configured_total', servers);
    this.setGauge('opcua_loops_configured_total', loops);
  }

  /**
   * Record configuration reload
   */
  recordConfigurationReload(): void {
    this.incrementCounter('opcua_config_reload_total');
  }

  /**
   * Record health check
   */
  recordHealthCheck(duration: number): void {
    this.recordHistogram('opcua_health_check_duration_seconds', duration / 1000);
  }

  /**
   * Get all metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    for (const [name, definition] of this.metricDefinitions) {
      const values = this.metrics.get(name) || [];
      
      if (values.length === 0) continue;
      
      // Add HELP and TYPE lines
      lines.push(`# HELP ${definition.name} ${definition.help}`);
      lines.push(`# TYPE ${definition.name} ${definition.type}`);
      
      // For counters and gauges, use the latest value
      if (definition.type === 'counter' || definition.type === 'gauge') {
        const latest = values[values.length - 1];
        if (latest) {
          const labelStr = this.formatLabels(latest.labels);
          lines.push(`${definition.name}${labelStr} ${latest.value} ${latest.timestamp}`);
        }
      }
      // For histograms and summaries, we'd need more complex logic
      else if (definition.type === 'histogram' || definition.type === 'summary') {
        // Simplified: just add the latest value
        const latest = values[values.length - 1];
        if (latest) {
          const labelStr = this.formatLabels(latest.labels);
          lines.push(`${definition.name}${labelStr} ${latest.value} ${latest.timestamp}`);
        }
      }
    }
    
    return lines.join('\n') + '\n';
  }

  /**
   * Format labels for Prometheus output
   */
  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    
    const labelPairs = Object.entries(labels)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `{${labelPairs}}`;
  }

  /**
   * Get metrics as JSON (for HTTP API)
   */
  getMetricsAsJson(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, values] of this.metrics) {
      if (values.length > 0) {
        const latest = values[values.length - 1];
        result[name] = {
          value: latest.value,
          timestamp: latest.timestamp,
          labels: latest.labels
        };
      }
    }
    
    return result;
  }

  /**
   * Get metric summary for health checks
   */
  getMetricSummary(): {
    totalMetrics: number;
    dataPoints: number;
    lastUpdate: number;
    memoryUsage: number;
  } {
    const totalDataPoints = Array.from(this.metrics.values())
      .reduce((sum, values) => sum + values.length, 0);
    
    const lastUpdates = Array.from(this.metrics.values())
      .map(values => values.length > 0 ? values[values.length - 1].timestamp : 0)
      .filter(t => t > 0);
    
    const lastUpdate = lastUpdates.length > 0 ? Math.max(...lastUpdates) : 0;
    
    // Estimate memory usage (rough calculation)
    const avgMetricSize = 100; // bytes per metric value (estimate)
    const memoryUsage = totalDataPoints * avgMetricSize;
    
    return {
      totalMetrics: this.metricDefinitions.size,
      dataPoints: totalDataPoints,
      lastUpdate,
      memoryUsage
    };
  }

  /**
   * Clear old metrics data
   */
  clearOldMetrics(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - maxAgeMs;
    let clearedCount = 0;
    
    for (const [name, values] of this.metrics) {
      const originalLength = values.length;
      const filteredValues = values.filter(v => v.timestamp > cutoffTime);
      
      if (filteredValues.length < originalLength) {
        this.metrics.set(name, filteredValues);
        clearedCount += originalLength - filteredValues.length;
      }
    }
    
    if (clearedCount > 0) {
      this.logger.debug({ clearedCount, maxAgeMs }, 'Cleared old metrics data');
    }
    
    return clearedCount;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const name of this.metrics.keys()) {
      this.metrics.set(name, []);
    }
    this.logger.info('All metrics reset');
  }
}