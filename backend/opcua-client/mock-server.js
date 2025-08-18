#!/usr/bin/env node

/**
 * Simple mock OPC UA API server for frontend testing
 * This provides the compatibility endpoints the frontend expects
 * until the full OPC UA client TypeScript build issues are resolved
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());

// Mock data
let mockConnections = [
  {
    id: 'demo-server-1',
    name: 'Demo OPC UA Server',
    endpointUrl: 'opc.tcp://localhost:4840/UA/TestServer',
    securityMode: 'None',
    securityPolicy: 'None',
    status: 'connected',
    monitoredItemsCount: 12,
    reconnectAttempts: 0,
    lastConnected: new Date().toISOString()
  },
  {
    id: 'local-server',
    name: 'Local Test Server',
    endpointUrl: 'opc.tcp://192.168.1.100:4840',
    securityMode: 'SignAndEncrypt',
    securityPolicy: 'Basic256Sha256',
    status: 'disconnected',
    monitoredItemsCount: 0,
    reconnectAttempts: 3,
    errorMessage: 'Connection timeout'
  }
];

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Mock OPC UA API'
  });
});

// Get all connections
app.get('/connections', (req, res) => {
  res.json({ connections: mockConnections });
});

// Get security options
app.get('/security-options', (req, res) => {
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
});

// Create connection
app.post('/connections', (req, res) => {
  const connectionData = req.body;
  
  const newConnection = {
    id: connectionData.name.toLowerCase().replace(/\s+/g, '-'),
    name: connectionData.name,
    endpointUrl: connectionData.endpointUrl,
    securityMode: connectionData.securityMode || 'None',
    securityPolicy: connectionData.securityPolicy || 'None',
    username: connectionData.username,
    status: 'disconnected',
    monitoredItemsCount: 0,
    reconnectAttempts: 0
  };
  
  mockConnections.push(newConnection);
  
  res.status(201).json({
    success: true,
    id: newConnection.id,
    message: 'Connection created successfully'
  });
});

// Update connection
app.put('/connections/:connectionId', (req, res) => {
  const { connectionId } = req.params;
  const connectionData = req.body;
  
  const connectionIndex = mockConnections.findIndex(c => c.id === connectionId);
  if (connectionIndex === -1) {
    return res.status(404).json({ error: 'Connection not found' });
  }
  
  mockConnections[connectionIndex] = {
    ...mockConnections[connectionIndex],
    name: connectionData.name,
    endpointUrl: connectionData.endpointUrl,
    securityMode: connectionData.securityMode || 'None',
    securityPolicy: connectionData.securityPolicy || 'None',
    username: connectionData.username
  };
  
  res.json({
    success: true,
    message: 'Connection updated successfully'
  });
});

// Delete connection
app.delete('/connections/:connectionId', (req, res) => {
  const { connectionId } = req.params;
  
  const connectionIndex = mockConnections.findIndex(c => c.id === connectionId);
  if (connectionIndex === -1) {
    return res.status(404).json({ error: 'Connection not found' });
  }
  
  mockConnections.splice(connectionIndex, 1);
  
  res.json({
    success: true,
    message: 'Connection deleted successfully'
  });
});

// Connect
app.post('/connections/:connectionId/connect', (req, res) => {
  const { connectionId } = req.params;
  
  const connection = mockConnections.find(c => c.id === connectionId);
  if (!connection) {
    return res.status(404).json({ error: 'Connection not found' });
  }
  
  // Simulate connection
  connection.status = 'connected';
  connection.lastConnected = new Date().toISOString();
  connection.monitoredItemsCount = Math.floor(Math.random() * 20) + 5;
  connection.reconnectAttempts = 0;
  delete connection.errorMessage;
  
  res.json({
    success: true,
    message: 'Connection initiated successfully'
  });
});

// Disconnect
app.post('/connections/:connectionId/disconnect', (req, res) => {
  const { connectionId } = req.params;
  
  const connection = mockConnections.find(c => c.id === connectionId);
  if (!connection) {
    return res.status(404).json({ error: 'Connection not found' });
  }
  
  connection.status = 'disconnected';
  connection.monitoredItemsCount = 0;
  
  res.json({
    success: true,
    message: 'Connection disconnected successfully'
  });
});

// Test connection
app.post('/connections/:connectionId/test', (req, res) => {
  const { connectionId } = req.params;
  
  const connection = mockConnections.find(c => c.id === connectionId);
  if (!connection) {
    return res.status(404).json({ error: 'Connection not found' });
  }
  
  // Simulate test result
  const success = Math.random() > 0.3; // 70% success rate
  
  const result = {
    success,
    details: {
      serverId: connectionId,
      endpoint: connection.endpointUrl,
      status: connection.status,
      connectionQuality: success ? 'good' : 'poor',
      lastConnected: connection.lastConnected,
      monitoredItems: connection.monitoredItemsCount,
      reconnectAttempts: connection.reconnectAttempts
    },
    error: success ? null : 'Simulated connection failure'
  };
  
  res.json(result);
});

// Discover endpoints
app.get('/discover', (req, res) => {
  const { endpointUrl } = req.query;
  
  if (!endpointUrl) {
    return res.status(400).json({ error: 'endpointUrl parameter is required' });
  }
  
  // Mock discovery results
  const endpoints = [
    {
      endpointUrl: endpointUrl,
      securityMode: 'None',
      securityPolicy: 'None',
      securityLevel: 0,
      transportProfileUri: 'http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary',
      userTokenPolicies: [
        {
          policyId: 'anonymous',
          tokenType: 'Anonymous'
        }
      ]
    },
    {
      endpointUrl: endpointUrl,
      securityMode: 'SignAndEncrypt',
      securityPolicy: 'Basic256Sha256',
      securityLevel: 3,
      transportProfileUri: 'http://opcfoundation.org/UA-Profile/Transport/uatcp-uasc-uabinary',
      userTokenPolicies: [
        {
          policyId: 'username',
          tokenType: 'UserName'
        }
      ]
    }
  ];
  
  res.json({ endpoints });
});

// Certificate upload (placeholder)
app.post('/certificates/upload', (req, res) => {
  res.status(501).json({
    error: 'Certificate upload not yet implemented',
    message: 'Use the certificate management endpoints in the main API'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.originalUrl} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mock OPC UA API Server running on http://localhost:${PORT}`);
  console.log('📡 Providing compatibility endpoints for frontend testing');
  console.log('🔗 Endpoints available:');
  console.log('  GET    /health');
  console.log('  GET    /connections');
  console.log('  POST   /connections');
  console.log('  PUT    /connections/:id');
  console.log('  DELETE /connections/:id');
  console.log('  POST   /connections/:id/connect');
  console.log('  POST   /connections/:id/disconnect');
  console.log('  POST   /connections/:id/test');
  console.log('  GET    /security-options');
  console.log('  GET    /discover');
});

export default app;