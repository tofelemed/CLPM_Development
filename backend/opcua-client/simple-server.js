import express from 'express';
import cors from 'cors';
import { readFile } from 'fs/promises';
import YAML from 'yaml';

const app = express();
const PORT = process.env.PORT || 3002;

// Global storage for servers and loops
let servers = new Map();
let loops = new Map();

app.use(cors({
  origin: ['http://localhost:5174', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID']
}));

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Load initial config
async function loadConfig() {
  try {
    const configPath = './config/servers.yaml';
    const configData = await readFile(configPath, 'utf8');
    const config = YAML.parse(configData);
    
    // Load servers
    if (config.servers) {
      config.servers.forEach(server => {
        // Initialize connection status
        server.connected = false;
        server.lastConnected = null;
        servers.set(server.id, server);
      });
      console.log(`Loaded ${config.servers.length} servers from config`);
    }
    
    // Load loops
    if (config.loops) {
      config.loops.forEach(loop => {
        loops.set(loop.loopId, loop);
      });
      console.log(`Loaded ${config.loops.length} loops from config`);
    }
  } catch (error) {
    console.warn('Could not load config file:', error.message);
  }
}

// Health endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CLPM OPC UA Client'
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connections: {
      total: servers.size,
      connected: 0,
      disconnected: servers.size,
      failed: 0
    }
  });
});

app.get('/api/v1/health/detailed', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    connections: {
      total: servers.size,
      connected: 0,
      disconnected: servers.size,
      failed: 0,
      errors: 0
    },
    subscriptions: {
      total: loops.size,
      active: 0,
      failed: 0
    },
    dataFlow: {
      samplesPerSecond: 0,
      batchesPerSecond: 0,
      lastSampleTime: null
    },
    memory: {
      used: process.memoryUsage().heapUsed,
      free: process.memoryUsage().heapTotal - process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
      percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
    },
    publisher: {
      status: 'healthy',
      connected: true,
      publishedSamples: 0,
      failedPublishes: 0,
      lastPublishTime: null
    }
  });
});

// Server endpoints
app.get('/api/v1/servers', (req, res) => {
  const serverList = Array.from(servers.values()).map(server => ({
    ...server,
    // Don't expose sensitive info
    password: undefined
  }));
  res.json(serverList);
});

app.get('/api/v1/servers/:serverId', (req, res) => {
  const server = servers.get(req.params.serverId);
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  res.json({ ...server, password: undefined });
});

app.post('/api/v1/servers', (req, res) => {
  try {
    const serverId = req.body.id || `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const serverConfig = {
      id: serverId,
      name: req.body.name || 'Unnamed Server',
      endpointUrl: req.body.endpointUrl,
      securityPolicy: req.body.securityPolicy || 'None',
      securityMode: req.body.securityMode || 'None', 
      userAuthMethod: req.body.userAuthMethod || 'anonymous',
      username: req.body.username,
      password: req.body.password,
      trustUnknownCerts: req.body.trustUnknownCerts !== false,
      samplingInterval: req.body.samplingInterval || 1000,
      maxSessionSubscriptions: req.body.maxSessionSubscriptions || 1000,
      enabled: req.body.enabled !== false,
      connected: false, // Initialize as disconnected
      lastConnected: null
    };
    
    servers.set(serverId, serverConfig);
    console.log(`Created server: ${serverId}`);
    res.status(201).json({ ...serverConfig, password: undefined });
  } catch (error) {
    console.error('Error creating server:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/v1/servers/:serverId', (req, res) => {
  try {
    const { serverId } = req.params;
    const existing = servers.get(serverId);
    if (!existing) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    const serverConfig = { ...existing, ...req.body, id: serverId };
    servers.set(serverId, serverConfig);
    console.log(`Updated server: ${serverId}`);
    res.json({ ...serverConfig, password: undefined });
  } catch (error) {
    console.error('Error updating server:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/v1/servers/:serverId', (req, res) => {
  const { serverId } = req.params;
  const deleted = servers.delete(serverId);
  if (!deleted) {
    return res.status(404).json({ error: 'Server not found' });
  }
  console.log(`Deleted server: ${serverId}`);
  res.status(204).send();
});

// Loop endpoints
app.get('/api/v1/loops', (req, res) => {
  const { serverId } = req.query;
  let loopList = Array.from(loops.values());
  
  if (serverId) {
    loopList = loopList.filter(loop => loop.serverId === serverId);
  }
  
  res.json(loopList);
});

app.get('/api/v1/loops/:loopId', (req, res) => {
  const loop = loops.get(req.params.loopId);
  if (!loop) {
    return res.status(404).json({ error: 'Loop not found' });
  }
  res.json(loop);
});

app.post('/api/v1/loops', (req, res) => {
  try {
    const loopId = req.body.loopId || `loop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const loopConfig = {
      loopId,
      serverId: req.body.serverId,
      enabled: req.body.enabled !== false,
      tags: req.body.tags || {}
    };
    
    loops.set(loopId, loopConfig);
    console.log(`Created loop: ${loopId}`);
    res.status(201).json(loopConfig);
  } catch (error) {
    console.error('Error creating loop:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/v1/loops/:loopId', (req, res) => {
  try {
    const { loopId } = req.params;
    const existing = loops.get(loopId);
    if (!existing) {
      return res.status(404).json({ error: 'Loop not found' });
    }
    
    const loopConfig = { ...existing, ...req.body, loopId };
    loops.set(loopId, loopConfig);
    console.log(`Updated loop: ${loopId}`);
    res.json(loopConfig);
  } catch (error) {
    console.error('Error updating loop:', error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/v1/loops/:loopId', (req, res) => {
  const { loopId } = req.params;
  const deleted = loops.delete(loopId);
  if (!deleted) {
    return res.status(404).json({ error: 'Loop not found' });
  }
  console.log(`Deleted loop: ${loopId}`);
  res.status(204).send();
});

// Browse endpoints (mock for now)
app.get('/api/v1/browse/:serverId', (req, res) => {
  const { serverId } = req.params;
  const { nodeId = 'RootFolder' } = req.query;
  
  console.log(`Browse request for server ${serverId}, node ${nodeId}`);
  
  // Mock browse results
  res.json([
    {
      nodeId: 'ns=2;s=Demo.Dynamic.Scalar.Int32',
      displayName: 'Int32 Value',
      nodeClass: 'Variable',
      dataType: 'Int32',
      browseName: 'Int32'
    },
    {
      nodeId: 'ns=2;s=Demo.Dynamic.Scalar.Double',
      displayName: 'Double Value', 
      nodeClass: 'Variable',
      dataType: 'Double',
      browseName: 'Double'
    },
    {
      nodeId: 'ns=2;s=Process.PV',
      displayName: 'Process Value',
      nodeClass: 'Variable',
      dataType: 'Double',
      browseName: 'PV'
    },
    {
      nodeId: 'ns=2;s=Process.SP',
      displayName: 'Set Point',
      nodeClass: 'Variable',
      dataType: 'Double',
      browseName: 'SP'
    },
    {
      nodeId: 'ns=2;s=Process.OP',
      displayName: 'Output',
      nodeClass: 'Variable',
      dataType: 'Double',
      browseName: 'OP'
    }
  ]);
});

// Node read endpoints (for browsing tags)
app.get('/api/v1/nodes/:serverId/read', (req, res) => {
  const { serverId } = req.params;
  const { nodeId } = req.query;
  
  console.log(`Read node request for server ${serverId}, nodeId: ${nodeId}`);
  
  // Mock read value
  const mockValue = {
    nodeId,
    value: Math.random() * 100,
    timestamp: new Date().toISOString(),
    statusCode: 'Good',
    dataType: 'Double'
  };
  
  res.json(mockValue);
});

app.post('/api/v1/nodes/:serverId/read', (req, res) => {
  const { serverId } = req.params;
  const { nodeIds } = req.body;
  
  console.log(`Read multiple nodes request for server ${serverId}, nodeIds: ${nodeIds}`);
  
  // Mock read values for multiple nodes
  const values = nodeIds.map(nodeId => ({
    nodeId,
    value: Math.random() * 100,
    timestamp: new Date().toISOString(),
    statusCode: 'Good',
    dataType: 'Double'
  }));
  
  res.json(values);
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    connections: Array.from(servers.values()).map(server => ({
      serverId: server.id,
      status: 'disconnected',
      lastConnected: null,
      connectionQuality: 'Unknown',
      monitoredItems: 0,
      reconnectAttempts: 0
    })),
    loops: Array.from(loops.values()),
    publisher: {
      status: 'healthy',
      connected: true,
      publishedSamples: 0,
      failedPublishes: 0
    }
  });
});

// Health endpoint without API prefix (frontend compatibility)
app.get('/health/detailed', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    connections: {
      total: servers.size,
      connected: 0,
      disconnected: servers.size,
      failed: 0,
      errors: 0
    },
    subscriptions: {
      total: loops.size,
      active: 0,
      failed: 0
    },
    dataFlow: {
      samplesPerSecond: 0,
      batchesPerSecond: 0,
      lastSampleTime: null
    },
    memory: {
      used: process.memoryUsage().heapUsed,
      free: process.memoryUsage().heapTotal - process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
      percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
    },
    publisher: {
      status: 'healthy',
      connected: true,
      publishedSamples: 0,
      failedPublishes: 0,
      lastPublishTime: null
    }
  });
});

// Test connection endpoint
app.post('/api/v1/test-connection', (req, res) => {
  try {
    const serverConfig = req.body;
    console.log(`Testing connection to: ${serverConfig.endpointUrl}`);
    
    // Mock test - in real implementation would actually test OPC UA connection
    res.json({
      success: true,
      message: 'Connection test successful (simulated)',
      details: {
        endpoint: serverConfig.endpointUrl,
        securityPolicy: serverConfig.securityPolicy,
        securityMode: serverConfig.securityMode,
        responseTime: Math.floor(Math.random() * 100) + 50
      }
    });
  } catch (error) {
    console.error('Connection test error:', error);
    res.status(400).json({
      success: false,
      message: 'Connection test failed',
      error: error.message
    });
  }
});

// Security options endpoint
app.get('/security-options', (req, res) => {
  try {
    console.log('Security options request');
    res.json({
      securityPolicies: [
        { name: 'None', value: 'None' },
        { name: 'Basic128Rsa15', value: 'Basic128Rsa15' },
        { name: 'Basic256', value: 'Basic256' },
        { name: 'Basic256Sha256', value: 'Basic256Sha256' },
        { name: 'Aes128Sha256RsaOaep', value: 'Aes128Sha256RsaOaep' },
        { name: 'Aes256Sha256RsaPss', value: 'Aes256Sha256RsaPss' }
      ],
      securityModes: [
        { name: 'None', value: 'None' },
        { name: 'Sign', value: 'Sign' },
        { name: 'Sign and Encrypt', value: 'SignAndEncrypt' }
      ]
    });
  } catch (error) {
    console.error('Error getting security options:', error);
    res.status(500).json({ error: 'Failed to get security options' });
  }
});

// Compatibility endpoints for frontend
app.get('/connections', (req, res) => {
  const connections = Array.from(servers.values()).map(server => ({
    id: server.id,
    name: server.name,
    endpointUrl: server.endpointUrl,
    securityMode: server.securityMode,
    securityPolicy: server.securityPolicy,
    username: server.username,
    status: server.connected ? 'connected' : 'disconnected',
    lastConnected: server.lastConnected || null,
    monitoredItemsCount: server.connected ? Math.floor(Math.random() * 5) + 1 : 0,
    reconnectAttempts: server.connected ? 0 : Math.floor(Math.random() * 3),
    errorMessage: server.connected ? null : 'Not connected'
  }));
  
  res.json({ connections });
});

app.post('/connections', (req, res) => {
  try {
    const connectionId = req.body.name.toLowerCase().replace(/\\s+/g, '-');
    const serverConfig = {
      id: connectionId,
      name: req.body.name,
      endpointUrl: req.body.endpointUrl,
      securityPolicy: req.body.securityPolicy || 'None',
      securityMode: req.body.securityMode || 'None',
      userAuthMethod: req.body.username ? 'username' : 'anonymous',
      username: req.body.username,
      password: req.body.password,
      trustUnknownCerts: true,
      samplingInterval: req.body.requestedPublishingInterval || 1000,
      enabled: true,
      connected: false
    };
    
    servers.set(connectionId, serverConfig);
    console.log(`Created connection via compatibility API: ${connectionId}`);
    res.status(201).json({
      success: true,
      id: connectionId,
      message: 'Connection created successfully'
    });
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(400).json({ error: error.message });
  }
});

// Connection control endpoints
app.post('/connections/:connectionId/connect', (req, res) => {
  try {
    const { connectionId } = req.params;
    const server = servers.get(connectionId);
    
    if (!server) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Simulate connection
    server.connected = true;
    server.lastConnected = new Date().toISOString();
    server.enabled = true;
    servers.set(connectionId, server);
    
    console.log(`Connected to server: ${connectionId}`);
    res.json({
      success: true,
      message: 'Connection established successfully'
    });
  } catch (error) {
    console.error('Error connecting to server:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/connections/:connectionId/disconnect', (req, res) => {
  try {
    const { connectionId } = req.params;
    const server = servers.get(connectionId);
    
    if (!server) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Simulate disconnection
    server.connected = false;
    server.enabled = false;
    servers.set(connectionId, server);
    
    console.log(`Disconnected from server: ${connectionId}`);
    res.json({
      success: true,
      message: 'Connection disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting from server:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/connections/:connectionId/test', (req, res) => {
  try {
    const { connectionId } = req.params;
    const server = servers.get(connectionId);
    
    if (!server) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    console.log(`Testing connection: ${connectionId} -> ${server.endpointUrl}`);
    
    // Simulate connection test
    const success = Math.random() > 0.2; // 80% success rate for demo
    
    res.json({
      success,
      details: {
        serverId: connectionId,
        endpoint: server.endpointUrl,
        status: success ? 'connected' : 'failed',
        connectionQuality: success ? 'Good' : 'Bad',
        responseTime: success ? Math.floor(Math.random() * 100) + 50 : null,
        lastConnected: success ? new Date().toISOString() : null,
        monitoredItems: success ? Math.floor(Math.random() * 10) : 0,
        reconnectAttempts: success ? 0 : Math.floor(Math.random() * 3)
      },
      error: success ? null : 'Connection test failed - endpoint not reachable'
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`404 - ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.originalUrl} not found`
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled API error:', error);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  }
});

// Start server
async function start() {
  try {
    await loadConfig();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\\n=== CLPM OPC UA Server Started ===`);
      console.log(`Port: ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Servers: http://localhost:${PORT}/api/v1/servers`);
      console.log(`Loaded ${servers.size} servers and ${loops.size} loops`);
      console.log(`===============================\\n`);
    });
    
    server.on('error', (error) => {
      console.error('Server error:', error);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();