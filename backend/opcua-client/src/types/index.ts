import { MessageSecurityMode, SecurityPolicy, UserTokenType } from 'node-opcua';

export interface ServerConfig {
  id: string;
  name: string;
  endpointUrl: string;
  securityPolicy: SecurityPolicy;
  securityMode: MessageSecurityMode;
  
  // Certificate Configuration
  clientCertificate?: string; // File path or base64
  clientPrivateKey?: string; // File path or base64
  
  // Authentication
  userAuthMethod: 'anonymous' | 'username' | 'certificate';
  username?: string;
  password?: string;
  userCertificate?: string;
  userPrivateKey?: string;
  
  // Connection Settings
  trustUnknownCerts: boolean;
  samplingInterval: number; // Default sampling interval in ms
  maxSessionSubscriptions: number;
  
  // Redundancy
  redundantEndpoints: string[];
  
  // Additional Settings
  requestedSessionTimeout?: number;
  keepAliveInterval?: number;
  maxNotificationsPerPublish?: number;
  enabled: boolean;
}

export interface LoopSubscription {
  loopId: string;
  tags: {
    pv?: TagSubscription;
    op?: TagSubscription;
    sp?: TagSubscription;
    mode?: TagSubscription;
    valve?: TagSubscription;
  };
  serverId: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagSubscription {
  nodeId: string;
  samplingInterval?: number;
  queueSize?: number;
  discardOldest?: boolean;
  deadbandAbsolute?: number;
  deadbandPercent?: number;
}

export interface DataSample {
  loopId: string;
  timestamp: Date;
  serverTimestamp?: Date;
  pv?: number | null;
  op?: number | null;
  sp?: number | null;
  mode?: number | string | null;
  valve?: number | null;
  valvePosition?: number | null;
  qualityCode: number;
  serverId: string;
  metadata?: Record<string, any>;
}

export interface ConnectionStatus {
  serverId: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
  endpoint: string;
  lastConnected?: Date;
  lastError?: string;
  reconnectAttempts: number;
  activeSessions: number;
  monitoredItems: number;
  redundantActive: boolean;
  connectionQuality: 'good' | 'uncertain' | 'bad';
}

export interface BrowseNode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: string;
  dataType?: string;
  accessLevel?: number;
  userAccessLevel?: number;
  hasChildren: boolean;
  isForward: boolean;
  typeDefinition?: string;
}

export interface CertificateInfo {
  thumbprint: string;
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  status: 'trusted' | 'rejected' | 'revoked' | 'unknown';
  applicationUri?: string;
  applicationName?: string;
}

export interface ClientConfig {
  // Application Identity
  applicationName: string;
  applicationUri: string;
  productUri: string;
  
  // Certificate Management
  certificateDir: string;
  autoTrustUnknownCerts: boolean;
  certificateLifetimeDays: number;
  
  // Connection Settings
  defaultSamplingInterval: number;
  maxSessionSubscriptions: number;
  maxQueueSize: number;
  connectionTimeoutMs: number;
  reconnectDelayMs: number;
  maxReconnectDelayMs: number;
  maxReconnectAttempts: number;
  
  // Data Publishing
  batchSize: number;
  batchTimeoutMs: number;
  
  // Monitoring
  healthCheckIntervalMs: number;
  metricsPort: number;
  
  // API Settings
  port: number;
  corsOrigins: string[];
  jwtSecret: string;
  apiKey: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'starting' | 'initializing' | 'error' | 'shutting_down' | 'stopped';
  timestamp: Date;
  uptime: number;
  version: string;
  connections: {
    total: number;
    connected: number;
    disconnected: number;
    failed: number;
    errors: number;
  };
  subscriptions: {
    total: number;
    active: number;
    failed: number;
  };
  dataFlow: {
    samplesPerSecond: number;
    batchesPerSecond: number;
    lastSampleTime?: Date;
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  certificates: {
    trusted: number;
    rejected: number;
    revoked: number;
    expiringSoon: number;
  };
  data?: any;
}

export interface Metrics {
  connections_total: number;
  connections_active: number;
  connections_failed_total: number;
  reconnections_total: number;
  sessions_total: number;
  subscriptions_total: number;
  monitored_items_total: number;
  samples_received_total: number;
  samples_published_total: number;
  samples_failed_total: number;
  certificates_trusted_total: number;
  certificates_rejected_total: number;
  uptime_seconds: number;
}

// Event Types
export interface ConnectionEvent {
  type: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  serverId: string;
  endpoint: string;
  timestamp: Date;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface DataEvent {
  type: 'sample' | 'subscription_added' | 'subscription_removed' | 'subscription_error';
  serverId: string;
  loopId?: string;
  nodeId?: string;
  timestamp: Date;
  data?: any;
  error?: Error;
}

export interface CertificateEvent {
  type: 'certificate_trusted' | 'certificate_rejected' | 'certificate_expired';
  thumbprint: string;
  subject: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Configuration Validation Schemas
export const ServerConfigSchema = {
  id: { type: 'string', required: true },
  name: { type: 'string', required: true },
  endpointUrl: { type: 'string', required: true, pattern: /^opc\.tcp:\/\/.+/ },
  securityPolicy: { type: 'string', enum: Object.values(SecurityPolicy) },
  securityMode: { type: 'string', enum: Object.values(MessageSecurityMode) },
  userAuthMethod: { type: 'string', enum: ['anonymous', 'username', 'certificate'] },
  trustUnknownCerts: { type: 'boolean', default: false },
  samplingInterval: { type: 'number', min: 50, max: 3600000, default: 200 },
  maxSessionSubscriptions: { type: 'number', min: 1, max: 10000, default: 1000 },
  redundantEndpoints: { type: 'array', items: { type: 'string' }, default: [] },
  enabled: { type: 'boolean', default: true }
};

export const LoopSubscriptionSchema = {
  loopId: { type: 'string', required: true },
  serverId: { type: 'string', required: true },
  tags: {
    type: 'object',
    properties: {
      pv: { type: 'object', optional: true },
      op: { type: 'object', optional: true },
      sp: { type: 'object', optional: true },
      mode: { type: 'object', optional: true },
      valve: { type: 'object', optional: true }
    }
  },
  enabled: { type: 'boolean', default: true }
};

export const TagSubscriptionSchema = {
  nodeId: { type: 'string', required: true },
  samplingInterval: { type: 'number', min: 50, max: 3600000, optional: true },
  queueSize: { type: 'number', min: 1, max: 1000, default: 10 },
  discardOldest: { type: 'boolean', default: true },
  deadbandAbsolute: { type: 'number', min: 0, optional: true },
  deadbandPercent: { type: 'number', min: 0, max: 100, optional: true }
};