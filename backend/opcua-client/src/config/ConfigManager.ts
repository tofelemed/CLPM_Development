import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import YAML from 'yaml';
import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { ServerConfig, LoopSubscription, ClientConfig } from '../types/index.js';
import { validateServerConfig, validateLoopSubscription } from '../utils/validation.js';

export class ConfigManager extends EventEmitter {
  private logger: Logger;
  private configFile: string;
  private servers: Map<string, ServerConfig> = new Map();
  private loops: Map<string, LoopSubscription> = new Map();
  private clientConfig: ClientConfig;
  private watchInterval?: NodeJS.Timeout;

  constructor(logger: Logger, clientConfig: ClientConfig, configFile?: string) {
    super();
    this.logger = logger.child({ component: 'ConfigManager' });
    this.clientConfig = clientConfig;
    this.configFile = configFile || process.env.CONFIG_FILE || './config/servers.yaml';
  }

  /**
   * Initialize configuration manager
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfiguration();
      this.startConfigWatcher();
      this.logger.info('Configuration manager initialized');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize configuration manager');
      throw error;
    }
  }

  /**
   * Load configuration from file or database
   */
  private async loadConfiguration(): Promise<void> {
    const configSource = process.env.CONFIG_SOURCE || 'file';
    
    if (configSource === 'file') {
      await this.loadFromFile();
    } else if (configSource === 'database') {
      await this.loadFromDatabase();
    } else {
      throw new Error(`Unsupported configuration source: ${configSource}`);
    }
  }

  /**
   * Load configuration from YAML file
   */
  private async loadFromFile(): Promise<void> {
    try {
      // Check if config file exists
      await access(this.configFile);
      
      const content = await readFile(this.configFile, 'utf-8');
      const config = YAML.parse(content);
      
      // Validate and load servers
      if (config.servers) {
        for (const serverConfig of config.servers) {
          try {
            const validatedConfig = validateServerConfig(serverConfig);
            this.servers.set(validatedConfig.id, validatedConfig);
            this.logger.debug({ serverId: validatedConfig.id }, 'Loaded server configuration');
          } catch (error) {
            this.logger.error({ error, serverConfig }, 'Invalid server configuration');
          }
        }
      }

      // Validate and load loop subscriptions
      if (config.loops) {
        for (const loopConfig of config.loops) {
          try {
            const validatedLoop = validateLoopSubscription(loopConfig);
            this.loops.set(validatedLoop.loopId, validatedLoop);
            this.logger.debug({ loopId: validatedLoop.loopId }, 'Loaded loop subscription');
          } catch (error) {
            this.logger.error({ error, loopConfig }, 'Invalid loop configuration');
          }
        }
      }

      this.logger.info({ 
        servers: this.servers.size, 
        loops: this.loops.size 
      }, 'Configuration loaded from file');

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.logger.warn({ configFile: this.configFile }, 'Configuration file not found, starting with empty config');
        await this.createDefaultConfig();
      } else {
        this.logger.error({ error }, 'Failed to load configuration from file');
        throw error;
      }
    }
  }

  /**
   * Load configuration from database
   */
  private async loadFromDatabase(): Promise<void> {
    // TODO: Implement database configuration loading
    // This would connect to PostgreSQL/MongoDB and load server/loop configurations
    this.logger.warn('Database configuration loading not yet implemented');
  }

  /**
   * Create default configuration file
   */
  private async createDefaultConfig(): Promise<void> {
    const defaultConfig = {
      version: '1.0',
      servers: [
        {
          id: 'demo-server',
          name: 'Demo OPC UA Server',
          endpointUrl: 'opc.tcp://localhost:4840',
          securityPolicy: 'None',
          securityMode: 'None',
          userAuthMethod: 'anonymous',
          trustUnknownCerts: true,
          samplingInterval: 200,
          maxSessionSubscriptions: 1000,
          redundantEndpoints: [],
          enabled: true
        }
      ],
      loops: []
    };

    try {
      const configDir = this.configFile.split('/').slice(0, -1).join('/');
      // Ensure config directory exists (in production, this would be handled by Dockerfile)
      
      await writeFile(this.configFile, YAML.stringify(defaultConfig), 'utf-8');
      this.logger.info({ configFile: this.configFile }, 'Created default configuration file');
    } catch (error) {
      this.logger.error({ error }, 'Failed to create default configuration file');
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfiguration(): Promise<void> {
    const config = {
      version: '1.0',
      servers: Array.from(this.servers.values()),
      loops: Array.from(this.loops.values())
    };

    try {
      await writeFile(this.configFile, YAML.stringify(config), 'utf-8');
      this.logger.info('Configuration saved to file');
      this.emit('configurationSaved');
    } catch (error) {
      this.logger.error({ error }, 'Failed to save configuration');
      throw error;
    }
  }

  /**
   * Start configuration file watcher
   */
  private startConfigWatcher(): void {
    if (process.env.CONFIG_SOURCE === 'file') {
      this.watchInterval = setInterval(async () => {
        try {
          const stats = await import('fs').then(fs => fs.promises.stat(this.configFile));
          // Simple modification time check - in production you might want something more sophisticated
          // For now, we'll reload on external changes
        } catch (error) {
          // File might not exist, ignore
        }
      }, 30000); // Check every 30 seconds
    }
  }

  /**
   * Stop configuration watcher
   */
  stop(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = undefined;
    }
  }

  // Server Configuration Methods

  /**
   * Get all server configurations
   */
  getServers(): ServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server configuration by ID
   */
  getServer(serverId: string): ServerConfig | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Add or update server configuration
   */
  async setServer(serverConfig: ServerConfig): Promise<void> {
    try {
      const validatedConfig = validateServerConfig(serverConfig);
      const isNew = !this.servers.has(validatedConfig.id);
      
      this.servers.set(validatedConfig.id, validatedConfig);
      
      await this.saveConfiguration();
      
      this.emit('serverConfigChanged', {
        action: isNew ? 'added' : 'updated',
        serverId: validatedConfig.id,
        config: validatedConfig
      });

      this.logger.info({ 
        serverId: validatedConfig.id, 
        action: isNew ? 'added' : 'updated' 
      }, 'Server configuration changed');

    } catch (error) {
      this.logger.error({ error, serverConfig }, 'Failed to set server configuration');
      throw error;
    }
  }

  /**
   * Remove server configuration
   */
  async removeServer(serverId: string): Promise<boolean> {
    if (!this.servers.has(serverId)) {
      return false;
    }

    this.servers.delete(serverId);
    
    // Remove any loop subscriptions for this server
    const loopsToRemove = Array.from(this.loops.values())
      .filter(loop => loop.serverId === serverId)
      .map(loop => loop.loopId);
    
    for (const loopId of loopsToRemove) {
      this.loops.delete(loopId);
    }

    await this.saveConfiguration();
    
    this.emit('serverConfigChanged', {
      action: 'removed',
      serverId,
      removedLoops: loopsToRemove
    });

    this.logger.info({ serverId, removedLoops: loopsToRemove.length }, 'Server configuration removed');
    return true;
  }

  // Loop Subscription Methods

  /**
   * Get all loop subscriptions
   */
  getLoops(): LoopSubscription[] {
    return Array.from(this.loops.values());
  }

  /**
   * Get loop subscriptions for a specific server
   */
  getLoopsForServer(serverId: string): LoopSubscription[] {
    return Array.from(this.loops.values()).filter(loop => loop.serverId === serverId);
  }

  /**
   * Get loop subscription by ID
   */
  getLoop(loopId: string): LoopSubscription | undefined {
    return this.loops.get(loopId);
  }

  /**
   * Add or update loop subscription
   */
  async setLoop(loopSubscription: LoopSubscription): Promise<void> {
    try {
      const validatedLoop = validateLoopSubscription(loopSubscription);
      
      // Verify server exists
      if (!this.servers.has(validatedLoop.serverId)) {
        throw new Error(`Server '${validatedLoop.serverId}' not found`);
      }

      const isNew = !this.loops.has(validatedLoop.loopId);
      validatedLoop.updatedAt = new Date();
      
      if (isNew) {
        validatedLoop.createdAt = new Date();
      }
      
      this.loops.set(validatedLoop.loopId, validatedLoop);
      
      await this.saveConfiguration();
      
      this.emit('loopConfigChanged', {
        action: isNew ? 'added' : 'updated',
        loopId: validatedLoop.loopId,
        serverId: validatedLoop.serverId,
        config: validatedLoop
      });

      this.logger.info({ 
        loopId: validatedLoop.loopId, 
        serverId: validatedLoop.serverId,
        action: isNew ? 'added' : 'updated' 
      }, 'Loop subscription changed');

    } catch (error) {
      this.logger.error({ error, loopSubscription }, 'Failed to set loop subscription');
      throw error;
    }
  }

  /**
   * Remove loop subscription
   */
  async removeLoop(loopId: string): Promise<boolean> {
    const loop = this.loops.get(loopId);
    if (!loop) {
      return false;
    }

    this.loops.delete(loopId);
    await this.saveConfiguration();
    
    this.emit('loopConfigChanged', {
      action: 'removed',
      loopId,
      serverId: loop.serverId
    });

    this.logger.info({ loopId, serverId: loop.serverId }, 'Loop subscription removed');
    return true;
  }

  /**
   * Get client configuration
   */
  getClientConfig(): ClientConfig {
    return this.clientConfig;
  }

  /**
   * Validate configuration consistency
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for server ID uniqueness
    const serverIds = new Set<string>();
    for (const server of this.servers.values()) {
      if (serverIds.has(server.id)) {
        errors.push(`Duplicate server ID: ${server.id}`);
      }
      serverIds.add(server.id);
    }

    // Check that all loop subscriptions reference valid servers
    for (const loop of this.loops.values()) {
      if (!this.servers.has(loop.serverId)) {
        errors.push(`Loop '${loop.loopId}' references non-existent server '${loop.serverId}'`);
      }
    }

    // Check for loop ID uniqueness
    const loopIds = new Set<string>();
    for (const loop of this.loops.values()) {
      if (loopIds.has(loop.loopId)) {
        errors.push(`Duplicate loop ID: ${loop.loopId}`);
      }
      loopIds.add(loop.loopId);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration statistics
   */
  getStatistics(): {
    servers: { total: number; enabled: number; disabled: number };
    loops: { total: number; enabled: number; disabled: number };
    tags: { total: number; byType: Record<string, number> };
  } {
    const servers = Array.from(this.servers.values());
    const loops = Array.from(this.loops.values());

    const tagCounts = { total: 0, byType: { pv: 0, op: 0, sp: 0, mode: 0, valve: 0 } };
    
    for (const loop of loops) {
      if (loop.enabled) {
        Object.keys(loop.tags).forEach(tagType => {
          if (loop.tags[tagType as keyof typeof loop.tags]) {
            tagCounts.total++;
            tagCounts.byType[tagType as keyof typeof tagCounts.byType]++;
          }
        });
      }
    }

    return {
      servers: {
        total: servers.length,
        enabled: servers.filter(s => s.enabled).length,
        disabled: servers.filter(s => !s.enabled).length
      },
      loops: {
        total: loops.length,
        enabled: loops.filter(l => l.enabled).length,
        disabled: loops.filter(l => !l.enabled).length
      },
      tags: tagCounts
    };
  }
}