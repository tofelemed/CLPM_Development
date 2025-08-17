import express from "express";
import cors from "cors";
import { MessageSecurityMode, SecurityPolicy } from "node-opcua";
import OPCUAClientManager from "./opcua-client.js";
import pino from "pino";

const log = pino({ name: "opcua-api" });
const app = express();
const port = process.env.OPCUA_API_PORT || 3001;

// Initialize OPC UA client manager
const opcuaManager = new OPCUAClientManager();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Get all OPC UA connections
app.get("/connections", (req, res) => {
  try {
    const connections = opcuaManager.getAllConnections();
    res.json({ connections });
  } catch (error) {
    log.error({ error: error.message }, "Failed to get connections");
    res.status(500).json({ error: "Failed to get connections" });
  }
});

// Get specific connection status
app.get("/connections/:connectionId", (req, res) => {
  try {
    const { connectionId } = req.params;
    const status = opcuaManager.getConnectionStatus(connectionId);
    
    if (status === 'not_found') {
      return res.status(404).json({ error: "Connection not found" });
    }
    
    res.json({ connection: status });
  } catch (error) {
    log.error({ error: error.message }, "Failed to get connection status");
    res.status(500).json({ error: "Failed to get connection status" });
  }
});

// Create new OPC UA connection
app.post("/connections", async (req, res) => {
  try {
    const { endpointUrl, username, password, securityMode, securityPolicy } = req.body;

    if (!endpointUrl) {
      return res.status(400).json({ error: "endpointUrl is required" });
    }

    const options = {
      username,
      password,
      securityMode: securityMode ? MessageSecurityMode[securityMode] : MessageSecurityMode.SignAndEncrypt,
      securityPolicy: securityPolicy ? SecurityPolicy[securityPolicy] : SecurityPolicy.Basic256Sha256
    };

    const connection = await opcuaManager.createConnection(endpointUrl, options);
    
    res.status(201).json({
      connection: opcuaManager.getConnectionStatus(connection.id),
      message: "Connection created successfully"
    });
  } catch (error) {
    log.error({ error: error.message }, "Failed to create connection");
    res.status(500).json({ error: `Failed to create connection: ${error.message}` });
  }
});

// Disconnect OPC UA connection
app.delete("/connections/:connectionId", async (req, res) => {
  try {
    const { connectionId } = req.params;
    await opcuaManager.disconnect(connectionId);
    
    res.json({ message: "Connection disconnected successfully" });
  } catch (error) {
    log.error({ error: error.message }, "Failed to disconnect connection");
    res.status(500).json({ error: "Failed to disconnect connection" });
  }
});

// Browse OPC UA address space
app.get("/connections/:connectionId/browse", async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { nodeId = "RootFolder", maxResults = 1000 } = req.query;

    const results = await opcuaManager.browseAddressSpace(connectionId, nodeId, parseInt(maxResults));
    
    res.json({ 
      connectionId,
      nodeId,
      results,
      count: results.length
    });
  } catch (error) {
    log.error({ error: error.message }, "Failed to browse address space");
    res.status(500).json({ error: `Failed to browse address space: ${error.message}` });
  }
});

// Search OPC UA nodes
app.get("/connections/:connectionId/search", async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { q: searchTerm, maxResults = 100 } = req.query;

    if (!searchTerm) {
      return res.status(400).json({ error: "Search term 'q' is required" });
    }

    const results = await opcuaManager.searchNodes(connectionId, searchTerm, parseInt(maxResults));
    
    res.json({ 
      connectionId,
      searchTerm,
      results,
      count: results.length
    });
  } catch (error) {
    log.error({ error: error.message }, "Failed to search nodes");
    res.status(500).json({ error: `Failed to search nodes: ${error.message}` });
  }
});

// Read node value
app.get("/connections/:connectionId/nodes/:nodeId/read", async (req, res) => {
  try {
    const { connectionId, nodeId } = req.params;

    const value = await opcuaManager.readNodeValue(connectionId, nodeId);
    
    res.json({ 
      connectionId,
      nodeId,
      value
    });
  } catch (error) {
    log.error({ error: error.message }, "Failed to read node value");
    res.status(500).json({ error: `Failed to read node value: ${error.message}` });
  }
});

// Add monitored item
app.post("/connections/:connectionId/monitor", async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { nodeId, samplingInterval, queueSize } = req.body;

    if (!nodeId) {
      return res.status(400).json({ error: "nodeId is required" });
    }

    const options = {
      samplingInterval: samplingInterval ? parseInt(samplingInterval) : undefined,
      queueSize: queueSize ? parseInt(queueSize) : undefined
    };

    const itemId = await opcuaManager.addMonitoredItem(connectionId, nodeId, options);
    
    res.status(201).json({
      connectionId,
      nodeId,
      itemId,
      message: "Monitored item added successfully"
    });
  } catch (error) {
    log.error({ error: error.message }, "Failed to add monitored item");
    res.status(500).json({ error: `Failed to add monitored item: ${error.message}` });
  }
});

// Remove monitored item
app.delete("/connections/:connectionId/monitor/:nodeId", async (req, res) => {
  try {
    const { connectionId, nodeId } = req.params;
    await opcuaManager.removeMonitoredItem(connectionId, nodeId);
    
    res.json({ message: "Monitored item removed successfully" });
  } catch (error) {
    log.error({ error: error.message }, "Failed to remove monitored item");
    res.status(500).json({ error: "Failed to remove monitored item" });
  }
});

// Get available security policies and modes
app.get("/security-options", (req, res) => {
  const securityPolicies = Object.keys(SecurityPolicy).map(key => ({
    name: key,
    value: SecurityPolicy[key]
  }));

  const securityModes = Object.keys(MessageSecurityMode).map(key => ({
    name: key,
    value: MessageSecurityMode[key]
  }));

  res.json({
    securityPolicies,
    securityModes
  });
});

// Loop configuration endpoints
app.post("/loops", async (req, res) => {
  try {
    const { 
      name, 
      description, 
      connectionId, 
      pvTag, 
      opTag, 
      spTag, 
      modeTag, 
      valveTag, 
      samplingInterval 
    } = req.body;

    // Validate required fields
    if (!name || !connectionId || !pvTag || !opTag || !spTag) {
      return res.status(400).json({ 
        error: "name, connectionId, pvTag, opTag, and spTag are required" 
      });
    }

    // Validate connection exists
    const connectionStatus = opcuaManager.getConnectionStatus(connectionId);
    if (connectionStatus === 'not_found') {
      return res.status(400).json({ error: "OPC UA connection not found" });
    }

    // Create loop configuration
    const loopConfig = {
      id: `loop-${Date.now()}`,
      name,
      description,
      connectionId,
      pvTag,
      opTag,
      spTag,
      modeTag,
      valveTag,
      samplingInterval: samplingInterval || 200,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    // Add monitored items for the loop
    const monitoredItems = [];
    
    // Monitor PV tag
    try {
      const pvItemId = await opcuaManager.addMonitoredItem(connectionId, pvTag, { samplingInterval });
      monitoredItems.push({ tag: 'pv', nodeId: pvTag, itemId: pvItemId });
    } catch (error) {
      log.warn({ nodeId: pvTag, error: error.message }, "Failed to monitor PV tag");
    }

    // Monitor OP tag
    try {
      const opItemId = await opcuaManager.addMonitoredItem(connectionId, opTag, { samplingInterval });
      monitoredItems.push({ tag: 'op', nodeId: opTag, itemId: opItemId });
    } catch (error) {
      log.warn({ nodeId: opTag, error: error.message }, "Failed to monitor OP tag");
    }

    // Monitor SP tag
    try {
      const spItemId = await opcuaManager.addMonitoredItem(connectionId, spTag, { samplingInterval });
      monitoredItems.push({ tag: 'sp', nodeId: spTag, itemId: spItemId });
    } catch (error) {
      log.warn({ nodeId: spTag, error: error.message }, "Failed to monitor SP tag");
    }

    // Monitor mode tag if provided
    if (modeTag) {
      try {
        const modeItemId = await opcuaManager.addMonitoredItem(connectionId, modeTag, { samplingInterval });
        monitoredItems.push({ tag: 'mode', nodeId: modeTag, itemId: modeItemId });
      } catch (error) {
        log.warn({ nodeId: modeTag, error: error.message }, "Failed to monitor mode tag");
      }
    }

    // Monitor valve tag if provided
    if (valveTag) {
      try {
        const valveItemId = await opcuaManager.addMonitoredItem(connectionId, valveTag, { samplingInterval });
        monitoredItems.push({ tag: 'valve', nodeId: valveTag, itemId: valveItemId });
      } catch (error) {
        log.warn({ nodeId: valveTag, error: error.message }, "Failed to monitor valve tag");
      }
    }

    loopConfig.monitoredItems = monitoredItems;

    // TODO: Save loop configuration to database
    // For now, just return the configuration
    res.status(201).json({
      loop: loopConfig,
      message: "Loop created successfully"
    });

  } catch (error) {
    log.error({ error: error.message }, "Failed to create loop");
    res.status(500).json({ error: `Failed to create loop: ${error.message}` });
  }
});

// Get loop configuration
app.get("/loops/:loopId", (req, res) => {
  try {
    const { loopId } = req.params;
    
    // TODO: Retrieve loop configuration from database
    // For now, return a mock response
    res.json({
      loop: {
        id: loopId,
        name: "Mock Loop",
        description: "Mock loop configuration",
        connectionId: "mock-connection",
        pvTag: "ns=2;s=Mock.PV",
        opTag: "ns=2;s=Mock.OP",
        spTag: "ns=2;s=Mock.SP",
        samplingInterval: 200,
        status: 'active'
      }
    });
  } catch (error) {
    log.error({ error: error.message }, "Failed to get loop");
    res.status(500).json({ error: "Failed to get loop" });
  }
});

// Update loop configuration
app.put("/loops/:loopId", async (req, res) => {
  try {
    const { loopId } = req.params;
    const { 
      name, 
      description, 
      pvTag, 
      opTag, 
      spTag, 
      modeTag, 
      valveTag, 
      samplingInterval 
    } = req.body;

    // TODO: Update loop configuration in database
    // For now, just return success
    res.json({
      message: "Loop updated successfully",
      loopId
    });
  } catch (error) {
    log.error({ error: error.message }, "Failed to update loop");
    res.status(500).json({ error: "Failed to update loop" });
  }
});

// Delete loop configuration
app.delete("/loops/:loopId", async (req, res) => {
  try {
    const { loopId } = req.params;
    
    // TODO: Remove monitored items and delete loop from database
    // For now, just return success
    res.json({
      message: "Loop deleted successfully",
      loopId
    });
  } catch (error) {
    log.error({ error: error.message }, "Failed to delete loop");
    res.status(500).json({ error: "Failed to delete loop" });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  log.error({ error: error.message, stack: error.stack }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info("Shutting down OPC UA API server");
  await opcuaManager.disconnectAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info("Shutting down OPC UA API server");
  await opcuaManager.disconnectAll();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  log.info({ port }, "OPC UA API server started");
});

export default app;
