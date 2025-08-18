import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Logger } from 'pino';
import { OPCUAClient } from '../OPCUAClient.js';
import { createApiRoutes } from './routes.js';
import { createCompatibilityRoutes } from './compatibility.js';

interface ServerConfig {
  port: number;
  host?: string;
  enableCors?: boolean;
  corsOrigins?: string[];
  enableCompression?: boolean;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  authentication?: {
    enabled: boolean;
    apiKey?: string;
    jwt?: {
      secret: string;
      algorithms: string[];
    };
  };
}

export class ApiServer {
  private app: Express;
  private server?: any;
  private logger: Logger;
  private config: ServerConfig;
  private opcuaClient: OPCUAClient;

  constructor(logger: Logger, opcuaClient: OPCUAClient, config: ServerConfig) {
    this.logger = logger.child({ component: 'ApiServer' });
    this.opcuaClient = opcuaClient;
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
    if (this.config.enableCors !== false) {
      this.app.use(cors({
        origin: this.config.corsOrigins || true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID']
      }));
    }

    // Compression
    if (this.config.enableCompression !== false) {
      this.app.use(compression());
    }

    // Rate limiting
    if (this.config.rateLimit) {
      const limiter = rateLimit({
        windowMs: this.config.rateLimit.windowMs,
        max: this.config.rateLimit.max,
        message: {
          error: 'Too many requests from this IP, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false,
      });
      this.app.use(limiter);
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] || Date.now().toString();
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.info({
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }, 'HTTP request');
      });

      next();
    });

    // Authentication middleware
    if (this.config.authentication?.enabled) {
      this.app.use('/api', this.authenticationMiddleware.bind(this));
    }
  }

  /**
   * Authentication middleware
   */
  private authenticationMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip authentication for health check
    if (req.path === '/health' || req.path === '/health/detailed') {
      return next();
    }

    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];

    // API Key authentication
    if (this.config.authentication?.apiKey && apiKeyHeader) {
      if (apiKeyHeader === this.config.authentication.apiKey) {
        return next();
      }
    }

    // JWT authentication
    if (this.config.authentication?.jwt && authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        // In a real implementation, you would verify the JWT token here
        // For now, we'll just check if it's not empty
        if (token) {
          return next();
        }
      } catch (error) {
        this.logger.warn({ error }, 'JWT verification failed');
      }
    }

    // No valid authentication found
    res.status(401).json({ 
      error: 'Authentication required',
      message: 'Provide valid API key or JWT token'
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'CLPM OPC UA Client'
      });
    });

    // API routes
    this.app.use('/api/v1', createApiRoutes(this.opcuaClient, this.logger));
    
    // Compatibility routes for frontend integration (legacy endpoints)
    this.app.use('/', createCompatibilityRoutes(this.opcuaClient, this.logger));

    // Metrics endpoint for Prometheus
    this.app.get('/metrics', (req: Request, res: Response) => {
      try {
        const metrics = this.opcuaClient.getMetrics();
        
        // Convert to Prometheus format if requested
        const acceptHeader = req.headers.accept;
        if (acceptHeader?.includes('text/plain')) {
          // Return Prometheus format (simplified)
          const lines: string[] = [];
          
          // Add basic metrics
          const health = this.opcuaClient.getHealthStatus();
          lines.push(`# HELP opcua_uptime_seconds Application uptime in seconds`);
          lines.push(`# TYPE opcua_uptime_seconds gauge`);
          lines.push(`opcua_uptime_seconds ${health.uptime}`);
          
          lines.push(`# HELP opcua_connections_total Total number of OPC UA connections`);
          lines.push(`# TYPE opcua_connections_total gauge`);
          lines.push(`opcua_connections_total ${health.connections.total}`);
          
          lines.push(`# HELP opcua_connections_active Number of active OPC UA connections`);
          lines.push(`# TYPE opcua_connections_active gauge`);
          lines.push(`opcua_connections_active ${health.connections.connected}`);
          
          res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
          res.send(lines.join('\n') + '\n');
        } else {
          res.json(metrics);
        }
      } catch (error: any) {
        this.logger.error({ error }, 'Metrics endpoint failed');
        res.status(500).json({ error: 'Failed to get metrics' });
      }
    });

    // API documentation endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      const endpoints = {
        health: {
          '/health': 'GET - Basic health check',
          '/api/v1/health': 'GET - Detailed health information',
          '/api/v1/health/detailed': 'GET - Complete health status'
        },
        servers: {
          '/api/v1/servers': 'GET - List all servers, POST - Create server',
          '/api/v1/servers/:serverId': 'GET - Get server, PUT - Update server, DELETE - Delete server'
        },
        loops: {
          '/api/v1/loops': 'GET - List all loops, POST - Create loop',
          '/api/v1/loops/:loopId': 'GET - Get loop, PUT - Update loop, DELETE - Delete loop'
        },
        browse: {
          '/api/v1/browse/:serverId': 'GET - Browse address space',
          '/api/v1/search/:serverId': 'GET - Search nodes',
          '/api/v1/nodes/:serverId/:nodeId': 'GET - Get node details',
          '/api/v1/nodes/:serverId/validate': 'POST - Validate node',
          '/api/v1/nodes/:serverId/read': 'POST - Read multiple nodes'
        },
        certificates: {
          '/api/v1/certificates/trusted': 'GET - List trusted certificates',
          '/api/v1/certificates/rejected': 'GET - List rejected certificates',
          '/api/v1/certificates/:thumbprint/trust': 'POST - Trust certificate',
          '/api/v1/certificates/:thumbprint/revoke': 'POST - Revoke certificate'
        },
        data: {
          '/api/v1/data/flush': 'POST - Flush pending data',
          '/api/v1/connections': 'GET - Connection status',
          '/api/v1/status': 'GET - Overall system status'
        },
        monitoring: {
          '/metrics': 'GET - Prometheus metrics',
          '/api/v1/metrics': 'GET - JSON metrics'
        }
      };

      res.json({
        service: 'CLPM OPC UA Client API',
        version: '1.0.0',
        description: 'REST API for OPC UA client configuration and monitoring',
        endpoints
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
        availableEndpoints: '/api'
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error({
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body
      }, 'Unhandled API error');

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
          requestId: req.headers['x-request-id']
        });
      }
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(
          this.config.port,
          this.config.host ?? '0.0.0.0',
          () => {
          this.logger.info({
            port: this.config.port,
            host: this.config.host || '0.0.0.0'
          }, 'API server started');
          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error({ error }, 'Server error');
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error?: Error) => {
        if (error) {
          this.logger.error({ error }, 'Error stopping server');
          reject(error);
        } else {
          this.logger.info('API server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get Express app instance
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get server configuration
   */
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return !!this.server && this.server.listening;
  }
}

/**
 * Create server configuration from environment variables
 */
export function createServerConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT) || 3002,
    host: process.env.HOST || '0.0.0.0',
    enableCors: process.env.ENABLE_CORS !== 'false',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : undefined,
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
    rateLimit: process.env.RATE_LIMIT_ENABLED === 'true' ? {
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: Number(process.env.RATE_LIMIT_MAX) || 100
    } : undefined,
    authentication: {
      enabled: process.env.AUTH_ENABLED === 'true',
      apiKey: process.env.API_KEY,
      jwt: process.env.JWT_SECRET ? {
        secret: process.env.JWT_SECRET,
        algorithms: ['HS256']
      } : undefined
    }
  };
}