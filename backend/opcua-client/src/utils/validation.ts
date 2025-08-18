import { MessageSecurityMode, SecurityPolicy } from 'node-opcua';
import { ServerConfig, LoopSubscription, TagSubscription } from '../types/index.js';

/**
 * Validate server configuration
 */
export function validateServerConfig(config: any, requireId: boolean = true): ServerConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Server configuration must be an object');
  }

  // Required fields
  if (requireId && (!config.id || typeof config.id !== 'string')) {
    throw new Error('Server ID is required and must be a string');
  }

  if (!config.name || typeof config.name !== 'string') {
    throw new Error('Server name is required and must be a string');
  }

  if (!config.endpointUrl || typeof config.endpointUrl !== 'string') {
    throw new Error('Endpoint URL is required and must be a string');
  }

  if (!config.endpointUrl.startsWith('opc.tcp://')) {
    throw new Error('Endpoint URL must start with opc.tcp://');
  }

  // Security Policy validation
  const validSecurityPolicies = Object.values(SecurityPolicy);
  if (config.securityPolicy && !validSecurityPolicies.includes(config.securityPolicy)) {
    throw new Error(`Invalid security policy. Valid options: ${validSecurityPolicies.join(', ')}`);
  }

  // Security Mode validation
  const validSecurityModes = Object.values(MessageSecurityMode);
  if (config.securityMode && !validSecurityModes.includes(config.securityMode)) {
    throw new Error(`Invalid security mode. Valid options: ${validSecurityModes.join(', ')}`);
  }

  // Authentication method validation
  const validAuthMethods = ['anonymous', 'username', 'certificate'];
  if (config.userAuthMethod && !validAuthMethods.includes(config.userAuthMethod)) {
    throw new Error(`Invalid user auth method. Valid options: ${validAuthMethods.join(', ')}`);
  }

  // Username/password validation
  if (config.userAuthMethod === 'username') {
    if (!config.username || typeof config.username !== 'string') {
      throw new Error('Username is required when using username authentication');
    }
    if (!config.password || typeof config.password !== 'string') {
      throw new Error('Password is required when using username authentication');
    }
  }

  // Certificate validation
  if (config.userAuthMethod === 'certificate') {
    if (!config.userCertificate || typeof config.userCertificate !== 'string') {
      throw new Error('User certificate is required when using certificate authentication');
    }
    if (!config.userPrivateKey || typeof config.userPrivateKey !== 'string') {
      throw new Error('User private key is required when using certificate authentication');
    }
  }

  // Numeric validations
  if (config.samplingInterval !== undefined) {
    const interval = Number(config.samplingInterval);
    if (isNaN(interval) || interval < 50 || interval > 3600000) {
      throw new Error('Sampling interval must be between 50 and 3600000 ms');
    }
  }

  if (config.maxSessionSubscriptions !== undefined) {
    const maxSubs = Number(config.maxSessionSubscriptions);
    if (isNaN(maxSubs) || maxSubs < 1 || maxSubs > 10000) {
      throw new Error('Max session subscriptions must be between 1 and 10000');
    }
  }

  // Build validated configuration
  const validatedConfig: ServerConfig = {
    id: config.id ? config.id.trim() : '', // Allow empty ID for creation
    name: config.name.trim(),
    endpointUrl: config.endpointUrl.trim(),
    securityPolicy: config.securityPolicy || SecurityPolicy.None,
    securityMode: config.securityMode || MessageSecurityMode.None,
    userAuthMethod: config.userAuthMethod || 'anonymous',
    trustUnknownCerts: Boolean(config.trustUnknownCerts),
    samplingInterval: Number(config.samplingInterval) || 200,
    maxSessionSubscriptions: Number(config.maxSessionSubscriptions) || 1000,
    redundantEndpoints: Array.isArray(config.redundantEndpoints) ? config.redundantEndpoints : [],
    enabled: config.enabled !== false, // Default to true
  };

  // Add optional fields
  if (config.clientCertificate) {
    validatedConfig.clientCertificate = config.clientCertificate;
  }
  if (config.clientPrivateKey) {
    validatedConfig.clientPrivateKey = config.clientPrivateKey;
  }
  if (config.username) {
    validatedConfig.username = config.username;
  }
  if (config.password) {
    validatedConfig.password = config.password;
  }
  if (config.userCertificate) {
    validatedConfig.userCertificate = config.userCertificate;
  }
  if (config.userPrivateKey) {
    validatedConfig.userPrivateKey = config.userPrivateKey;
  }
  if (config.requestedSessionTimeout) {
    validatedConfig.requestedSessionTimeout = Number(config.requestedSessionTimeout);
  }
  if (config.keepAliveInterval) {
    validatedConfig.keepAliveInterval = Number(config.keepAliveInterval);
  }
  if (config.maxNotificationsPerPublish) {
    validatedConfig.maxNotificationsPerPublish = Number(config.maxNotificationsPerPublish);
  }

  return validatedConfig;
}

/**
 * Validate tag subscription configuration
 */
export function validateTagSubscription(config: any): TagSubscription {
  if (!config || typeof config !== 'object') {
    throw new Error('Tag subscription configuration must be an object');
  }

  if (!config.nodeId || typeof config.nodeId !== 'string') {
    throw new Error('Node ID is required and must be a string');
  }

  const validatedTag: TagSubscription = {
    nodeId: config.nodeId.trim(),
  };

  // Optional numeric validations
  if (config.samplingInterval !== undefined) {
    const interval = Number(config.samplingInterval);
    if (isNaN(interval) || interval < 50 || interval > 3600000) {
      throw new Error('Sampling interval must be between 50 and 3600000 ms');
    }
    validatedTag.samplingInterval = interval;
  }

  if (config.queueSize !== undefined) {
    const queueSize = Number(config.queueSize);
    if (isNaN(queueSize) || queueSize < 1 || queueSize > 1000) {
      throw new Error('Queue size must be between 1 and 1000');
    }
    validatedTag.queueSize = queueSize;
  }

  if (config.discardOldest !== undefined) {
    validatedTag.discardOldest = Boolean(config.discardOldest);
  }

  if (config.deadbandAbsolute !== undefined) {
    const deadband = Number(config.deadbandAbsolute);
    if (isNaN(deadband) || deadband < 0) {
      throw new Error('Deadband absolute must be >= 0');
    }
    validatedTag.deadbandAbsolute = deadband;
  }

  if (config.deadbandPercent !== undefined) {
    const deadband = Number(config.deadbandPercent);
    if (isNaN(deadband) || deadband < 0 || deadband > 100) {
      throw new Error('Deadband percent must be between 0 and 100');
    }
    validatedTag.deadbandPercent = deadband;
  }

  return validatedTag;
}

/**
 * Validate loop subscription configuration
 */
export function validateLoopSubscription(config: any): LoopSubscription {
  if (!config || typeof config !== 'object') {
    throw new Error('Loop subscription configuration must be an object');
  }

  if (!config.loopId || typeof config.loopId !== 'string') {
    throw new Error('Loop ID is required and must be a string');
  }

  if (!config.serverId || typeof config.serverId !== 'string') {
    throw new Error('Server ID is required and must be a string');
  }

  if (!config.tags || typeof config.tags !== 'object') {
    throw new Error('Tags configuration is required and must be an object');
  }

  const validatedLoop: LoopSubscription = {
    loopId: config.loopId.trim(),
    serverId: config.serverId.trim(),
    tags: {},
    enabled: config.enabled !== false, // Default to true
    createdAt: config.createdAt ? new Date(config.createdAt) : new Date(),
    updatedAt: new Date(),
  };

  // Validate each tag type
  const tagTypes = ['pv', 'op', 'sp', 'mode', 'valve'] as const;
  for (const tagType of tagTypes) {
    if (config.tags[tagType]) {
      try {
        validatedLoop.tags[tagType] = validateTagSubscription(config.tags[tagType]);
      } catch (error) {
        throw new Error(`Invalid ${tagType} tag configuration: ${error.message}`);
      }
    }
  }

  // Ensure at least one tag is configured
  if (Object.keys(validatedLoop.tags).length === 0) {
    throw new Error('At least one tag must be configured (pv, op, sp, mode, or valve)');
  }

  return validatedLoop;
}

/**
 * Validate node ID format
 */
export function validateNodeId(nodeId: string): boolean {
  if (!nodeId || typeof nodeId !== 'string') {
    return false;
  }

  // Basic OPC UA node ID format validation
  // Examples: ns=2;i=1001, ns=2;s=Tank.Level, ns=0;g=12345678-1234-1234-1234-123456789012
  const nodeIdRegex = /^ns=\d+;[isgb]=.+$/;
  return nodeIdRegex.test(nodeId.trim());
}

/**
 * Validate endpoint URL format
 */
export function validateEndpointUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'opc.tcp:' && !!parsed.hostname && !!parsed.port;
  } catch {
    return false;
  }
}

/**
 * Sanitize configuration for logging (remove sensitive data)
 */
export function sanitizeConfig(config: any): any {
  if (!config || typeof config !== 'object') {
    return config;
  }

  const sanitized = { ...config };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'clientPrivateKey',
    'userPrivateKey',
    'privateKey',
    'secret',
    'token'
  ];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Validate environment variables
 */
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const required = ['NODE_ENV', 'PORT'];
  
  for (const envVar of required) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate numeric environment variables
  const numericVars = [
    'PORT',
    'METRICS_PORT',
    'DEFAULT_SAMPLING_INTERVAL',
    'MAX_SESSION_SUBSCRIPTIONS',
    'CONNECTION_TIMEOUT_MS',
    'BATCH_SIZE',
    'BATCH_TIMEOUT_MS'
  ];

  for (const envVar of numericVars) {
    const value = process.env[envVar];
    if (value && isNaN(Number(value))) {
      errors.push(`Environment variable ${envVar} must be a number, got: ${value}`);
    }
  }

  // Validate boolean environment variables
  const booleanVars = [
    'AUTO_TRUST_UNKNOWN_CERTS',
    'MOCK_SERVER_ENABLED'
  ];

  for (const envVar of booleanVars) {
    const value = process.env[envVar];
    if (value && !['true', 'false', '1', '0'].includes(value.toLowerCase())) {
      errors.push(`Environment variable ${envVar} must be a boolean (true/false), got: ${value}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}