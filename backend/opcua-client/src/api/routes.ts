import { Router, Request, Response, NextFunction } from 'express';
import { Logger } from 'pino';
import { OPCUAClient } from '../OPCUAClient.js';
import { validateServerConfig, validateLoopSubscription, sanitizeConfig } from '../utils/validation.js';

interface ApiRequest extends Request {
  opcuaClient: OPCUAClient;
  logger: Logger;
}

export function createApiRoutes(opcuaClient: OPCUAClient, logger: Logger): Router {
  const router = Router();

  // Middleware to add client and logger to request
  router.use((req: Request, res: Response, next: NextFunction) => {
    (req as ApiRequest).opcuaClient = opcuaClient;
    (req as ApiRequest).logger = logger.child({ 
      component: 'API',
      requestId: req.headers['x-request-id'] || Date.now().toString()
    });
    next();
  });

  // Health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const health = apiReq.opcuaClient.getHealthStatus();
      const summary = {
        status: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        connections: health.connections.connected,
        totalConnections: health.connections.total
      };

      res.status(health.status === 'healthy' ? 200 : 503).json(summary);
    } catch (error: any) {
      apiReq.logger.error({ error }, 'Health check failed');
      res.status(500).json({ error: 'Health check failed' });
    }
  });

  // Detailed health endpoint
  router.get('/health/detailed', (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const health = apiReq.opcuaClient.getHealthStatus();
      res.json(health);
    } catch (error: any) {
      apiReq.logger.error({ error }, 'Detailed health check failed');
      res.status(500).json({ error: 'Detailed health check failed' });
    }
  });

  // Metrics endpoint
  router.get('/metrics', (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const metrics = apiReq.opcuaClient.getMetrics();
      res.json(metrics);
    } catch (error: any) {
      apiReq.logger.error({ error }, 'Metrics retrieval failed');
      res.status(500).json({ error: 'Metrics retrieval failed' });
    }
  });

  // Server configuration endpoints
  router.get('/servers', (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const servers = apiReq.opcuaClient.getServers();
      const sanitizedServers = servers.map(server => sanitizeConfig(server));
      res.json(sanitizedServers);
    } catch (error: any) {
      apiReq.logger.error({ error }, 'Failed to get servers');
      res.status(500).json({ error: 'Failed to get servers' });
    }
  });

  router.get('/servers/:serverId', (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { serverId } = req.params;
      const servers = apiReq.opcuaClient.getServers();
      const server = servers.find(s => s.id === serverId);
      
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      res.json(sanitizeConfig(server));
    } catch (error: any) {
      apiReq.logger.error({ error, serverId: req.params.serverId }, 'Failed to get server');
      res.status(500).json({ error: 'Failed to get server' });
    }
  });

  router.post('/servers', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      // Generate a unique ID for new servers
      const serverId = req.body.id || `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const serverConfig = validateServerConfig({ ...req.body, id: serverId }, false);
      
      // Ensure the generated ID is set
      serverConfig.id = serverId;
      
      await apiReq.opcuaClient.setServer(serverConfig);
      
      apiReq.logger.info({ serverId: serverConfig.id }, 'Server configuration created');
      res.status(201).json(sanitizeConfig(serverConfig));
    } catch (error: any) {
      apiReq.logger.error({ error, body: req.body }, 'Failed to create server');
      res.status(400).json({ error: error.message });
    }
  });

  router.put('/servers/:serverId', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { serverId } = req.params;
      const serverConfig = validateServerConfig({ ...req.body, id: serverId });
      await apiReq.opcuaClient.setServer(serverConfig);
      
      apiReq.logger.info({ serverId }, 'Server configuration updated');
      res.json(sanitizeConfig(serverConfig));
    } catch (error: any) {
      apiReq.logger.error({ error, serverId: req.params.serverId }, 'Failed to update server');
      res.status(400).json({ error: error.message });
    }
  });

  router.delete('/servers/:serverId', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { serverId } = req.params;
      const removed = await apiReq.opcuaClient.removeServer(serverId);
      
      if (!removed) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      apiReq.logger.info({ serverId }, 'Server configuration deleted');
      res.status(204).send();
    } catch (error: any) {
      apiReq.logger.error({ error, serverId: req.params.serverId }, 'Failed to delete server');
      res.status(500).json({ error: 'Failed to delete server' });
    }
  });

  // Loop subscription endpoints
  router.get('/loops', (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { serverId } = req.query;
      let loops = apiReq.opcuaClient.getLoops();
      
      if (serverId) {
        loops = loops.filter(loop => loop.serverId === serverId);
      }
      
      res.json(loops);
    } catch (error: any) {
      apiReq.logger.error({ error }, 'Failed to get loops');
      res.status(500).json({ error: 'Failed to get loops' });
    }
  });

  router.get('/loops/:loopId', (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { loopId } = req.params;
      const loops = apiReq.opcuaClient.getLoops();
      const loop = loops.find(l => l.loopId === loopId);
      
      if (!loop) {
        return res.status(404).json({ error: 'Loop not found' });
      }
      
      res.json(loop);
    } catch (error: any) {
      apiReq.logger.error({ error, loopId: req.params.loopId }, 'Failed to get loop');
      res.status(500).json({ error: 'Failed to get loop' });
    }
  });

  router.post('/loops', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const loopConfig = validateLoopSubscription(req.body);
      await apiReq.opcuaClient.setLoop(loopConfig);
      
      apiReq.logger.info({ loopId: loopConfig.loopId }, 'Loop subscription created');
      res.status(201).json(loopConfig);
    } catch (error: any) {
      apiReq.logger.error({ error, body: req.body }, 'Failed to create loop');
      res.status(400).json({ error: error.message });
    }
  });

  router.put('/loops/:loopId', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { loopId } = req.params;
      const loopConfig = validateLoopSubscription({ ...req.body, loopId });
      await apiReq.opcuaClient.setLoop(loopConfig);
      
      apiReq.logger.info({ loopId }, 'Loop subscription updated');
      res.json(loopConfig);
    } catch (error: any) {
      apiReq.logger.error({ error, loopId: req.params.loopId }, 'Failed to update loop');
      res.status(400).json({ error: error.message });
    }
  });

  router.delete('/loops/:loopId', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { loopId } = req.params;
      const removed = await apiReq.opcuaClient.removeLoop(loopId);
      
      if (!removed) {
        return res.status(404).json({ error: 'Loop not found' });
      }
      
      apiReq.logger.info({ loopId }, 'Loop subscription deleted');
      res.status(204).send();
    } catch (error: any) {
      apiReq.logger.error({ error, loopId: req.params.loopId }, 'Failed to delete loop');
      res.status(500).json({ error: 'Failed to delete loop' });
    }
  });

  // Browse endpoints
  router.get('/browse/:serverId', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { serverId } = req.params;
      const { nodeId = 'RootFolder', maxResults = '1000' } = req.query;
      
      const nodes = await apiReq.opcuaClient.browse(
        serverId, 
        nodeId as string, 
        parseInt(maxResults as string)
      );
      
      res.json(nodes);
    } catch (error: any) {
      apiReq.logger.error({ error, serverId: req.params.serverId }, 'Browse failed');
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/search/:serverId', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { serverId } = req.params;
      const { q: searchTerm, maxResults = '100' } = req.query;
      
      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term (q) is required' });
      }
      
      const nodes = await apiReq.opcuaClient.search(
        serverId,
        searchTerm as string,
        parseInt(maxResults as string)
      );
      
      res.json(nodes);
    } catch (error: any) {
      apiReq.logger.error({ error, serverId: req.params.serverId }, 'Search failed');
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/nodes/:serverId/:nodeId', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { serverId, nodeId } = req.params;
      const nodeDetails = await apiReq.opcuaClient.getNodeDetails(serverId, nodeId);
      res.json(nodeDetails);
    } catch (error: any) {
      apiReq.logger.error({ 
        error, 
        serverId: req.params.serverId, 
        nodeId: req.params.nodeId 
      }, 'Get node details failed');
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/nodes/:serverId/validate', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { serverId } = req.params;
      const { nodeId } = req.body;
      
      if (!nodeId) {
        return res.status(400).json({ error: 'nodeId is required' });
      }
      
      const validation = await apiReq.opcuaClient.validateNode(serverId, nodeId);
      res.json(validation);
    } catch (error: any) {
      apiReq.logger.error({ error, serverId: req.params.serverId }, 'Node validation failed');
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/nodes/:serverId/read', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { serverId } = req.params;
      const { nodeIds } = req.body;
      
      if (!Array.isArray(nodeIds)) {
        return res.status(400).json({ error: 'nodeIds must be an array' });
      }
      
      const values = await apiReq.opcuaClient.readNodes(serverId, nodeIds);
      res.json(values);
    } catch (error: any) {
      apiReq.logger.error({ error, serverId: req.params.serverId }, 'Read nodes failed');
      res.status(500).json({ error: error.message });
    }
  });

  // Certificate management endpoints
  router.get('/certificates/trusted', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const certificates = await apiReq.opcuaClient.getTrustedCertificates();
      res.json(certificates);
    } catch (error: any) {
      apiReq.logger.error({ error }, 'Failed to get trusted certificates');
      res.status(500).json({ error: 'Failed to get trusted certificates' });
    }
  });

  router.get('/certificates/rejected', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const certificates = await apiReq.opcuaClient.getRejectedCertificates();
      res.json(certificates);
    } catch (error: any) {
      apiReq.logger.error({ error }, 'Failed to get rejected certificates');
      res.status(500).json({ error: 'Failed to get rejected certificates' });
    }
  });

  router.post('/certificates/:thumbprint/trust', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { thumbprint } = req.params;
      const result = await apiReq.opcuaClient.trustCertificate(thumbprint);
      
      if (!result) {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      
      apiReq.logger.info({ thumbprint }, 'Certificate trusted');
      res.json({ success: true });
    } catch (error: any) {
      apiReq.logger.error({ error, thumbprint: req.params.thumbprint }, 'Failed to trust certificate');
      res.status(500).json({ error: 'Failed to trust certificate' });
    }
  });

  router.post('/certificates/:thumbprint/revoke', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const { thumbprint } = req.params;
      const result = await apiReq.opcuaClient.revokeCertificate(thumbprint);
      
      if (!result) {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      
      apiReq.logger.info({ thumbprint }, 'Certificate revoked');
      res.json({ success: true });
    } catch (error: any) {
      apiReq.logger.error({ error, thumbprint: req.params.thumbprint }, 'Failed to revoke certificate');
      res.status(500).json({ error: 'Failed to revoke certificate' });
    }
  });

  // Data publishing endpoints
  router.post('/data/flush', async (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      await apiReq.opcuaClient.flush();
      apiReq.logger.info('Data flush requested');
      res.json({ success: true });
    } catch (error: any) {
      apiReq.logger.error({ error }, 'Data flush failed');
      res.status(500).json({ error: 'Data flush failed' });
    }
  });

  // Status and connection information
  router.get('/connections', (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const metrics = apiReq.opcuaClient.getMetrics();
      res.json(metrics.connections);
    } catch (error: any) {
      apiReq.logger.error({ error }, 'Failed to get connection status');
      res.status(500).json({ error: 'Failed to get connection status' });
    }
  });

  router.get('/status', (req: Request, res: Response) => {
    const apiReq = req as ApiRequest;
    try {
      const health = apiReq.opcuaClient.getHealthStatus();
      const metrics = apiReq.opcuaClient.getMetrics();
      
      const status = {
        health: {
          status: health.status,
          uptime: health.uptime,
          memory: health.memory
        },
        connections: health.connections,
        data: health.data,
        publisher: metrics.publisher,
        timestamp: new Date().toISOString()
      };
      
      res.json(status);
    } catch (error: any) {
      apiReq.logger.error({ error }, 'Failed to get status');
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  // Error handling middleware
  router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    const apiReq = req as ApiRequest;
    apiReq.logger.error({ error, url: req.url, method: req.method }, 'API error');
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  return router;
}