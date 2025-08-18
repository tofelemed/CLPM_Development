// OPC UA TypeScript interfaces based on backend types

export interface ServerConfig {
  id: string;
  name: string;
  endpointUrl: string;
  securityPolicy: SecurityPolicy;
  securityMode: MessageSecurityMode;
  
  // Certificate Configuration
  clientCertificate?: string;
  clientPrivateKey?: string;
  
  // Authentication
  userAuthMethod: 'anonymous' | 'username' | 'certificate';
  username?: string;
  password?: string;
  userCertificate?: string;
  userPrivateKey?: string;
  
  // Connection Settings
  trustUnknownCerts: boolean;
  samplingInterval: number;
  maxSessionSubscriptions: number;
  
  // Redundancy
  redundantEndpoints: string[];
  
  // Additional Settings
  requestedSessionTimeout?: number;
  keepAliveInterval?: number;
  maxNotificationsPerPublish?: number;
  enabled: boolean;
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

export interface LoopSubscription {
  loopId: string;
  serverId: string;
  tags: TagSubscription[];
  samplingInterval: number;
  enabled: boolean;
}

export interface TagSubscription {
  nodeId: string;
  attribute: string;
  samplingInterval?: number;
  tagType: 'pv' | 'op' | 'sp' | 'mode' | 'valve' | 'custom';
  displayName?: string;
}

export interface HealthStatus {
  status: 'starting' | 'healthy' | 'degraded' | 'unhealthy';
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
}

export interface DataSample {
  loopId: string;
  timestamp: Date;
  serverTimestamp: Date;
  qualityCode: number;
  serverId: string;
  pv?: number;
  op?: number;
  sp?: number;
  mode?: number;
  valve?: number;
  source: string;
  metadata?: {
    opcuaNodeIds?: Record<string, string>;
    samplingInterval?: number;
    subscriptionId?: string;
    connectionQuality?: string;
  };
}

export interface BrowseNode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: string;
  dataType?: string;
  accessLevel?: string;
  hasChildren: boolean;
  value?: any;
  quality?: string;
  timestamp?: Date;
}

export interface SecurityOption {
  securityMode: MessageSecurityMode;
  securityPolicy: SecurityPolicy;
  endpoint: string;
  userTokenTypes: string[];
}

// Enums matching backend
export type SecurityPolicy = 
  | 'http://opcfoundation.org/UA/SecurityPolicy#None'
  | 'http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15'
  | 'http://opcfoundation.org/UA/SecurityPolicy#Basic256'
  | 'http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256'
  | 'http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep'
  | 'http://opcfoundation.org/UA/SecurityPolicy#Aes256_Sha256_RsaPss';

export type MessageSecurityMode = 'None' | 'Sign' | 'SignAndEncrypt';

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Frontend-specific types
export interface ServerFormData {
  name: string;
  endpointUrl: string;
  securityPolicy: string;
  securityMode: string;
  userAuthMethod: 'anonymous' | 'username' | 'certificate';
  username?: string;
  password?: string;
  trustUnknownCerts: boolean;
  samplingInterval: number;
  maxSessionSubscriptions: number;
  enabled: boolean;
}

export interface TagBrowseState {
  currentPath: string;
  nodes: BrowseNode[];
  loading: boolean;
  error?: string;
  selectedNodes: Set<string>;
}
