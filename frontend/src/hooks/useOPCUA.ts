// React hooks for OPC UA state management
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ServerConfig, 
  ConnectionStatus, 
  HealthStatus, 
  LoopSubscription,
  BrowseNode,
  SecurityOption,
  DataSample 
} from '../types/opcua';
import OPCUAApiService from '../services/opcua-api';

// Hook for managing server configurations
export const useOPCUAServers = () => {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await OPCUAApiService.getServers();
      setServers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load servers');
      setServers([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, []);

  const createServer = useCallback(async (serverConfig: Omit<ServerConfig, 'id'>) => {
    try {
      setError(null);
      const newServer = await OPCUAApiService.createServer(serverConfig);
      setServers(prev => [...prev, newServer]);
      return newServer;
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
      throw err;
    }
  }, []);

  const updateServer = useCallback(async (serverId: string, updates: Partial<ServerConfig>) => {
    try {
      setError(null);
      const updatedServer = await OPCUAApiService.updateServer(serverId, updates);
      setServers(prev => prev.map(s => s.id === serverId ? updatedServer : s));
      return updatedServer;
    } catch (err: any) {
      setError(err.message || 'Failed to update server');
      throw err;
    }
  }, []);

  const deleteServer = useCallback(async (serverId: string) => {
    try {
      setError(null);
      await OPCUAApiService.deleteServer(serverId);
      setServers(prev => prev.filter(s => s.id !== serverId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete server');
      throw err;
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  return {
    servers,
    loading,
    error,
    loadServers,
    createServer,
    updateServer,
    deleteServer
  };
};

// Hook for managing connection statuses with real-time updates
export const useOPCUAConnections = (refreshInterval = 5000) => {
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number>();

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await OPCUAApiService.getConnectionStatuses();
      setConnections(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load connections');
      setConnections([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, []);

  const connectServer = useCallback(async (serverId: string) => {
    try {
      setError(null);
      await OPCUAApiService.connectToServer(serverId);
      // Update connection status optimistically
      setConnections(prev => prev.map(c => 
        c.id === serverId 
          ? { ...c, status: 'connecting' as const }
          : c
      ));
      // Reload to get actual status
      setTimeout(loadConnections, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to connect server');
      throw err;
    }
  }, [loadConnections]);

  const disconnectServer = useCallback(async (serverId: string) => {
    try {
      setError(null);
      await OPCUAApiService.disconnectFromServer(serverId);
      // Update connection status optimistically
      setConnections(prev => prev.map(c => 
        c.id === serverId 
          ? { ...c, status: 'disconnected' as const }
          : c
      ));
      // Reload to get actual status
      setTimeout(loadConnections, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect server');
      throw err;
    }
  }, [loadConnections]);

  useEffect(() => {
    loadConnections();
    
    // Set up polling for real-time updates
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(loadConnections, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadConnections, refreshInterval]);

  return {
    connections,
    loading,
    error,
    loadConnections,
    connectServer,
    disconnectServer
  };
};

// Hook for OPC UA health monitoring
export const useOPCUAHealth = (refreshInterval = 10000) => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number>();

  const loadHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await OPCUAApiService.getHealth();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load health status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
    
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(loadHealth, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadHealth, refreshInterval]);

  return {
    health,
    loading,
    error,
    loadHealth
  };
};

// Hook for tag browsing
export const useOPCUABrowsing = (serverId?: string) => {
  const [nodes, setNodes] = useState<BrowseNode[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [breadcrumb, setBreadcrumb] = useState<{ nodeId: string; displayName: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());

  const browseNodes = useCallback(async (nodeId?: string) => {
    if (!serverId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await OPCUAApiService.browseNodes(serverId, nodeId);
      setNodes(data);
      setCurrentPath(nodeId || '');
    } catch (err: any) {
      setError(err.message || 'Failed to browse nodes');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const navigateToNode = useCallback(async (nodeId: string, displayName: string) => {
    await browseNodes(nodeId);
    setBreadcrumb(prev => [...prev, { nodeId, displayName }]);
  }, [browseNodes]);

  const navigateBack = useCallback(async (index: number) => {
    const targetNode = breadcrumb[index];
    if (targetNode) {
      await browseNodes(targetNode.nodeId);
      setBreadcrumb(prev => prev.slice(0, index + 1));
    } else {
      // Navigate to root
      await browseNodes();
      setBreadcrumb([]);
    }
  }, [breadcrumb, browseNodes]);

  const toggleNodeSelection = useCallback((nodeId: string) => {
    setSelectedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodes(new Set());
  }, []);

  const readNodeValue = useCallback(async (nodeId: string) => {
    if (!serverId) return null;
    
    try {
      return await OPCUAApiService.readNodeValue(serverId, nodeId);
    } catch (err: any) {
      console.error('Failed to read node value:', err);
      return null;
    }
  }, [serverId]);

  useEffect(() => {
    if (serverId) {
      browseNodes();
      setBreadcrumb([]);
    }
  }, [serverId, browseNodes]);

  return {
    nodes,
    currentPath,
    breadcrumb,
    loading,
    error,
    selectedNodes,
    browseNodes,
    navigateToNode,
    navigateBack,
    toggleNodeSelection,
    clearSelection,
    readNodeValue
  };
};

// Hook for security options discovery
export const useOPCUASecurity = () => {
  const [securityOptions, setSecurityOptions] = useState<SecurityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discoverSecurity = useCallback(async (endpointUrl: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await OPCUAApiService.getSecurityOptions(endpointUrl);
      setSecurityOptions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to discover security options');
      setSecurityOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const testConnection = useCallback(async (serverConfig: Partial<ServerConfig>) => {
    try {
      setError(null);
      return await OPCUAApiService.testConnection(serverConfig);
    } catch (err: any) {
      setError(err.message || 'Connection test failed');
      throw err;
    }
  }, []);

  return {
    securityOptions,
    loading,
    error,
    discoverSecurity,
    testConnection
  };
};

// Hook for loop subscriptions
export const useOPCUALoops = () => {
  const [loops, setLoops] = useState<LoopSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLoops = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await OPCUAApiService.getLoopSubscriptions();
      setLoops(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load loop subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  const createLoop = useCallback(async (loop: Omit<LoopSubscription, 'loopId'>) => {
    try {
      setError(null);
      const newLoop = await OPCUAApiService.createLoopSubscription(loop);
      setLoops(prev => [...prev, newLoop]);
      return newLoop;
    } catch (err: any) {
      setError(err.message || 'Failed to create loop subscription');
      throw err;
    }
  }, []);

  const updateLoop = useCallback(async (loopId: string, updates: Partial<LoopSubscription>) => {
    try {
      setError(null);
      const updatedLoop = await OPCUAApiService.updateLoopSubscription(loopId, updates);
      setLoops(prev => prev.map(l => l.loopId === loopId ? updatedLoop : l));
      return updatedLoop;
    } catch (err: any) {
      setError(err.message || 'Failed to update loop subscription');
      throw err;
    }
  }, []);

  const deleteLoop = useCallback(async (loopId: string) => {
    try {
      setError(null);
      await OPCUAApiService.deleteLoopSubscription(loopId);
      setLoops(prev => prev.filter(l => l.loopId !== loopId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete loop subscription');
      throw err;
    }
  }, []);

  useEffect(() => {
    loadLoops();
  }, [loadLoops]);

  return {
    loops,
    loading,
    error,
    loadLoops,
    createLoop,
    updateLoop,
    deleteLoop
  };
};
