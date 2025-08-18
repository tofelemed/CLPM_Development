import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { ConfigManager } from './config/ConfigManager.js';
import { CertificateManager } from './security/CertificateManager.js';
import { ConnectionManager } from './core/ConnectionManager.js';
import { TagBrowser } from './browser/TagBrowser.js';
import { DataPublisher } from './data/DataPublisher.js';
import { DataTransformer } from './data/DataTransformer.js';
import { HealthMonitor } from './monitoring/HealthMonitor.js';
import { MetricsCollector } from './monitoring/MetricsCollector.js';
import { ResilienceManager } from './resilience/ResilienceManager.js';
import { ClientConfig, ServerConfig, LoopSubscription, DataSample, HealthStatus } from './types/index.js';

export class OPCUAClient extends EventEmitter {
  private logger: Logger;
  private config: ClientConfig;
  private configManager: ConfigManager;
  private certificateManager: CertificateManager;
  private connectionManager: ConnectionManager;
  private tagBrowser: TagBrowser;
  private dataPublisher: DataPublisher;
  private dataTransformer: DataTransformer;
  private healthMonitor: HealthMonitor;
  private metricsCollector: MetricsCollector;
  private resilienceManager: ResilienceManager;
  
  private isInitialized = false;
  private isShutdown = false;
  private healthStatus: HealthStatus = {
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

  constructor(logger: Logger, config: ClientConfig) {
    super();
    this.logger = logger.child({ component: 'OPCUAClient' });
    this.config = config;

    // Initialize managers
    this.configManager = new ConfigManager(this.logger, this.config);
    this.certificateManager = new CertificateManager(this.logger, this.config);
    this.connectionManager = new ConnectionManager(
      this.logger, 
      this.config, 
      this.certificateManager
    );
    this.tagBrowser = new TagBrowser(this.logger, this.connectionManager);
    
    // Initialize monitoring
    this.healthMonitor = new HealthMonitor(this.logger, this.config.healthCheckIntervalMs);
    this.metricsCollector = new MetricsCollector(this.logger);
    this.resilienceManager = new ResilienceManager(this.logger);
    
    // Initialize data handling
    this.dataTransformer = new DataTransformer(this.logger, this.config.applicationName);
    this.dataPublisher = new DataPublisher(this.logger, {
      batchSize: this.config.batchSize || 100,
      batchTimeoutMs: this.config.batchTimeoutMs || 5000,
      maxQueueSize: this.config.maxQueueSize || 10000,
      enableRetry: true,
      maxRetries: 3,
      retryDelayMs: 5000,
      
      // Configure based on environment variables
      http: process.env.CLPM_HTTP_ENDPOINT ? {
        enabled: true,
        endpoint: process.env.CLPM_HTTP_ENDPOINT,
        timeout: Number(process.env.CLPM_HTTP_TIMEOUT) || 30000,
        retries: Number(process.env.CLPM_HTTP_RETRIES) || 3,
        headers: process.env.CLPM_HTTP_HEADERS ? 
          JSON.parse(process.env.CLPM_HTTP_HEADERS) : undefined
      } : undefined,
      
      rabbitmq: process.env.CLPM_RABBITMQ_URL ? {
        enabled: true,
        url: process.env.CLPM_RABBITMQ_URL,
        exchange: process.env.CLPM_RABBITMQ_EXCHANGE || 'clpm.data',
        routingKey: process.env.CLPM_RABBITMQ_ROUTING_KEY || 'raw.samples',
        queue: process.env.CLPM_RABBITMQ_QUEUE
      } : undefined,
      
      database: process.env.CLPM_DATABASE_URL ? {
        enabled: true,
        connectionString: process.env.CLPM_DATABASE_URL,
        table: process.env.CLPM_DATABASE_TABLE || 'raw_samples',
        batchSize: Number(process.env.CLPM_DATABASE_BATCH_SIZE) || 1000
      } : undefined
    });

    this.setupEventHandlers();
  }

  /**
   * Initialize the OPC UA client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing OPC UA client...');
      this.healthStatus.status = 'initializing';

      // Initialize managers in sequence
      await this.certificateManager.initialize();
      await this.configManager.initialize();
      await this.connectionManager.initialize();
      await this.dataPublisher.initialize();
      
      // Initialize monitoring
      this.healthMonitor.start();
      this.resilienceManager.initialize(this.connectionManager);

      // Connect to configured servers
      await this.connectToServers();

      // Subscribe to configured loops
      await this.subscribeToLoops();

      this.isInitialized = true;
      this.healthStatus.status = 'healthy';
      this.healthStatus.timestamp = new Date();

      this.logger.info('OPC UA client initialized successfully');
      this.emit('initialized');

    } catch (error) {
      this.healthStatus.status = 'error';
      this.logger.error({ error }, 'Failed to initialize OPC UA client');
      throw error;
    }
  }

  /**
   * Connect to all configured servers
   */
  private async connectToServers(): Promise<void> {
    const servers = this.configManager.getServers().filter(s => s.enabled);
    
    this.logger.info({ serverCount: servers.length }, 'Connecting to servers');

    for (const server of servers) {
      try {
        await this.connectionManager.addServer(server);
      } catch (error) {
        this.logger.error({ 
          error, 
          serverId: server.id 
        }, 'Failed to connect to server');
        // Continue with other servers
      }
    }
  }

  /**
   * Subscribe to all configured loops
   */
  private async subscribeToLoops(): Promise<void> {
    const loops = this.configManager.getLoops().filter(l => l.enabled);
    
    this.logger.info({ loopCount: loops.length }, 'Setting up loop subscriptions');

    for (const loop of loops) {
      try {
        await this.subscribeToLoop(loop);
      } catch (error) {
        this.logger.error({ 
          error, 
          loopId: loop.loopId 
        }, 'Failed to subscribe to loop');
        // Continue with other loops
      }
    }
  }

  /**
   * Subscribe to a specific loop
   */
  private async subscribeToLoop(loop: LoopSubscription): Promise<void> {
    for (const [tagType, tagConfig] of Object.entries(loop.tags)) {
      if (tagConfig) {
        await this.connectionManager.addMonitoredItem(
          loop.serverId,
          loop.loopId,
          tagType,
          tagConfig
        );
      }
    }

    this.logger.debug({ 
      loopId: loop.loopId, 
      serverId: loop.serverId,
      tagCount: Object.keys(loop.tags).length 
    }, 'Subscribed to loop');
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Configuration changes
    this.configManager.on('serverConfigChanged', async (event) => {
      await this.handleServerConfigChange(event);
    });

    this.configManager.on('loopConfigChanged', async (event) => {
      await this.handleLoopConfigChange(event);
    });

    // Connection events
    this.connectionManager.on('connected', (event) => {
      this.healthStatus.connections.connected++;
      
      // Update monitoring
      this.metricsCollector.incrementCounter('opcua_connections_total', 1, { 
        server_id: event.serverId 
      });
      
      this.logger.info({ serverId: event.serverId }, 'Server connected');
      this.emit('serverConnected', event);
    });

    this.connectionManager.on('disconnected', (event) => {
      this.healthStatus.connections.connected--;
      this.healthStatus.connections.disconnected++;
      this.logger.info({ serverId: event.serverId }, 'Server disconnected');
      this.emit('serverDisconnected', event);
    });

    this.connectionManager.on('connectionFailed', (event) => {
      this.healthStatus.connections.errors++;
      this.logger.error({ 
        serverId: event.serverId, 
        error: event.error 
      }, 'Server connection failed');
      this.emit('serverConnectionFailed', event);
    });

    // Data events
    this.connectionManager.on('dataChanged', async (event) => {
      // Update metrics
      this.metricsCollector.recordDataSample(
        event.serverId,
        event.loopId,
        event.sample.qualityCode
      );
      
      await this.handleDataChange(event);
    });

    // Publisher events
    this.dataPublisher.on('batchPublished', (event) => {
      this.healthStatus.data.batchesPublished++;
      
      // Update metrics
      this.metricsCollector.recordBatchProcessed(
        event.sampleCount,
        0, // Duration would be tracked by publisher
        true
      );
      
      this.logger.debug({ 
        sampleCount: event.sampleCount 
      }, 'Batch published');
    });

    this.dataPublisher.on('publishError', (event) => {
      this.healthStatus.data.publishErrors++;
      this.logger.error({ 
        type: event.type, 
        error: event.error 
      }, 'Publish error');
    });

    // Certificate events
    this.certificateManager.on('certificateTrusted', (event) => {
      this.logger.info({ 
        thumbprint: event.thumbprint,
        subject: event.subject 
      }, 'Certificate trusted');
    });

    this.certificateManager.on('certificateRevoked', (event) => {
      this.logger.warn({ 
        thumbprint: event.thumbprint,
        subject: event.subject 
      }, 'Certificate revoked');
    });
  }

  /**
   * Handle server configuration changes
   */
  private async handleServerConfigChange(event: any): Promise<void> {
    const { action, serverId, config } = event;

    try {
      switch (action) {
        case 'added':
        case 'updated':
          if (config.enabled) {
            await this.connectionManager.addServer(config);
          } else {
            await this.connectionManager.removeServer(serverId);
          }
          break;

        case 'removed':
          await this.connectionManager.removeServer(serverId);
          break;
      }

      this.logger.info({ action, serverId }, 'Server configuration change processed');

    } catch (error) {
      this.logger.error({ 
        error, 
        action, 
        serverId 
      }, 'Failed to process server configuration change');
    }
  }

  /**
   * Handle loop configuration changes
   */
  private async handleLoopConfigChange(event: any): Promise<void> {
    const { action, loopId, serverId, config } = event;

    try {
      switch (action) {
        case 'added':
        case 'updated':
          if (config.enabled) {
            await this.subscribeToLoop(config);
          } else {
            // Remove monitored items for this loop
            for (const tagType of Object.keys(config.tags)) {
              const itemId = `${loopId}.${tagType}`;
              await this.connectionManager.removeMonitoredItem(serverId, itemId);
            }
          }
          break;

        case 'removed':
          // Remove all monitored items for this loop
          for (const tagType of ['pv', 'op', 'sp', 'mode', 'valve']) {
            const itemId = `${loopId}.${tagType}`;
            await this.connectionManager.removeMonitoredItem(serverId, itemId);
          }
          break;
      }

      this.logger.info({ action, loopId, serverId }, 'Loop configuration change processed');

    } catch (error) {
      this.logger.error({ 
        error, 
        action, 
        loopId, 
        serverId 
      }, 'Failed to process loop configuration change');
    }
  }

  /**
   * Handle data change from OPC UA server
   */
  private async handleDataChange(event: any): Promise<void> {
    try {
      const { sample } = event;
      
      // Update health status
      this.healthStatus.data.samplesProcessed++;
      this.healthStatus.data.lastSampleTime = new Date();

      // Publish the sample
      await this.dataPublisher.publishSample(sample);

      this.emit('dataReceived', event);

    } catch (error) {
      this.logger.error({ error, event }, 'Failed to handle data change');
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus {
    // Update runtime stats
    this.healthStatus.uptime = process.uptime();
    this.healthStatus.timestamp = new Date();
    
    // Update memory stats
    const memUsage = process.memoryUsage();
    this.healthStatus.memory = {
      used: memUsage.heapUsed,
      free: memUsage.heapTotal - memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };

    // Update connection counts
    const statuses = this.connectionManager.getAllConnectionStatuses();
    this.healthStatus.connections.total = statuses.length;
    this.healthStatus.connections.connected = statuses.filter(s => s.status === 'connected').length;
    this.healthStatus.connections.disconnected = statuses.filter(s => s.status === 'disconnected').length;

    return { ...this.healthStatus };
  }

  /**
   * Get system metrics
   */
  getMetrics(): {
    connections: any[];
    publisher: any;
    transformer: any;
    certificates: any;
    config: any;
    resilience?: any;
    metricsCollector?: any;
  } {
    return {
      connections: this.connectionManager.getAllConnectionStatuses(),
      publisher: this.dataPublisher.getStatistics(),
      transformer: this.dataTransformer.getStatistics(),
      certificates: {}, // Would be populated from certificate manager
      config: this.configManager.getStatistics(),
      resilience: this.resilienceManager.getStatistics(),
      metricsCollector: this.metricsCollector.getMetricSummary()
    };
  }

  /**
   * Get health monitor
   */
  getHealthMonitor(): HealthMonitor {
    return this.healthMonitor;
  }

  /**
   * Get metrics collector
   */
  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  /**
   * Get resilience manager
   */
  getResilienceManager(): ResilienceManager {
    return this.resilienceManager;
  }

  // Public API methods

  /**
   * Browse address space
   */
  async browse(serverId: string, nodeId?: string, maxResults?: number) {
    return this.tagBrowser.browse(serverId, nodeId, maxResults);
  }

  /**
   * Search for nodes
   */
  async search(serverId: string, searchTerm: string, maxResults?: number) {
    return this.tagBrowser.search(serverId, searchTerm, maxResults);
  }

  /**
   * Get node details
   */
  async getNodeDetails(serverId: string, nodeId: string) {
    return this.tagBrowser.getNodeDetails(serverId, nodeId);
  }

  /**
   * Validate node
   */
  async validateNode(serverId: string, nodeId: string) {
    return this.tagBrowser.validateNode(serverId, nodeId);
  }

  /**
   * Read values from multiple nodes
   */
  async readNodes(serverId: string, nodeIds: string[]) {
    return this.connectionManager.readNodes(serverId, nodeIds);
  }

  /**
   * Get server configurations
   */
  getServers(): ServerConfig[] {
    return this.configManager.getServers();
  }

  /**
   * Get loop subscriptions
   */
  getLoops(): LoopSubscription[] {
    return this.configManager.getLoops();
  }

  /**
   * Add or update server configuration
   */
  async setServer(serverConfig: ServerConfig): Promise<void> {
    return this.configManager.setServer(serverConfig);
  }

  /**
   * Remove server configuration
   */
  async removeServer(serverId: string): Promise<boolean> {
    return this.configManager.removeServer(serverId);
  }

  /**
   * Add or update loop subscription
   */
  async setLoop(loopSubscription: LoopSubscription): Promise<void> {
    return this.configManager.setLoop(loopSubscription);
  }

  /**
   * Remove loop subscription
   */
  async removeLoop(loopId: string): Promise<boolean> {
    return this.configManager.removeLoop(loopId);
  }

  /**
   * Get trusted certificates
   */
  async getTrustedCertificates() {
    return this.certificateManager.getTrustedCertificates();
  }

  /**
   * Get rejected certificates
   */
  async getRejectedCertificates() {
    return this.certificateManager.getRejectedCertificates();
  }

  /**
   * Trust a certificate
   */
  async trustCertificate(thumbprint: string): Promise<boolean> {
    return this.certificateManager.trustCertificate(thumbprint);
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(thumbprint: string): Promise<boolean> {
    return this.certificateManager.revokeCertificate(thumbprint);
  }

  /**
   * Force publish any pending data
   */
  async flush(): Promise<void> {
    await this.dataPublisher.flush();
  }

  /**
   * Shutdown the OPC UA client
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) {
      return;
    }

    this.isShutdown = true;
    this.healthStatus.status = 'shutting_down';

    try {
      this.logger.info('Shutting down OPC UA client...');

      // Shutdown in reverse order
      await this.dataPublisher.shutdown();
      await this.connectionManager.shutdown();
      this.configManager.stop();
      await this.certificateManager.shutdown();
      
      // Stop monitoring
      this.healthMonitor.stop();
      this.resilienceManager.shutdown();

      this.healthStatus.status = 'stopped';
      this.logger.info('OPC UA client shutdown complete');
      this.emit('shutdown');

    } catch (error) {
      this.logger.error({ error }, 'Error during shutdown');
      throw error;
    }
  }
}