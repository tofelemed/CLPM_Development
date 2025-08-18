import { Controller, All, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import axios from 'axios';

@Controller('opcua-direct')
export class OpcuaProxyController {
  private readonly logger = new Logger(OpcuaProxyController.name);
  private readonly opcuaApiBase = process.env.OPCUA_API_BASE || 'http://localhost:4840';

  @All('*')
  async proxyToOpcuaService(@Req() req: Request, @Res() res: Response) {
    try {
      // Extract the path after /api/v1/opcua-direct
      const originalPath = req.originalUrl || req.url;
      const opcuaPath = originalPath.replace(/^\/api\/v1\/opcua-direct/, '') || '/';
      const targetUrl = `${this.opcuaApiBase}${opcuaPath}`;
      
      this.logger.debug(`Proxying ${req.method} ${originalPath} to ${targetUrl}`);
      
      const axiosConfig = {
        method: req.method.toLowerCase() as any,
        url: targetUrl,
        headers: {
          ...req.headers,
          host: undefined, // Remove host header to avoid conflicts
        },
        data: req.body,
        params: req.query,
        timeout: 30000,
      };

      const response = await axios(axiosConfig);
      
      // Forward response headers
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });
      
      res.status(response.status).send(response.data);
    } catch (error: any) {
      this.logger.error(`Proxy error: ${error.message}`, error.stack);
      
      if (error.response) {
        // Forward error response from OPC UA service
        res.status(error.response.status).json(error.response.data);
      } else {
        // Network or other error
        res.status(503).json({
          error: 'Service unavailable',
          message: 'Unable to connect to OPC UA service'
        });
      }
    }
  }
}
