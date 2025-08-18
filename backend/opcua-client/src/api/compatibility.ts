import { Router, Request, Response } from 'express';
import { Logger } from 'pino';
import { MessageSecurityMode, SecurityPolicy } from 'node-opcua';
import { OPCUAClient } from '../OPCUAClient.js';
import { ServerConfig } from '../types/index.js';

interface CompatibilityRequest extends Request {
  opcuaClient: OPCUAClient;
  logger: Logger;
}

/**
 * Compatibility layer for frontend integration
 * Maps our OPC UA client API to the expected frontend interface
 */
export function createCompatibilityRoutes(opcuaClient: OPCUAClient, logger: Logger): Router {
  const router = Router();

  // Middleware to add client and logger to request
  router.use((req: Request, _res: Response, next) => {
    (req as CompatibilityRequest).opcuaClient = opcuaClient;
    (req as CompatibilityRequest).logger = logger.child({ 
      component: 'CompatibilityAPI',
      requestId: req.headers['x-request-id'] || Date.now().toString()
    });
    next();
  });

  // Legacy connections endpoint (maps to our servers)
  router.get('/connections', (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const servers = compatReq.opcuaClient.getServers();
      const connectionStatuses = compatReq.opcuaClient.getMetrics().connections;
      
      // Reverse mapping from OPC UA enums to frontend strings
      const securityPolicyToFrontend: { [key: string]: string } = {
        [SecurityPolicy.None]: 'None',
        [SecurityPolicy.Basic128Rsa15]: 'Basic128Rsa15',
        [SecurityPolicy.Basic256]: 'Basic256',
        [SecurityPolicy.Basic256Sha256]: 'Basic256Sha256',
        [SecurityPolicy.Aes128_Sha256_RsaOaep]: 'Aes128Sha256RsaOaep',
        [SecurityPolicy.Aes256_Sha256_RsaPss]: 'Aes256Sha256RsaPss'
      };
      
      const securityModeToFrontend: { [key: string]: string } = {
        [MessageSecurityMode.None]: 'None',
        [MessageSecurityMode.Sign]: 'Sign',
        [MessageSecurityMode.SignAndEncrypt]: 'SignAndEncrypt'
      };
      
      // Transform our server configs to frontend-expected format
      const connections = servers.map(server => {
        const status = Array.isArray(connectionStatuses) 
          ? connectionStatuses.find(s => s.serverId === server.id)
          : null;
        
        return {
          id: server.id,
          name: server.name || server.id,
          endpointUrl: server.endpointUrl,
          securityMode: securityModeToFrontend[server.securityMode] || 'None',
          securityPolicy: securityPolicyToFrontend[server.securityPolicy] || 'None',
          username: server.username,
          // Don't expose password
          status: status?.status || 'disconnected',
          lastConnected: status?.lastConnected,
          monitoredItemsCount: status?.monitoredItems || 0,
          reconnectAttempts: status?.reconnectAttempts || 0,
          errorMessage: status?.lastError,
          requestedSessionTimeout: server.requestedSessionTimeout || 60000,
          requestedPublishingInterval: server.samplingInterval || 1000,
          requestedLifetimeCount: 1000,
          requestedMaxKeepAliveCount: 10,
          maxNotificationsPerPublish: server.maxNotificationsPerPublish || 1000,
          priority: 10,
          certificatePath: server.clientCertificate,
          privateKeyPath: server.clientPrivateKey,
          userCertificate: server.userCertificate,
          userPrivateKey: server.userPrivateKey
        };
      });

      res.json({ connections });
    } catch (error: any) {
      compatReq.logger.error({ error }, 'Failed to get connections');
      res.status(500).json({ error: 'Failed to get connections' });
    }
  });

  // Security options endpoint
  router.get('/security-options', (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const securityOptions = {
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
      };
      
      res.json(securityOptions);
    } catch (error: any) {
      compatReq.logger.error({ error }, 'Failed to get security options');
      res.status(500).json({ error: 'Failed to get security options' });
    }
  });

  // Create connection endpoint
  router.post('/connections', async (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const connectionData = req.body;
      
      // Map frontend security policy names to OPC UA enums
      const securityPolicyMap: { [key: string]: SecurityPolicy } = {
        'None': SecurityPolicy.None,
        'Basic128Rsa15': SecurityPolicy.Basic128Rsa15,
        'Basic256': SecurityPolicy.Basic256,
        'Basic256Sha256': SecurityPolicy.Basic256Sha256,
        'Aes128Sha256RsaOaep': SecurityPolicy.Aes128_Sha256_RsaOaep,
        'Aes256Sha256RsaPss': SecurityPolicy.Aes256_Sha256_RsaPss
      };
      
      // Map frontend security mode names to OPC UA enums
      const securityModeMap: { [key: string]: MessageSecurityMode } = {
        'None': MessageSecurityMode.None,
        'Sign': MessageSecurityMode.Sign,
        'SignAndEncrypt': MessageSecurityMode.SignAndEncrypt
      };
      
      // Transform frontend format to our server config format
      const serverConfig = {
        id: connectionData.name.toLowerCase().replace(/\s+/g, '-'), // Generate ID from name
        name: connectionData.name,
        endpointUrl: connectionData.endpointUrl,
        securityPolicy: securityPolicyMap[connectionData.securityPolicy] || SecurityPolicy.None,
        securityMode: securityModeMap[connectionData.securityMode] || MessageSecurityMode.None,
        userAuthMethod: connectionData.username ? 'username' as const : 'anonymous' as const,
        username: connectionData.username,
        password: connectionData.password,
        clientCertificate: connectionData.certificatePath,
        clientPrivateKey: connectionData.privateKeyPath,
        userCertificate: connectionData.certificatePath,
        userPrivateKey: connectionData.privateKeyPath,
        trustUnknownCerts: true,
        samplingInterval: connectionData.requestedPublishingInterval || 1000,
        maxSessionSubscriptions: 1000,
        requestedSessionTimeout: connectionData.requestedSessionTimeout || 60000,
        maxNotificationsPerPublish: connectionData.maxNotificationsPerPublish || 1000,
        redundantEndpoints: [],
        enabled: true
      };

      await compatReq.opcuaClient.setServer(serverConfig as unknown as ServerConfig);
      
      compatReq.logger.info({ serverId: serverConfig.id }, 'Connection created via compatibility API');
      res.status(201).json({ 
        success: true, 
        id: serverConfig.id,
        message: 'Connection created successfully' 
      });
    } catch (error: any) {
      compatReq.logger.error({ error, body: req.body }, 'Failed to create connection');
      res.status(400).json({ error: error.message || 'Failed to create connection' });
    }
  });

  // Update connection endpoint
  router.put('/connections/:connectionId', async (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const { connectionId } = req.params;
      const connectionData = req.body;
      
      // Map frontend security policy names to OPC UA enums
      const securityPolicyMap: { [key: string]: SecurityPolicy } = {
        'None': SecurityPolicy.None,
        'Basic128Rsa15': SecurityPolicy.Basic128Rsa15,
        'Basic256': SecurityPolicy.Basic256,
        'Basic256Sha256': SecurityPolicy.Basic256Sha256,
        'Aes128Sha256RsaOaep': SecurityPolicy.Aes128_Sha256_RsaOaep,
        'Aes256Sha256RsaPss': SecurityPolicy.Aes256_Sha256_RsaPss
      };
      
      // Map frontend security mode names to OPC UA enums
      const securityModeMap: { [key: string]: MessageSecurityMode } = {
        'None': MessageSecurityMode.None,
        'Sign': MessageSecurityMode.Sign,
        'SignAndEncrypt': MessageSecurityMode.SignAndEncrypt
      };
      
      // Transform frontend format to our server config format
      const serverConfig = {
        id: connectionId,
        name: connectionData.name,
        endpointUrl: connectionData.endpointUrl,
        securityPolicy: securityPolicyMap[connectionData.securityPolicy] || SecurityPolicy.None,
        securityMode: securityModeMap[connectionData.securityMode] || MessageSecurityMode.None,
        userAuthMethod: connectionData.username ? 'username' as const : 'anonymous' as const,
        username: connectionData.username,
        password: connectionData.password,
        clientCertificate: connectionData.certificatePath,
        clientPrivateKey: connectionData.privateKeyPath,
        userCertificate: connectionData.certificatePath,
        userPrivateKey: connectionData.privateKeyPath,
        trustUnknownCerts: true,
        samplingInterval: connectionData.requestedPublishingInterval || 1000,
        maxSessionSubscriptions: 1000,
        requestedSessionTimeout: connectionData.requestedSessionTimeout || 60000,
        maxNotificationsPerPublish: connectionData.maxNotificationsPerPublish || 1000,
        redundantEndpoints: [],
        enabled: true
      };

      await compatReq.opcuaClient.setServer(serverConfig as unknown as ServerConfig);
      
      compatReq.logger.info({ serverId: connectionId }, 'Connection updated via compatibility API');
      res.json({ 
        success: true, 
        message: 'Connection updated successfully' 
      });
    } catch (error: any) {
      compatReq.logger.error({ error, connectionId: req.params['connectionId'] }, 'Failed to update connection');
      res.status(400).json({ error: error.message || 'Failed to update connection' });
    }
  });

  // Delete connection endpoint
  router.delete('/connections/:connectionId', async (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const { connectionId } = req.params;
      const removed = await compatReq.opcuaClient.removeServer(connectionId);
      
      if (!removed) {
        return res.status(404).json({ error: 'Connection not found' });
      }
      
      compatReq.logger.info({ serverId: connectionId }, 'Connection deleted via compatibility API');
      return res.json({ 
        success: true, 
        message: 'Connection deleted successfully' 
      });
    } catch (error: any) {
      compatReq.logger.error({ error, connectionId: req.params['connectionId'] }, 'Failed to delete connection');
      res.status(500).json({ error: 'Failed to delete connection' });
    }
  });

  // Connect endpoint
  router.post('/connections/:connectionId/connect', async (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const { connectionId } = req.params;
      const servers = compatReq.opcuaClient.getServers();
      const server = servers.find(s => s.id === connectionId);
      
      if (!server) {
        return res.status(404).json({ error: 'Connection not found' });
      }
      
      // Update server to enabled and let the connection manager handle the connection
      const updatedServer = { ...server, enabled: true };
      await compatReq.opcuaClient.setServer(updatedServer);
      
      compatReq.logger.info({ serverId: connectionId }, 'Connection enabled via compatibility API');
      return res.json({ 
        success: true, 
        message: 'Connection initiated successfully' 
      });
    } catch (error: any) {
      compatReq.logger.error({ error, connectionId: req.params['connectionId'] }, 'Failed to connect');
      res.status(500).json({ error: error.message || 'Failed to connect' });
    }
  });

  // Disconnect endpoint
  router.post('/connections/:connectionId/disconnect', async (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const { connectionId } = req.params;
      const servers = compatReq.opcuaClient.getServers();
      const server = servers.find(s => s.id === connectionId);
      
      if (!server) {
        return res.status(404).json({ error: 'Connection not found' });
      }
      
      // Update server to disabled
      const updatedServer = { ...server, enabled: false };
      await compatReq.opcuaClient.setServer(updatedServer);
      
      compatReq.logger.info({ serverId: connectionId }, 'Connection disabled via compatibility API');
      return res.json({ 
        success: true, 
        message: 'Connection disconnected successfully' 
      });
    } catch (error: any) {
      compatReq.logger.error({ error, connectionId: req.params['connectionId'] }, 'Failed to disconnect');
      res.status(500).json({ error: error.message || 'Failed to disconnect' });
    }
  });

  // Test connection endpoint
  router.post('/connections/:connectionId/test', async (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const { connectionId } = req.params;
      const servers = compatReq.opcuaClient.getServers();
      const server = servers.find(s => s.id === connectionId);
      
      if (!server) {
        return res.status(404).json({ error: 'Connection not found' });
      }
      
      // For now, we'll return the current connection status as test result
      const connectionStatuses = compatReq.opcuaClient.getMetrics().connections;
      const status = Array.isArray(connectionStatuses) 
        ? connectionStatuses.find(s => s.serverId === connectionId)
        : null;
      
      const success = status?.status === 'connected';
      
      return res.json({
        success,
        details: {
          serverId: connectionId,
          endpoint: server.endpointUrl,
          status: status?.status || 'unknown',
          connectionQuality: status?.connectionQuality || 'unknown',
          lastConnected: status?.lastConnected,
          monitoredItems: status?.monitoredItems || 0,
          reconnectAttempts: status?.reconnectAttempts || 0
        },
        error: success ? null : (status?.lastError || 'Connection not established')
      });
    } catch (error: any) {
      compatReq.logger.error({ error, connectionId: req.params['connectionId'] }, 'Failed to test connection');
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to test connection' 
      });
    }
  });

  // Discover endpoints (placeholder)
  router.get('/discover', async (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const { endpointUrl } = req.query;
      
      if (!endpointUrl) {
        return res.status(400).json({ error: 'endpointUrl parameter is required' });
      }
      
      // For now, return some mock discovery results
      // In a full implementation, this would use the OPC UA discovery service
      const endpoints = [
        {
          endpointUrl: endpointUrl as string,
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
          endpointUrl: endpointUrl as string,
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
    } catch (error: any) {
      compatReq.logger.error({ error }, 'Failed to discover endpoints');
      res.status(500).json({ error: 'Failed to discover endpoints' });
    }
  });

  // Browse endpoints for tag browsing
  router.get('/connections/:connectionId/browse', async (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const { connectionId } = req.params;
      const { nodeId = 'RootFolder', maxResults = '1000' } = req.query;
      
      const nodes = await compatReq.opcuaClient.browse(
        connectionId, 
        nodeId as string, 
        parseInt(maxResults as string)
      );
      
      res.json({ results: nodes });
    } catch (error: any) {
      compatReq.logger.error({ error, connectionId: req.params.connectionId }, 'Browse failed');
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/connections/:connectionId/search', async (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      const { connectionId } = req.params;
      const { q: searchTerm, maxResults = '100' } = req.query;
      
      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term (q) is required' });
      }
      
      const nodes = await compatReq.opcuaClient.search(
        connectionId,
        searchTerm as string,
        parseInt(maxResults as string)
      );
      
      res.json({ results: nodes });
    } catch (error: any) {
      compatReq.logger.error({ error, connectionId: req.params.connectionId }, 'Search failed');
      res.status(500).json({ error: error.message });
    }
  });

  // Certificate upload (placeholder)
  router.post('/certificates/upload', async (req: Request, res: Response) => {
    const compatReq = req as CompatibilityRequest;
    try {
      // This is a placeholder - in a full implementation you would:
      // 1. Process the uploaded file using multer or similar
      // 2. Validate the certificate format
      // 3. Store it in the certificate directory
      // 4. Return the file path
      
      res.status(501).json({ 
        error: 'Certificate upload not yet implemented',
        message: 'Use the certificate management endpoints in the main API'
      });
    } catch (error: any) {
      compatReq.logger.error({ error }, 'Failed to upload certificate');
      res.status(500).json({ error: 'Failed to upload certificate' });
    }
  });

  return router;
}