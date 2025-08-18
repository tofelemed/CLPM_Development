import { EventEmitter } from 'events';
import { Logger } from 'pino';
import { ServerConfig, ConnectionStatus } from '../types/index.js';

interface RedundancyGroup {
  id: string;
  primaryServerId: string;
  redundantServerIds: string[];
  activeServerId: string;
  failoverPolicy: 'automatic' | 'manual';
  failoverDelayMs: number;
  healthCheckIntervalMs: number;
  requiredQuality: 'any' | 'good' | 'excellent';
}

interface FailoverEvent {
  groupId: string;
  fromServerId: string;
  toServerId: string;
  reason: string;
  timestamp: Date;
  automatic: boolean;
}

interface ServerHealth {
  serverId: string;
  isHealthy: boolean;
  connectionQuality: 'bad' | 'uncertain' | 'good';
  lastDataReceived: Date | null;
  consecutiveFailures: number;
  lastFailure: Date | null;
  metrics: {
    uptime: number;
    reconnectAttempts: number;
    samplesReceived: number;
    errorRate: number;
  };
}

export class ResilienceManager extends EventEmitter {
  private logger: Logger;
  private redundancyGroups: Map<string, RedundancyGroup> = new Map();
  private serverHealth: Map<string, ServerHealth> = new Map();
  private failoverHistory: FailoverEvent[] = [];
  private healthCheckTimer?: NodeJS.Timeout;
  private connectionManager: any; // Will be injected
  private isActive = false;

  constructor(logger: Logger) {
    super();
    this.logger = logger.child({ component: 'ResilienceManager' });
  }

  /**
   * Initialize resilience manager
   */
  initialize(connectionManager: any): void {
    this.connectionManager = connectionManager;
    this.isActive = true;
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    this.logger.info('Resilience manager initialized');
  }

  /**
   * Create redundancy group
   */
  createRedundancyGroup(config: {
    id: string;
    primaryServerId: string;
    redundantServerIds: string[];
    failoverPolicy?: 'automatic' | 'manual';
    failoverDelayMs?: number;
    healthCheckIntervalMs?: number;
    requiredQuality?: 'any' | 'good' | 'excellent';
  }): void {
    const group: RedundancyGroup = {
      id: config.id,
      primaryServerId: config.primaryServerId,
      redundantServerIds: config.redundantServerIds || [],
      activeServerId: config.primaryServerId,
      failoverPolicy: config.failoverPolicy || 'automatic',
      failoverDelayMs: config.failoverDelayMs || 30000,
      healthCheckIntervalMs: config.healthCheckIntervalMs || 15000,
      requiredQuality: config.requiredQuality || 'good'
    };

    this.redundancyGroups.set(group.id, group);
    
    // Initialize health tracking for all servers in the group
    const allServers = [group.primaryServerId, ...group.redundantServerIds];
    for (const serverId of allServers) {
      if (!this.serverHealth.has(serverId)) {
        this.initializeServerHealth(serverId);
      }
    }

    this.logger.info({ 
      groupId: group.id,
      primary: group.primaryServerId,
      redundant: group.redundantServerIds,
      policy: group.failoverPolicy
    }, 'Redundancy group created');

    this.emit('redundancyGroupCreated', { group });
  }

  /**
   * Remove redundancy group
   */
  removeRedundancyGroup(groupId: string): boolean {
    const group = this.redundancyGroups.get(groupId);
    if (!group) {
      return false;
    }

    this.redundancyGroups.delete(groupId);
    
    this.logger.info({ groupId }, 'Redundancy group removed');
    this.emit('redundancyGroupRemoved', { groupId });
    
    return true;
  }

  /**
   * Initialize server health tracking
   */
  private initializeServerHealth(serverId: string): void {
    this.serverHealth.set(serverId, {
      serverId,
      isHealthy: false,
      connectionQuality: 'bad',
      lastDataReceived: null,
      consecutiveFailures: 0,
      lastFailure: null,
      metrics: {
        uptime: 0,
        reconnectAttempts: 0,
        samplesReceived: 0,
        errorRate: 0
      }
    });
  }

  /**
   * Update server health from connection status
   */
  updateServerHealth(status: ConnectionStatus): void {
    let health = this.serverHealth.get(status.serverId);
    if (!health) {
      this.initializeServerHealth(status.serverId);
      health = this.serverHealth.get(status.serverId)!;
    }

    const wasHealthy = health.isHealthy;
    
    // Update health based on connection status
    health.connectionQuality = status.connectionQuality;
    health.isHealthy = status.status === 'connected' && status.connectionQuality !== 'bad';
    
    // Update metrics
    health.metrics.reconnectAttempts = status.reconnectAttempts;
    
    // Track failures
    if (!health.isHealthy) {
      if (wasHealthy) {
        health.consecutiveFailures = 1;
        health.lastFailure = new Date();
      } else {
        health.consecutiveFailures++;
      }
    } else {
      health.consecutiveFailures = 0;
    }

    this.serverHealth.set(status.serverId, health);
    
    // Check if failover is needed
    if (wasHealthy && !health.isHealthy) {
      this.checkFailoverNeeded(status.serverId);
    }
    
    // Check if failed server has recovered
    if (!wasHealthy && health.isHealthy) {
      this.checkFailbackPossible(status.serverId);
    }
  }

  /**
   * Update server health from data activity
   */
  updateDataActivity(serverId: string, samplesReceived: number): void {
    const health = this.serverHealth.get(serverId);
    if (health) {
      health.lastDataReceived = new Date();
      health.metrics.samplesReceived += samplesReceived;
      this.serverHealth.set(serverId, health);
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Perform health checks on all servers
   */
  private performHealthChecks(): void {
    if (!this.isActive) {
      return;
    }

    const now = new Date();
    
    for (const [serverId, health] of this.serverHealth) {
      // Check data staleness
      const timeSinceData = health.lastDataReceived ? 
        now.getTime() - health.lastDataReceived.getTime() : Infinity;
      
      // Consider server unhealthy if no data for 2 minutes
      if (health.isHealthy && timeSinceData > 120000) {
        health.isHealthy = false;
        health.connectionQuality = 'uncertain';
        health.consecutiveFailures++;
        
        this.logger.warn({ 
          serverId, 
          timeSinceData: timeSinceData / 1000 
        }, 'Server marked unhealthy due to data staleness');
        
        this.checkFailoverNeeded(serverId);
      }
    }
  }

  /**
   * Check if failover is needed for a server
   */
  private checkFailoverNeeded(failedServerId: string): void {
    // Find redundancy groups containing this server
    for (const group of this.redundancyGroups.values()) {
      if (group.activeServerId === failedServerId && group.failoverPolicy === 'automatic') {
        this.scheduleFailover(group, failedServerId);
      }
    }
  }

  /**
   * Schedule failover for a redundancy group
   */
  private scheduleFailover(group: RedundancyGroup, failedServerId: string): void {
    const failover = () => {
      // Find the best redundant server
      const targetServer = this.findBestRedundantServer(group);
      
      if (targetServer) {
        this.performFailover(group.id, failedServerId, targetServer, 'automatic');
      } else {
        this.logger.error({ 
          groupId: group.id,
          failedServerId 
        }, 'No healthy redundant servers available for failover');
        
        this.emit('failoverFailed', {
          groupId: group.id,
          failedServerId,
          reason: 'No healthy redundant servers available'
        });
      }
    };

    // Delay failover to avoid flapping
    setTimeout(failover, group.failoverDelayMs);
    
    this.logger.info({ 
      groupId: group.id,
      failedServerId,
      delayMs: group.failoverDelayMs
    }, 'Failover scheduled');
  }

  /**
   * Find the best redundant server for failover
   */
  private findBestRedundantServer(group: RedundancyGroup): string | null {
    const candidates = group.redundantServerIds
      .map(serverId => ({
        serverId,
        health: this.serverHealth.get(serverId)
      }))
      .filter(candidate => candidate.health?.isHealthy)
      .sort((a, b) => {
        // Prefer servers with better quality
        const qualityOrder = { good: 3, uncertain: 2, bad: 1 };
        const aQuality = qualityOrder[a.health!.connectionQuality];
        const bQuality = qualityOrder[b.health!.connectionQuality];
        
        if (aQuality !== bQuality) {
          return bQuality - aQuality;
        }
        
        // Prefer servers with fewer failures
        return a.health!.consecutiveFailures - b.health!.consecutiveFailures;
      });

    return candidates.length > 0 ? candidates[0].serverId : null;
  }

  /**
   * Perform manual failover
   */
  async performManualFailover(groupId: string, targetServerId: string): Promise<boolean> {
    const group = this.redundancyGroups.get(groupId);
    if (!group) {
      throw new Error(`Redundancy group ${groupId} not found`);
    }

    const targetHealth = this.serverHealth.get(targetServerId);
    if (!targetHealth?.isHealthy) {
      throw new Error(`Target server ${targetServerId} is not healthy`);
    }

    return this.performFailover(groupId, group.activeServerId, targetServerId, 'manual');
  }

  /**
   * Perform failover
   */
  private async performFailover(
    groupId: string, 
    fromServerId: string, 
    toServerId: string, 
    type: 'automatic' | 'manual'
  ): Promise<boolean> {
    const group = this.redundancyGroups.get(groupId);
    if (!group) {
      return false;
    }

    try {
      this.logger.info({ 
        groupId,
        fromServerId,
        toServerId,
        type
      }, 'Starting failover');

      // Update active server in group
      group.activeServerId = toServerId;
      this.redundancyGroups.set(groupId, group);

      // Record failover event
      const failoverEvent: FailoverEvent = {
        groupId,
        fromServerId,
        toServerId,
        reason: type === 'automatic' ? 'Server health degraded' : 'Manual failover',
        timestamp: new Date(),
        automatic: type === 'automatic'
      };

      this.failoverHistory.push(failoverEvent);
      
      // Keep only last 100 failover events
      if (this.failoverHistory.length > 100) {
        this.failoverHistory.splice(0, this.failoverHistory.length - 100);
      }

      this.logger.info({ 
        groupId,
        fromServerId,
        toServerId
      }, 'Failover completed successfully');

      this.emit('failoverCompleted', failoverEvent);
      return true;

    } catch (error) {
      this.logger.error({ 
        error,
        groupId,
        fromServerId,
        toServerId
      }, 'Failover failed');

      this.emit('failoverFailed', {
        groupId,
        fromServerId,
        toServerId,
        error: error.message
      });

      return false;
    }
  }

  /**
   * Check if failback to primary is possible
   */
  private checkFailbackPossible(recoveredServerId: string): void {
    for (const group of this.redundancyGroups.values()) {
      // Check if this is the primary server and it's not currently active
      if (group.primaryServerId === recoveredServerId && 
          group.activeServerId !== recoveredServerId) {
        
        const primaryHealth = this.serverHealth.get(recoveredServerId);
        
        // Failback if primary is healthy and has good quality
        if (primaryHealth?.isHealthy && primaryHealth.connectionQuality === 'good') {
          this.logger.info({ 
            groupId: group.id,
            recoveredServerId
          }, 'Primary server recovered, considering failback');
          
          // Wait a bit to ensure stability before failback
          setTimeout(() => {
            this.performFailover(group.id, group.activeServerId, recoveredServerId, 'automatic');
          }, 60000); // Wait 1 minute
        }
      }
    }
  }

  /**
   * Get redundancy groups
   */
  getRedundancyGroups(): RedundancyGroup[] {
    return Array.from(this.redundancyGroups.values());
  }

  /**
   * Get server health status
   */
  getServerHealth(): ServerHealth[] {
    return Array.from(this.serverHealth.values());
  }

  /**
   * Get failover history
   */
  getFailoverHistory(limit: number = 50): FailoverEvent[] {
    return this.failoverHistory.slice(-limit);
  }

  /**
   * Get active server for a redundancy group
   */
  getActiveServer(groupId: string): string | null {
    const group = this.redundancyGroups.get(groupId);
    return group?.activeServerId || null;
  }

  /**
   * Check if server is active in any group
   */
  isServerActive(serverId: string): boolean {
    for (const group of this.redundancyGroups.values()) {
      if (group.activeServerId === serverId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get resilience statistics
   */
  getStatistics(): {
    totalGroups: number;
    totalServers: number;
    healthyServers: number;
    failoverEvents: number;
    averageFailoverTime: number;
  } {
    const totalGroups = this.redundancyGroups.size;
    const totalServers = this.serverHealth.size;
    const healthyServers = Array.from(this.serverHealth.values())
      .filter(h => h.isHealthy).length;
    
    const recentFailovers = this.failoverHistory.filter(
      f => Date.now() - f.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    // Calculate average failover time (simplified)
    const averageFailoverTime = recentFailovers.length > 0 ? 5000 : 0; // Placeholder

    return {
      totalGroups,
      totalServers,
      healthyServers,
      failoverEvents: recentFailovers.length,
      averageFailoverTime
    };
  }

  /**
   * Enable/disable automatic failover for a group
   */
  setFailoverPolicy(groupId: string, policy: 'automatic' | 'manual'): boolean {
    const group = this.redundancyGroups.get(groupId);
    if (!group) {
      return false;
    }

    group.failoverPolicy = policy;
    this.redundancyGroups.set(groupId, group);

    this.logger.info({ groupId, policy }, 'Failover policy updated');
    return true;
  }

  /**
   * Test failover (for testing purposes)
   */
  async testFailover(groupId: string): Promise<boolean> {
    const group = this.redundancyGroups.get(groupId);
    if (!group) {
      return false;
    }

    const targetServer = this.findBestRedundantServer(group);
    if (!targetServer) {
      return false;
    }

    return this.performFailover(groupId, group.activeServerId, targetServer, 'manual');
  }

  /**
   * Shutdown resilience manager
   */
  shutdown(): void {
    this.isActive = false;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.logger.info('Resilience manager shutdown complete');
  }
}