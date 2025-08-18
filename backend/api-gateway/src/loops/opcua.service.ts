import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

const OPCUA_API_BASE = process.env.OPCUA_API_BASE || 'http://localhost:3001';

export interface OPCUAConnection {
  id: string;
  endpointUrl: string;
  status: string;
  monitoredItemsCount: number;
  reconnectAttempts: number;
}

export interface MonitoredItemInfo {
  tag: string;
  nodeId: string;
  itemId: string;
}

@Injectable()
export class OpcuaService {
  private readonly logger = new Logger(OpcuaService.name);

  async getConnections(): Promise<OPCUAConnection[]> {
    try {
      const response = await axios.get(`${OPCUA_API_BASE}/connections`);
      return response.data.connections || [];
    } catch (error: any) {
      this.logger.error(`Failed to get OPC UA connections: ${error.message}`);
      throw new HttpException('Failed to connect to OPC UA service', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getActiveConnection(): Promise<OPCUAConnection | null> {
    const connections = await this.getConnections();
    return connections.find(conn => conn.status === 'connected') || null;
  }

  async createLoopMonitoring(loop: any, config: any): Promise<any> {
    const connection = await this.getActiveConnection();
    if (!connection) {
      throw new HttpException('No active OPC UA connection available', HttpStatus.SERVICE_UNAVAILABLE);
    }

    try {
      // Create monitored items for each tag
      const monitoredItems: MonitoredItemInfo[] = [];
      const samplingInterval = config.sampling_interval || 200;

      // Monitor PV tag
      if (loop.pvTag) {
        try {
          const pvItemId = await this.addMonitoredItem(connection.id, loop.pvTag, samplingInterval);
          monitoredItems.push({ tag: 'pv', nodeId: loop.pvTag, itemId: pvItemId });
        } catch (error) {
          this.logger.warn(`Failed to monitor PV tag ${loop.pvTag}: ${error.message}`);
        }
      }

      // Monitor OP tag
      if (loop.opTag) {
        try {
          const opItemId = await this.addMonitoredItem(connection.id, loop.opTag, samplingInterval);
          monitoredItems.push({ tag: 'op', nodeId: loop.opTag, itemId: opItemId });
        } catch (error) {
          this.logger.warn(`Failed to monitor OP tag ${loop.opTag}: ${error.message}`);
        }
      }

      // Monitor SP tag
      if (loop.spTag) {
        try {
          const spItemId = await this.addMonitoredItem(connection.id, loop.spTag, samplingInterval);
          monitoredItems.push({ tag: 'sp', nodeId: loop.spTag, itemId: spItemId });
        } catch (error) {
          this.logger.warn(`Failed to monitor SP tag ${loop.spTag}: ${error.message}`);
        }
      }

      // Monitor mode tag
      if (loop.modeTag) {
        try {
          const modeItemId = await this.addMonitoredItem(connection.id, loop.modeTag, samplingInterval);
          monitoredItems.push({ tag: 'mode', nodeId: loop.modeTag, itemId: modeItemId });
        } catch (error) {
          this.logger.warn(`Failed to monitor mode tag ${loop.modeTag}: ${error.message}`);
        }
      }

      // Monitor valve tag if provided
      if (loop.valveTag) {
        try {
          const valveItemId = await this.addMonitoredItem(connection.id, loop.valveTag, samplingInterval);
          monitoredItems.push({ tag: 'valve', nodeId: loop.valveTag, itemId: valveItemId });
        } catch (error) {
          this.logger.warn(`Failed to monitor valve tag ${loop.valveTag}: ${error.message}`);
        }
      }

      return {
        connectionId: connection.id,
        monitoredItems,
        samplingInterval
      };
    } catch (error: any) {
      this.logger.error(`Failed to create loop monitoring: ${error.message}`);
      throw new HttpException('Failed to setup OPC UA monitoring', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async removeLoopMonitoring(connectionId: string, monitoredItems: MonitoredItemInfo[]): Promise<void> {
    try {
      for (const item of monitoredItems) {
        try {
          await this.removeMonitoredItem(connectionId, item.nodeId);
        } catch (error) {
          this.logger.warn(`Failed to remove monitored item ${item.nodeId}: ${error.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to remove loop monitoring: ${error.message}`);
    }
  }

  async validateTag(nodeId: string): Promise<boolean> {
    const connection = await this.getActiveConnection();
    if (!connection) {
      return false;
    }

    try {
      await axios.get(`${OPCUA_API_BASE}/connections/${connection.id}/nodes/${encodeURIComponent(nodeId)}/read`);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async addMonitoredItem(connectionId: string, nodeId: string, samplingInterval: number): Promise<string> {
    const response = await axios.post(`${OPCUA_API_BASE}/connections/${connectionId}/monitor`, {
      nodeId,
      samplingInterval
    });
    return response.data.itemId;
  }

  private async removeMonitoredItem(connectionId: string, nodeId: string): Promise<void> {
    await axios.delete(`${OPCUA_API_BASE}/connections/${connectionId}/monitor/${encodeURIComponent(nodeId)}`);
  }

  async browseNodes(nodeId: string = 'RootFolder'): Promise<any[]> {
    const connection = await this.getActiveConnection();
    if (!connection) {
      throw new HttpException('No active OPC UA connection available', HttpStatus.SERVICE_UNAVAILABLE);
    }

    try {
      const response = await axios.get(`${OPCUA_API_BASE}/connections/${connection.id}/browse`, {
        params: { nodeId, maxResults: 1000 }
      });
      return response.data.results || [];
    } catch (error: any) {
      this.logger.error(`Failed to browse nodes: ${error.message}`);
      throw new HttpException('Failed to browse OPC UA nodes', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async searchNodes(searchTerm: string): Promise<any[]> {
    const connection = await this.getActiveConnection();
    if (!connection) {
      throw new HttpException('No active OPC UA connection available', HttpStatus.SERVICE_UNAVAILABLE);
    }

    try {
      const response = await axios.get(`${OPCUA_API_BASE}/connections/${connection.id}/search`, {
        params: { q: searchTerm, maxResults: 100 }
      });
      return response.data.results || [];
    } catch (error: any) {
      this.logger.error(`Failed to search nodes: ${error.message}`);
      throw new HttpException('Failed to search OPC UA nodes', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}