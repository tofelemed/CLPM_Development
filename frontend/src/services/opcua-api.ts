// OPC UA API Service Layer
import axios, { AxiosResponse } from 'axios';
import { 
  ServerConfig, 
  ConnectionStatus, 
  HealthStatus, 
  LoopSubscription, 
  BrowseNode, 
  SecurityOption,
  DataSample,
  ApiResponse,
  PaginatedResponse 
} from '../types/opcua';

// API Configuration
const OPCUA_API_BASE = import.meta.env.VITE_OPCUA_API_BASE || 'http://localhost:3002';

// Create axios instance with common configuration
const api = axios.create({
  baseURL: OPCUA_API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('OPC UA API Error:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('Request made but no response:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    throw error;
  }
);

export class OPCUAApiService {
  // Health and Status Endpoints
  static async getHealth(): Promise<HealthStatus> {
    const response = await api.get<HealthStatus>('/health/detailed');
    return response.data;
  }

  static async getHealthSummary(): Promise<{ status: string; connections: number; uptime: number }> {
    const response = await api.get('/health');
    return response.data;
  }

  static async getMetrics(): Promise<any> {
    const response = await api.get('/metrics');
    return response.data;
  }

  // Server Configuration Endpoints
  static async getServers(): Promise<ServerConfig[]> {
    const response = await api.get<ServerConfig[]>('/api/v1/servers');
    return response.data;
  }

  static async getServer(serverId: string): Promise<ServerConfig> {
    const response = await api.get<ServerConfig>(`/api/v1/servers/${serverId}`);
    return response.data;
  }

  static async createServer(serverConfig: Omit<ServerConfig, 'id'>): Promise<ServerConfig> {
    console.log('Creating server with config:', serverConfig);
    const response = await api.post<ServerConfig>('/api/v1/servers', serverConfig);
    console.log('Server created successfully:', response.data);
    return response.data;
  }

  static async updateServer(serverId: string, serverConfig: Partial<ServerConfig>): Promise<ServerConfig> {
    const response = await api.put<ServerConfig>(`/api/v1/servers/${serverId}`, serverConfig);
    return response.data;
  }

  static async deleteServer(serverId: string): Promise<void> {
    await api.delete(`/api/v1/servers/${serverId}`);
  }

  // Connection Status Endpoints
  static async getConnectionStatuses(): Promise<ConnectionStatus[]> {
    const response = await api.get<{connections: ConnectionStatus[]}>('/connections');
    return response.data.connections || [];
  }

  static async getConnectionStatus(serverId: string): Promise<ConnectionStatus> {
    const response = await api.get<ConnectionStatus>(`/connections/${serverId}`);
    return response.data;
  }

  static async connectToServer(serverId: string): Promise<void> {
    await api.post(`/connections/${serverId}/connect`);
  }

  static async disconnectFromServer(serverId: string): Promise<void> {
    await api.post(`/connections/${serverId}/disconnect`);
  }

  // Security and Discovery Endpoints
  static async getSecurityOptions(endpointUrl: string): Promise<SecurityOption[]> {
    const response = await api.get<SecurityOption[]>('/security-options', {
      params: { endpointUrl }
    });
    return response.data;
  }

  static async discoverEndpoints(discoveryUrl: string): Promise<string[]> {
    const response = await api.get<string[]>('/discover', {
      params: { url: discoveryUrl }
    });
    return response.data;
  }

  static async testConnection(serverConfig: Partial<ServerConfig>): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>('/api/v1/test-connection', serverConfig);
    return response.data;
  }

  // Tag Browsing Endpoints
  static async browseNodes(serverId: string, nodeId?: string): Promise<BrowseNode[]> {
    const params = nodeId ? { nodeId } : {};
    const response = await api.get<BrowseNode[]>(`/api/v1/browse/${serverId}`, { params });
    return response.data;
  }

  static async readNodeValue(serverId: string, nodeId: string): Promise<any> {
    const response = await api.post(`/api/v1/nodes/${serverId}/read`, {
      nodeIds: [nodeId]
    });
    return response.data[0]; // Return first result since we're reading single node
  }

  static async readMultipleNodes(serverId: string, nodeIds: string[]): Promise<any[]> {
    const response = await api.post(`/api/v1/nodes/${serverId}/read`, { nodeIds });
    return response.data;
  }

  // Loop Subscription Endpoints
  static async getLoopSubscriptions(): Promise<LoopSubscription[]> {
    const response = await api.get<LoopSubscription[]>('/api/v1/loops');
    return response.data;
  }

  static async getLoopSubscription(loopId: string): Promise<LoopSubscription> {
    const response = await api.get<LoopSubscription>(`/api/v1/loops/${loopId}`);
    return response.data;
  }

  static async createLoopSubscription(subscription: Omit<LoopSubscription, 'loopId'>): Promise<LoopSubscription> {
    const response = await api.post<LoopSubscription>('/api/v1/loops', subscription);
    return response.data;
  }

  static async updateLoopSubscription(loopId: string, subscription: Partial<LoopSubscription>): Promise<LoopSubscription> {
    const response = await api.put<LoopSubscription>(`/api/v1/loops/${loopId}`, subscription);
    return response.data;
  }

  static async deleteLoopSubscription(loopId: string): Promise<void> {
    await api.delete(`/api/v1/loops/${loopId}`);
  }

  // Data Endpoints
  static async getRealtimeData(serverId: string, nodeIds: string[]): Promise<DataSample[]> {
    const response = await api.post<DataSample[]>(`/api/v1/data/${serverId}/realtime`, { nodeIds });
    return response.data;
  }

  static async getHistoricalData(serverId: string, nodeId: string, startTime: Date, endTime: Date): Promise<DataSample[]> {
    const response = await api.get<DataSample[]>(`/api/v1/data/${serverId}/historical`, {
      params: {
        nodeId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      }
    });
    return response.data;
  }

  // Certificate Management
  static async getTrustedCertificates(): Promise<any[]> {
    const response = await api.get('/certificates/trusted');
    return response.data;
  }

  static async getRejectedCertificates(): Promise<any[]> {
    const response = await api.get('/certificates/rejected');
    return response.data;
  }

  static async trustCertificate(thumbprint: string): Promise<void> {
    await api.post(`/certificates/${thumbprint}/trust`);
  }

  static async rejectCertificate(thumbprint: string): Promise<void> {
    await api.post(`/certificates/${thumbprint}/reject`);
  }

  // Compatibility Layer (for existing frontend components)
  static async getConnections(): Promise<any[]> {
    const response = await api.get('/connections');
    return response.data;
  }

  static async createConnection(connectionData: any): Promise<any> {
    const response = await api.post('/connections', connectionData);
    return response.data;
  }

  static async updateConnection(connectionId: string, connectionData: any): Promise<any> {
    const response = await api.put(`/connections/${connectionId}`, connectionData);
    return response.data;
  }

  static async deleteConnection(connectionId: string): Promise<void> {
    await api.delete(`/connections/${connectionId}`);
  }
}

// Export default instance
export default OPCUAApiService;
