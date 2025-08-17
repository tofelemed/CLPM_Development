import { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds, NodeClass, DataType } from "node-opcua";
import pino from "pino";
import fs from "fs";
import path from "path";

const log = pino({ name: "opcua-client" });

class OPCUAClientManager {
  constructor() {
    this.connections = new Map();
    this.subscriptions = new Map();
    this.reconnectAttempts = new Map();
    this.maxRetryAttempts = parseInt(process.env.OPCUA_MAX_RETRY) || 10;
    this.reconnectDelay = 5000; // Start with 5 seconds
    this.maxReconnectDelay = 300000; // Max 5 minutes
  }

  async createConnection(endpointUrl, options = {}) {
    const connectionId = this.generateConnectionId(endpointUrl);
    
    if (this.connections.has(connectionId)) {
      log.warn({ connectionId, endpointUrl }, "Connection already exists");
      return this.connections.get(connectionId);
    }

    const client = OPCUAClient.create({
      endpoint_must_exist: false,
      securityMode: options.securityMode || MessageSecurityMode.SignAndEncrypt,
      securityPolicy: options.securityPolicy || SecurityPolicy.Basic256Sha256,
      defaultSecureTokenLifetime: 60000,
      connectionStrategy: {
        initialDelay: 2000,
        maxRetry: this.maxRetryAttempts,
        maxDelay: 10 * 60 * 1000,
        randomisationFactor: 0.5
      }
    });

    // Set up event handlers
    client.on("connection_lost", () => {
      log.warn({ connectionId, endpointUrl }, "OPC UA connection lost");
      this.handleConnectionLost(connectionId, endpointUrl);
    });

    client.on("connection_reestablished", () => {
      log.info({ connectionId, endpointUrl }, "OPC UA connection reestablished");
      this.handleConnectionReestablished(connectionId);
    });

    client.on("backoff", (retry, delay) => {
      log.info({ connectionId, retry, delay }, "OPC UA connection backoff");
    });

    const connection = {
      id: connectionId,
      client,
      endpointUrl,
      session: null,
      subscription: null,
      monitoredItems: new Map(),
      status: 'disconnected',
      options
    };

    this.connections.set(connectionId, connection);
    this.reconnectAttempts.set(connectionId, 0);

    try {
      await this.connect(connection);
      return connection;
    } catch (error) {
      log.error({ connectionId, endpointUrl, error: error.message }, "Failed to create connection");
      throw error;
    }
  }

  async connect(connection) {
    try {
      log.info({ connectionId: connection.id, endpointUrl: connection.endpointUrl }, "Connecting to OPC UA server");
      
      await connection.client.connect(connection.endpointUrl);
      connection.status = 'connected';

      // Create session
      const session = await connection.client.createSession({
        userName: connection.options.username,
        password: connection.options.password,
        requestedSessionTimeout: 60000
      });

      connection.session = session;
      log.info({ connectionId: connection.id }, "OPC UA session created");

      // Create subscription
      const subscription = await session.createSubscription2({
        requestedPublishingInterval: parseInt(process.env.OPCUA_PUBLISHING_INTERVAL) || 1000,
        requestedLifetimeCount: 1000,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 1000,
        publishingEnabled: true,
        priority: 10
      });

      connection.subscription = subscription;
      log.info({ connectionId: connection.id }, "OPC UA subscription created");

      // Set up subscription event handlers
      subscription.on("keepalive", () => {
        log.debug({ connectionId: connection.id }, "Subscription keepalive");
      });

      subscription.on("terminated", () => {
        log.warn({ connectionId: connection.id }, "Subscription terminated");
      });

      return connection;
    } catch (error) {
      connection.status = 'error';
      log.error({ connectionId: connection.id, error: error.message }, "Connection failed");
      throw error;
    }
  }

  async browseAddressSpace(connectionId, nodeId = "RootFolder", maxResults = 1000) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.session) {
      throw new Error("Connection not available");
    }

    try {
      const browseResult = await connection.session.browse({
        nodeId: nodeId,
        browseDirection: 0, // Forward
        includeSubtypes: true,
        nodeClassMask: NodeClass.Object | NodeClass.Variable | NodeClass.Method,
        resultMask: 63 // All attributes
      });

      const results = [];
      for (const reference of browseResult.references || []) {
        if (results.length >= maxResults) break;

        try {
          // Read node attributes
          const dataValue = await connection.session.read({
            nodeId: reference.nodeId,
            attributeId: AttributeIds.DisplayName
          });

          results.push({
            nodeId: reference.nodeId.toString(),
            browseName: reference.browseName.toString(),
            displayName: dataValue.value.value.toString(),
            nodeClass: reference.nodeClass,
            hasChildren: reference.hasForwardReferences
          });
        } catch (readError) {
          log.warn({ nodeId: reference.nodeId.toString(), error: readError.message }, "Failed to read node attributes");
        }
      }

      return results;
    } catch (error) {
      log.error({ connectionId, nodeId, error: error.message }, "Browse failed");
      throw error;
    }
  }

  async searchNodes(connectionId, searchTerm, maxResults = 100) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.session) {
      throw new Error("Connection not available");
    }

    try {
      // Start from root and recursively search
      const results = [];
      await this.searchNodesRecursive(connection, "RootFolder", searchTerm.toLowerCase(), results, maxResults);
      return results;
    } catch (error) {
      log.error({ connectionId, searchTerm, error: error.message }, "Node search failed");
      throw error;
    }
  }

  async searchNodesRecursive(connection, nodeId, searchTerm, results, maxResults) {
    if (results.length >= maxResults) return;

    try {
      const browseResult = await connection.session.browse({
        nodeId: nodeId,
        browseDirection: 0,
        includeSubtypes: true,
        nodeClassMask: NodeClass.Object | NodeClass.Variable | NodeClass.Method,
        resultMask: 63
      });

      for (const reference of browseResult.references || []) {
        if (results.length >= maxResults) break;

        try {
          const dataValue = await connection.session.read({
            nodeId: reference.nodeId,
            attributeId: AttributeIds.DisplayName
          });

          const displayName = dataValue.value.value.toString();
          
          // Check if this node matches the search term
          if (displayName.toLowerCase().includes(searchTerm) || 
              reference.browseName.toString().toLowerCase().includes(searchTerm)) {
            
            results.push({
              nodeId: reference.nodeId.toString(),
              browseName: reference.browseName.toString(),
              displayName: displayName,
              nodeClass: reference.nodeClass,
              hasChildren: reference.hasForwardReferences
            });
          }

          // Recursively search children if this node has children
          if (reference.hasForwardReferences && results.length < maxResults) {
            await this.searchNodesRecursive(connection, reference.nodeId, searchTerm, results, maxResults);
          }
        } catch (readError) {
          // Continue searching even if one node fails
          continue;
        }
      }
    } catch (error) {
      log.warn({ nodeId, error: error.message }, "Browse failed during search");
    }
  }

  async readNodeValue(connectionId, nodeId) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.session) {
      throw new Error("Connection not available");
    }

    try {
      const dataValue = await connection.session.read({
        nodeId: nodeId,
        attributeId: AttributeIds.Value
      });

      return {
        value: dataValue.value.value,
        dataType: dataValue.value.dataType,
        sourceTimestamp: dataValue.sourceTimestamp,
        serverTimestamp: dataValue.serverTimestamp,
        statusCode: dataValue.statusCode
      };
    } catch (error) {
      log.error({ connectionId, nodeId, error: error.message }, "Read node value failed");
      throw error;
    }
  }

  async addMonitoredItem(connectionId, nodeId, options = {}) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.subscription) {
      throw new Error("Connection or subscription not available");
    }

    const samplingInterval = options.samplingInterval || parseInt(process.env.OPCUA_SAMPLING_INTERVAL) || 200;
    const queueSize = options.queueSize || 100;

    try {
      const monitoredItem = await connection.subscription.monitor(
        {
          nodeId: nodeId,
          attributeId: AttributeIds.Value
        },
        {
          samplingInterval: samplingInterval,
          discardOldest: true,
          queueSize: queueSize
        }
      );

      const itemId = `${connectionId}:${nodeId}`;
      connection.monitoredItems.set(itemId, {
        nodeId,
        monitoredItem,
        options,
        lastValue: null,
        lastUpdate: null
      });

      // Set up monitoring callback
      monitoredItem.on("changed", (dataValue) => {
        this.handleDataChange(connectionId, nodeId, dataValue);
      });

      log.info({ connectionId, nodeId, samplingInterval }, "Monitored item added");
      return itemId;
    } catch (error) {
      log.error({ connectionId, nodeId, error: error.message }, "Failed to add monitored item");
      throw error;
    }
  }

  async removeMonitoredItem(connectionId, nodeId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error("Connection not available");
    }

    const itemId = `${connectionId}:${nodeId}`;
    const monitoredItem = connection.monitoredItems.get(itemId);

    if (monitoredItem) {
      try {
        await connection.subscription.terminate();
        connection.monitoredItems.delete(itemId);
        log.info({ connectionId, nodeId }, "Monitored item removed");
      } catch (error) {
        log.error({ connectionId, nodeId, error: error.message }, "Failed to remove monitored item");
        throw error;
      }
    }
  }

  handleDataChange(connectionId, nodeId, dataValue) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const itemId = `${connectionId}:${nodeId}`;
    const monitoredItem = connection.monitoredItems.get(itemId);

    if (monitoredItem) {
      monitoredItem.lastValue = dataValue.value.value;
      monitoredItem.lastUpdate = new Date();

      // Emit data change event (could be sent to RabbitMQ or time-series DB)
      const dataPoint = {
        connectionId,
        nodeId,
        value: dataValue.value.value,
        dataType: dataValue.value.dataType,
        sourceTimestamp: dataValue.sourceTimestamp,
        serverTimestamp: dataValue.serverTimestamp,
        statusCode: dataValue.statusCode,
        quality: this.getQualityString(dataValue.statusCode)
      };

      log.debug({ connectionId, nodeId, value: dataPoint.value, quality: dataPoint.quality }, "Data change received");
      
      // Here you would publish to RabbitMQ or time-series database
      this.publishDataPoint(dataPoint);
    }
  }

  getQualityString(statusCode) {
    if (statusCode.isGood()) return "Good";
    if (statusCode.isUncertain()) return "Uncertain";
    if (statusCode.isBad()) return "Bad";
    return "Unknown";
  }

  publishDataPoint(dataPoint) {
    // TODO: Implement publishing to RabbitMQ or time-series database
    // For now, just log the data point
    log.info({ 
      connectionId: dataPoint.connectionId, 
      nodeId: dataPoint.nodeId, 
      value: dataPoint.value, 
      quality: dataPoint.quality 
    }, "Data point ready for publishing");
  }

  async disconnect(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      if (connection.subscription) {
        await connection.subscription.terminate();
      }
      if (connection.session) {
        await connection.session.close();
      }
      if (connection.client) {
        await connection.client.disconnect();
      }

      this.connections.delete(connectionId);
      this.reconnectAttempts.delete(connectionId);
      
      log.info({ connectionId }, "OPC UA connection disconnected");
    } catch (error) {
      log.error({ connectionId, error: error.message }, "Error during disconnect");
    }
  }

  async disconnectAll() {
    const connectionIds = Array.from(this.connections.keys());
    for (const connectionId of connectionIds) {
      await this.disconnect(connectionId);
    }
  }

  handleConnectionLost(connectionId, endpointUrl) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.status = 'disconnected';
    const attempts = this.reconnectAttempts.get(connectionId) || 0;

    if (attempts < this.maxRetryAttempts || this.maxRetryAttempts === 0) {
      const delay = Math.min(this.reconnectDelay * Math.pow(2, attempts), this.maxReconnectDelay);
      
      log.info({ connectionId, attempts, delay }, "Scheduling reconnection attempt");
      
      setTimeout(async () => {
        try {
          await this.connect(connection);
          this.reconnectAttempts.set(connectionId, 0);
        } catch (error) {
          this.reconnectAttempts.set(connectionId, attempts + 1);
          this.handleConnectionLost(connectionId, endpointUrl);
        }
      }, delay);
    } else {
      log.error({ connectionId, attempts }, "Max reconnection attempts reached");
    }
  }

  handleConnectionReestablished(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.status = 'connected';
    this.reconnectAttempts.set(connectionId, 0);

    // Recreate subscription and monitored items
    this.recreateSubscription(connectionId);
  }

  async recreateSubscription(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.session) return;

    try {
      // Recreate subscription
      const subscription = await connection.session.createSubscription2({
        requestedPublishingInterval: parseInt(process.env.OPCUA_PUBLISHING_INTERVAL) || 1000,
        requestedLifetimeCount: 1000,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 1000,
        publishingEnabled: true,
        priority: 10
      });

      connection.subscription = subscription;

      // Recreate monitored items
      const monitoredItems = Array.from(connection.monitoredItems.values());
      connection.monitoredItems.clear();

      for (const item of monitoredItems) {
        try {
          await this.addMonitoredItem(connectionId, item.nodeId, item.options);
        } catch (error) {
          log.error({ connectionId, nodeId: item.nodeId, error: error.message }, "Failed to recreate monitored item");
        }
      }

      log.info({ connectionId }, "Subscription and monitored items recreated");
    } catch (error) {
      log.error({ connectionId, error: error.message }, "Failed to recreate subscription");
    }
  }

  generateConnectionId(endpointUrl) {
    return Buffer.from(endpointUrl).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  }

  getConnectionStatus(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return 'not_found';

    return {
      id: connection.id,
      endpointUrl: connection.endpointUrl,
      status: connection.status,
      monitoredItemsCount: connection.monitoredItems.size,
      reconnectAttempts: this.reconnectAttempts.get(connectionId) || 0
    };
  }

  getAllConnections() {
    return Array.from(this.connections.keys()).map(id => this.getConnectionStatus(id));
  }
}

export default OPCUAClientManager;
