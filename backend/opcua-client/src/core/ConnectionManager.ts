import { EventEmitter } from 'events';
import { Logger } from 'pino';
import {
  OPCUAClient,
  ClientSession,
  ClientSubscription,
  ClientMonitoredItem,
  AttributeIds,
  NodeId,
  DataValue,
  TimestampsToReturn,
  ReadValueId,
  ConnectionStrategyOptions,
  UserTokenType,
  AnonymousIdentityToken,
  UserNameIdentityToken,
  X509IdentityToken,
  MessageSecurityMode,
  SecurityPolicy,
  UserIdentityInfo
} from 'node-opcua';
import { ServerConfig, LoopSubscription, TagSubscription, ConnectionStatus, DataSample, ClientConfig } from '../types/index.js';
import { CertificateManager } from '../security/CertificateManager.js';

interface SessionInfo {
  client: OPCUAClient;
  session: ClientSession;
  subscription: ClientSubscription;
  monitoredItems: Map<string, ClientMonitoredItem>;
  subscriptionCount: number;
  lastActivity: Date;
  isRedundant: boolean;
}

export class ConnectionManager extends EventEmitter {
  private logger: Logger;
  private clientConfig: ClientConfig;
  private certificateManager: CertificateManager;
  private connections: Map<string, SessionInfo> = new Map();
  private serverConfigs: Map<string, ServerConfig> = new Map();
  private connectionStatus: Map<string, ConnectionStatus> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    logger: Logger,
    clientConfig: ClientConfig,
    certificateManager: CertificateManager
  ) {
    super();
    this.logger = logger.child({ component: 'ConnectionManager' });
    this.clientConfig = clientConfig;
    this.certificateManager = certificateManager;
  }

  /**
   * Initialize connection manager
   */
  async initialize(): Promise<void> {
    try {
      this.startHealthCheck();
      this.logger.info('Connection manager initialized');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize connection manager');
      throw error;
    }
  }

  /**
   * Add or update server configuration
   */
  async addServer(serverConfig: ServerConfig): Promise<void> {
    try {
      this.serverConfigs.set(serverConfig.id, serverConfig);
      
      // Initialize connection status
      this.connectionStatus.set(serverConfig.id, {
        serverId: serverConfig.id,
        status: 'disconnected',
        endpoint: serverConfig.endpointUrl,
        reconnectAttempts: 0,
        activeSessions: 0,
        monitoredItems: 0,
        redundantActive: false,
        connectionQuality: 'bad'
      });

      if (serverConfig.enabled) {
        await this.connectToServer(serverConfig);
      }

      this.logger.info({ serverId: serverConfig.id }, 'Server configuration added');
    } catch (error) {
      this.logger.error({ error, serverId: serverConfig.id }, 'Failed to add server');
      throw error;
    }
  }

  /**
   * Remove server configuration and disconnect
   */
  async removeServer(serverId: string): Promise<void> {
    try {
      await this.disconnectFromServer(serverId);
      this.serverConfigs.delete(serverId);
      this.connectionStatus.delete(serverId);
      
      // Clear any reconnect timer
      const timer = this.reconnectTimers.get(serverId);
      if (timer) {
        clearTimeout(timer);
        this.reconnectTimers.delete(serverId);
      }

      this.logger.info({ serverId }, 'Server configuration removed');
    } catch (error) {
      this.logger.error({ error, serverId }, 'Failed to remove server');
      throw error;
    }
  }

  /**
   * Connect to OPC UA server
   */
  private async connectToServer(serverConfig: ServerConfig): Promise<void> {
    const serverId = serverConfig.id;
    
    try {
      this.updateConnectionStatus(serverId, { status: 'connecting' });
      
      const client = await this.createOPCUAClient(serverConfig);
      
      // Connect to the endpoint
      await client.connect(serverConfig.endpointUrl);
      
      // Create session
      const session = await this.createSession(client, serverConfig);
      
      // Create subscription
      const subscription = await this.createSubscription(session, serverConfig);
      
      // Store session info
      const sessionInfo: SessionInfo = {
        client,
        session,
        subscription,
        monitoredItems: new Map(),
        subscriptionCount: 0,
        lastActivity: new Date(),
        isRedundant: false
      };
      
      this.connections.set(serverId, sessionInfo);
      
      // Set up event handlers
      this.setupConnectionEventHandlers(serverId, client, session, subscription);
      
      this.updateConnectionStatus(serverId, {
        status: 'connected',
        lastConnected: new Date(),
        reconnectAttempts: 0,
        activeSessions: 1,
        connectionQuality: 'good'
      });

      this.emit('connected', { serverId, endpoint: serverConfig.endpointUrl });
      
      this.logger.info({ 
        serverId, 
        endpoint: serverConfig.endpointUrl 
      }, 'Successfully connected to OPC UA server');

    } catch (error: any) {
      // Check for specific assertion errors that indicate server compatibility issues
      let errorMessage = error.message || 'Unknown connection error';
      let isCompatibilityIssue = false;

      if (error.code === 'ERR_ASSERTION' || 
          errorMessage.includes('block_info.position + block_info.length === block.length') ||
          errorMessage.includes('import_assert3.default')) {
        errorMessage = 'Server compatibility issue: The OPC UA server sends malformed messages that are incompatible with the node-opcua library. Try different security settings or contact the server vendor for OPC UA compliance updates.';
        isCompatibilityIssue = true;
      }

      this.updateConnectionStatus(serverId, {
        status: 'error',
        lastError: errorMessage,
        connectionQuality: 'bad'
      });

      this.emit('connectionFailed', { 
        serverId, 
        endpoint: serverConfig.endpointUrl, 
        error: { ...error, message: errorMessage, isCompatibilityIssue }
      });

      this.logger.error({ 
        error, 
        serverId, 
        endpoint: serverConfig.endpointUrl,
        isCompatibilityIssue
      }, isCompatibilityIssue ? 'Server compatibility issue detected' : 'Failed to connect to OPC UA server');

      // Don't schedule reconnection for compatibility issues
      if (!isCompatibilityIssue) {
        await this.scheduleReconnection(serverId);
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Create OPC UA client with proper configuration
   */
  private async createOPCUAClient(serverConfig: ServerConfig): Promise<OPCUAClient> {
    const clientCertPaths = this.certificateManager.getClientCertificatePaths();
    
    const connectionStrategy: ConnectionStrategyOptions = {
      initialDelay: this.clientConfig.reconnectDelayMs,
      maxDelay: this.clientConfig.maxReconnectDelayMs,
      maxRetry: this.clientConfig.maxReconnectAttempts,
      randomisationFactor: 0.1
    };

    const clientOptions: any = {
      applicationName: this.clientConfig.applicationName,
      applicationUri: this.clientConfig.applicationUri,
      productUri: this.clientConfig.productUri,
      
      securityMode: serverConfig.securityMode,
      securityPolicy: serverConfig.securityPolicy,
      
      certificateFile: clientCertPaths.certificate,
      privateKeyFile: clientCertPaths.privateKey,
      
      connectionStrategy,
      
      requestedSessionTimeout: serverConfig.requestedSessionTimeout || 60000,
      keepSessionAlive: true,
      
      endpoint_must_exist: false
    };

    // Add certificate manager for server certificate validation
    clientOptions.certificateManager = this.certificateManager.getOPCUACertificateManager();

    const client = OPCUAClient.create(clientOptions);
    
    return client;
  }

  /**
   * Create session with proper authentication
   */
  private async createSession(client: OPCUAClient, serverConfig: ServerConfig): Promise<ClientSession> {
    let userIdentityInfo: UserIdentityInfo | undefined;

    switch (serverConfig.userAuthMethod) {
      case 'anonymous':
        userIdentityInfo = undefined;
        break;
        
      case 'username':
        if (!serverConfig.username || !serverConfig.password) {
          throw new Error('Username and password required for username authentication');
        }
        userIdentityInfo = {
          type: UserTokenType.UserName,
          userName: serverConfig.username,
          password: serverConfig.password
        };
        break;
        
      case 'certificate':
        if (!serverConfig.userCertificate || !serverConfig.userPrivateKey) {
          throw new Error('User certificate and private key required for certificate authentication');
        }
        
        userIdentityInfo = {
          type: UserTokenType.Certificate,
          certificateData: Buffer.from(serverConfig.userCertificate),
          privateKey: serverConfig.userPrivateKey
        };
        break;
        
      default:
        throw new Error(`Unsupported authentication method: ${serverConfig.userAuthMethod}`);
    }

    const session = await client.createSession(userIdentityInfo);

    return session;
  }

  /**
   * Create subscription for data monitoring
   */
  private async createSubscription(session: ClientSession, serverConfig: ServerConfig): Promise<ClientSubscription> {
    const subscription = await session.createSubscription2({
      requestedPublishingInterval: serverConfig.samplingInterval || this.clientConfig.defaultSamplingInterval,
      requestedLifetimeCount: 1000,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: serverConfig.maxNotificationsPerPublish || 1000,
      publishingEnabled: true,
      priority: 10
    });

    return subscription;
  }

  /**
   * Set up event handlers for connection, session, and subscription
   */
  private setupConnectionEventHandlers(
    serverId: string,
    client: OPCUAClient,
    session: ClientSession,
    subscription: ClientSubscription
  ): void {
    // Client events
    client.on('connection_reestablished', () => {
      this.logger.info({ serverId }, 'OPC UA connection reestablished');
      this.updateConnectionStatus(serverId, { 
        status: 'connected',
        connectionQuality: 'good',
        reconnectAttempts: 0
      });
      this.emit('connectionReestablished', { serverId });
    });

    client.on('connection_lost', () => {
      this.logger.warn({ serverId }, 'OPC UA connection lost');
      this.updateConnectionStatus(serverId, { 
        status: 'disconnected',
        connectionQuality: 'bad'
      });
      this.emit('connectionLost', { serverId });
    });

    client.on('backoff', (retryCount: number, delay: number) => {
      this.logger.debug({ serverId, retryCount, delay }, 'Connection backoff');
      this.updateConnectionStatus(serverId, { 
        status: 'reconnecting',
        reconnectAttempts: retryCount
      });
    });

    // Session events
    session.on('session_closed', () => {
      this.logger.warn({ serverId }, 'OPC UA session closed');
      this.handleSessionClosed(serverId);
    });

    // Subscription events
    subscription.on('keepalive', () => {
      const sessionInfo = this.connections.get(serverId);
      if (sessionInfo) {
        sessionInfo.lastActivity = new Date();
      }
    });

    subscription.on('terminated', () => {
      this.logger.warn({ serverId }, 'OPC UA subscription terminated');
      this.handleSubscriptionTerminated(serverId);
    });
  }

  /**
   * Handle session closed event
   */
  private async handleSessionClosed(serverId: string): Promise<void> {
    this.updateConnectionStatus(serverId, { 
      status: 'disconnected',
      activeSessions: 0,
      connectionQuality: 'bad'
    });

    this.emit('sessionClosed', { serverId });
    
    // Attempt to reconnect
    await this.scheduleReconnection(serverId);
  }

  /**
   * Handle subscription terminated event
   */
  private async handleSubscriptionTerminated(serverId: string): Promise<void> {
    // Try to recreate subscription
    const sessionInfo = this.connections.get(serverId);
    const serverConfig = this.serverConfigs.get(serverId);
    
    if (sessionInfo && serverConfig) {
      try {
        const newSubscription = await this.createSubscription(sessionInfo.session, serverConfig);
        sessionInfo.subscription = newSubscription;
        
        this.setupConnectionEventHandlers(
          serverId,
          sessionInfo.client,
          sessionInfo.session,
          newSubscription
        );
        
        this.logger.info({ serverId }, 'Subscription recreated successfully');
      } catch (error) {
        this.logger.error({ error, serverId }, 'Failed to recreate subscription');
        await this.scheduleReconnection(serverId);
      }
    }
  }

  /**
   * Disconnect from server
   */
  private async disconnectFromServer(serverId: string): Promise<void> {
    const sessionInfo = this.connections.get(serverId);
    
    if (sessionInfo) {
      try {
        // Terminate subscription
        if (sessionInfo.subscription) {
          await sessionInfo.subscription.terminate();
        }
        
        // Close session
        if (sessionInfo.session) {
          await sessionInfo.session.close();
        }
        
        // Disconnect client
        if (sessionInfo.client) {
          await sessionInfo.client.disconnect();
        }
        
        this.connections.delete(serverId);
        
        this.updateConnectionStatus(serverId, {
          status: 'disconnected',
          activeSessions: 0,
          monitoredItems: 0,
          connectionQuality: 'bad'
        });

        this.emit('disconnected', { serverId });
        
        this.logger.info({ serverId }, 'Disconnected from OPC UA server');
        
      } catch (error) {
        this.logger.error({ error, serverId }, 'Error during disconnection');
      }
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private async scheduleReconnection(serverId: string): Promise<void> {
    const serverConfig = this.serverConfigs.get(serverId);
    const status = this.connectionStatus.get(serverId);
    
    if (!serverConfig || !serverConfig.enabled || !status) {
      return;
    }

    // Clear existing timer
    const existingTimer = this.reconnectTimers.get(serverId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Check max attempts
    if (this.clientConfig.maxReconnectAttempts > 0 && 
        status.reconnectAttempts >= this.clientConfig.maxReconnectAttempts) {
      this.logger.error({ 
        serverId, 
        maxAttempts: this.clientConfig.maxReconnectAttempts 
      }, 'Max reconnection attempts reached');
      
      this.updateConnectionStatus(serverId, { status: 'error' });
      return;
    }

    // Calculate delay with exponential backoff
    const baseDelay = this.clientConfig.reconnectDelayMs;
    const maxDelay = this.clientConfig.maxReconnectDelayMs;
    const delay = Math.min(baseDelay * Math.pow(2, status.reconnectAttempts), maxDelay);

    this.logger.info({ 
      serverId, 
      delay, 
      attempt: status.reconnectAttempts + 1 
    }, 'Scheduling reconnection');

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(serverId);
      
      try {
        await this.connectToServer(serverConfig);
      } catch (error) {
        this.logger.error({ error, serverId }, 'Reconnection failed');
      }
    }, delay);

    this.reconnectTimers.set(serverId, timer);
    
    this.updateConnectionStatus(serverId, {
      status: 'reconnecting',
      reconnectAttempts: status.reconnectAttempts + 1
    });
  }

  /**
   * Add monitored item for a loop tag
   */
  async addMonitoredItem(
    serverId: string,
    loopId: string,
    tagType: string,
    tagConfig: TagSubscription
  ): Promise<void> {
    const sessionInfo = this.connections.get(serverId);
    
    if (!sessionInfo) {
      throw new Error(`No active session for server ${serverId}`);
    }

    try {
      const itemId = `${loopId}.${tagType}`;
      
      // Check if already monitoring this item
      if (sessionInfo.monitoredItems.has(itemId)) {
        await this.removeMonitoredItem(serverId, itemId);
      }

      const monitoredItem = await sessionInfo.subscription.monitor(
        {
          nodeId: tagConfig.nodeId,
          attributeId: AttributeIds.Value
        },
        {
          samplingInterval: tagConfig.samplingInterval || this.clientConfig.defaultSamplingInterval,
          queueSize: tagConfig.queueSize || 10,
          discardOldest: tagConfig.discardOldest !== false
        },
        TimestampsToReturn.Both
      );

      // Set up data change handler
      monitoredItem.on('changed', (dataValue: DataValue) => {
        this.handleDataChange(serverId, loopId, tagType, tagConfig.nodeId, dataValue);
      });

      sessionInfo.monitoredItems.set(itemId, monitoredItem);
      sessionInfo.subscriptionCount++;
      
      this.updateConnectionStatus(serverId, {
        monitoredItems: sessionInfo.monitoredItems.size
      });

      this.logger.debug({ 
        serverId, 
        loopId, 
        tagType, 
        nodeId: tagConfig.nodeId 
      }, 'Added monitored item');

      this.emit('monitoredItemAdded', { 
        serverId, 
        loopId, 
        tagType, 
        nodeId: tagConfig.nodeId 
      });

    } catch (error) {
      this.logger.error({ 
        error, 
        serverId, 
        loopId, 
        tagType, 
        nodeId: tagConfig.nodeId 
      }, 'Failed to add monitored item');
      throw error;
    }
  }

  /**
   * Remove monitored item
   */
  async removeMonitoredItem(serverId: string, itemId: string): Promise<void> {
    const sessionInfo = this.connections.get(serverId);
    
    if (!sessionInfo) {
      return;
    }

    const monitoredItem = sessionInfo.monitoredItems.get(itemId);
    if (monitoredItem) {
      try {
        await monitoredItem.terminate();
        sessionInfo.monitoredItems.delete(itemId);
        sessionInfo.subscriptionCount--;
        
        this.updateConnectionStatus(serverId, {
          monitoredItems: sessionInfo.monitoredItems.size
        });

        this.logger.debug({ serverId, itemId }, 'Removed monitored item');
        
        this.emit('monitoredItemRemoved', { serverId, itemId });
        
      } catch (error) {
        this.logger.error({ error, serverId, itemId }, 'Failed to remove monitored item');
      }
    }
  }

  /**
   * Handle data change from monitored item
   */
  private handleDataChange(
    serverId: string,
    loopId: string,
    tagType: string,
    nodeId: string,
    dataValue: DataValue
  ): void {
    try {
      const timestamp = new Date();
      const serverTimestamp = dataValue.serverTimestamp || timestamp;
      const value = dataValue.value?.value;
      const qualityCode = dataValue.statusCode?.value || 0;

      // Create data sample
      const sample: DataSample = {
        loopId,
        timestamp,
        serverTimestamp,
        qualityCode,
        serverId,
        [tagType]: value
      };

      // Update last activity
      const sessionInfo = this.connections.get(serverId);
      if (sessionInfo) {
        sessionInfo.lastActivity = new Date();
      }

      this.emit('dataChanged', { 
        serverId, 
        loopId, 
        tagType, 
        nodeId, 
        sample 
      });

      this.logger.debug({ 
        serverId, 
        loopId, 
        tagType, 
        nodeId, 
        value, 
        quality: qualityCode 
      }, 'Data changed');

    } catch (error) {
      this.logger.error({ 
        error, 
        serverId, 
        loopId, 
        tagType, 
        nodeId 
      }, 'Error handling data change');
    }
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(serverId: string, updates: Partial<ConnectionStatus>): void {
    const current = this.connectionStatus.get(serverId);
    if (current) {
      const updated = { ...current, ...updates };
      this.connectionStatus.set(serverId, updated);
      this.emit('statusChanged', { serverId, status: updated });
    }
  }

  /**
   * Get connection status for a server
   */
  getConnectionStatus(serverId: string): ConnectionStatus | undefined {
    return this.connectionStatus.get(serverId);
  }

  /**
   * Get all connection statuses
   */
  getAllConnectionStatuses(): ConnectionStatus[] {
    return Array.from(this.connectionStatus.values());
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.clientConfig.healthCheckIntervalMs);
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const now = new Date();
    
    for (const [serverId, sessionInfo] of this.connections) {
      const timeSinceActivity = now.getTime() - sessionInfo.lastActivity.getTime();
      const status = this.connectionStatus.get(serverId);
      
      if (status && timeSinceActivity > 60000) { // 1 minute without activity
        if (status.connectionQuality === 'good') {
          this.updateConnectionStatus(serverId, { connectionQuality: 'uncertain' });
        }
      }
      
      if (timeSinceActivity > 300000) { // 5 minutes without activity
        this.updateConnectionStatus(serverId, { connectionQuality: 'bad' });
        this.logger.warn({ serverId, timeSinceActivity }, 'Connection appears unhealthy');
      }
    }
  }

  /**
   * Read values from multiple nodes
   */
  async readNodes(serverId: string, nodeIds: string[]): Promise<DataValue[]> {
    const sessionInfo = this.connections.get(serverId);
    
    if (!sessionInfo) {
      throw new Error(`No active session for server ${serverId}`);
    }

    const readRequest = nodeIds.map(nodeId => ({
      nodeId,
      attributeId: AttributeIds.Value
    }));

    try {
      const dataValues = await sessionInfo.session.read(readRequest);
      return dataValues;
    } catch (error) {
      this.logger.error({ error, serverId, nodeIds }, 'Failed to read nodes');
      throw error;
    }
  }

  /**
   * Shutdown connection manager
   */
  async shutdown(): Promise<void> {
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Clear all reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Disconnect from all servers
    const disconnectPromises = Array.from(this.serverConfigs.keys()).map(serverId =>
      this.disconnectFromServer(serverId)
    );

    await Promise.allSettled(disconnectPromises);
    
    this.logger.info('Connection manager shutdown complete');
  }
}