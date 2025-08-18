import React, { useState } from 'react';
import { 
  Plus, 
  Settings, 
  Trash2, 
  Play, 
  Square, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHeaderCell } from '../ui/table';
import { Dialog } from '../ui/dialog';
import { useOPCUAServers, useOPCUAConnections } from '../../hooks/useOPCUA';
import { ServerConfig, ConnectionStatus } from '../../types/opcua';
import { ServerForm } from './ServerForm';

interface ConnectionError {
  serverId: string;
  serverName: string;
  error: string;
  timestamp: Date;
}

export const ServerManager: React.FC = () => {
  const { servers, loading: serversLoading, error: serversError, createServer, updateServer, deleteServer } = useOPCUAServers();
  const { connections, loading: connectionsLoading, error: connectionsError, connectServer, disconnectServer } = useOPCUAConnections();
  
  const [showServerForm, setShowServerForm] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerConfig | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [connectionErrors, setConnectionErrors] = useState<ConnectionError[]>([]);

  // Merge server configs with connection status
  const serversWithStatus = servers.map(server => {
    const connectionStatus = connections.find(c => c.id === server.id);
    return { ...server, connectionStatus };
  });

  const handleCreateServer = async (serverData: Omit<ServerConfig, 'id'> | Partial<ServerConfig>) => {
    try {
      // Ensure all required fields are present for creation
      if ('name' in serverData && 'endpointUrl' in serverData) {
        await createServer(serverData as Omit<ServerConfig, 'id'>);
        setShowServerForm(false);
      }
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleUpdateServer = async (serverId: string, serverData: Partial<ServerConfig>) => {
    try {
      await updateServer(serverId, serverData);
      setEditingServer(null);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await deleteServer(serverId);
      setDeletingServerId(null);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleToggleConnection = async (server: ServerConfig & { connectionStatus?: ConnectionStatus }) => {
    try {
      // Clear any existing error for this server
      setConnectionErrors(prev => prev.filter(err => err.serverId !== server.id));
      
      if (server.connectionStatus?.status === 'connected') {
        await disconnectServer(server.id);
      } else {
        await connectServer(server.id);
      }
    } catch (error: any) {
      // Create descriptive error message
      let errorMessage = 'Connection failed';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status) {
        switch (error.response.status) {
          case 400:
            errorMessage = 'Invalid server configuration';
            break;
          case 401:
            errorMessage = 'Authentication failed - check credentials';
            break;
          case 403:
            errorMessage = 'Access denied - insufficient permissions';
            break;
          case 404:
            errorMessage = 'Server not found or endpoint unavailable';
            break;
          case 408:
            errorMessage = 'Connection timeout - server not responding';
            break;
          case 500:
            errorMessage = 'Server internal error';
            break;
          case 502:
            errorMessage = 'Bad gateway - proxy server error';
            break;
          case 503:
            errorMessage = 'Service unavailable - server is down';
            break;
          case 504:
            errorMessage = 'Gateway timeout - server took too long to respond';
            break;
          default:
            errorMessage = `Connection failed (${error.response.status})`;
        }
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - server is not running or port is blocked';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Server not found - check the endpoint URL';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Connection timeout - server is not responding';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Add error to the list
      const connectionError: ConnectionError = {
        serverId: server.id,
        serverName: server.name,
        error: errorMessage,
        timestamp: new Date()
      };
      
      setConnectionErrors(prev => [connectionError, ...prev.slice(0, 4)]); // Keep only last 5 errors
    }
  };

  const clearConnectionError = (serverId: string) => {
    setConnectionErrors(prev => prev.filter(err => err.serverId !== serverId));
  };

  const getStatusBadge = (status?: ConnectionStatus['status']) => {
    switch (status) {
      case 'connected':
        return <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Connected</Badge>;
      case 'connecting':
        return <Badge variant="warning" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Connecting</Badge>;
      case 'reconnecting':
        return <Badge variant="warning" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Reconnecting</Badge>;
      case 'error':
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Error</Badge>;
      case 'disconnected':
      default:
        return <Badge variant="secondary" className="flex items-center gap-1"><WifiOff className="w-3 h-3" /> Disconnected</Badge>;
    }
  };

  const getConnectionIcon = (status?: ConnectionStatus['status']) => {
    switch (status) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'connecting':
      case 'reconnecting':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  if (serversLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Server Management</h2>
          <p className="text-gray-600 mt-1">Manage OPC UA server connections and configurations</p>
        </div>
        <Button onClick={() => setShowServerForm(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Server
        </Button>
      </div>

      {/* Error Display */}
      {serversError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{serversError}</span>
          </div>
        </div>
      )}

      {/* Connection Errors Display */}
      {connectionErrors.length > 0 && (
        <div className="space-y-2">
          {connectionErrors.map((error) => (
            <div key={`${error.serverId}-${error.timestamp.getTime()}`} className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-red-800">
                        Connection Error: {error.serverName}
                      </span>
                      <span className="text-xs text-red-600">
                        {error.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-red-700">{error.error}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => clearConnectionError(error.serverId)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* General Connection Error */}
      {connectionsError && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Connection Status Error: {connectionsError}</span>
          </div>
        </div>
      )}

      {/* Servers Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Server Configurations
          </h3>
        </div>
        <div className="p-6">
          {serversWithStatus.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No servers configured</h3>
              <p className="text-gray-600 mb-4">Get started by adding your first OPC UA server</p>
              <Button onClick={() => setShowServerForm(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Server
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Endpoint URL</TableHeaderCell>
                  <TableHeaderCell>Security</TableHeaderCell>
                  <TableHeaderCell>Sessions</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serversWithStatus.map((server) => {
                  const hasError = connectionErrors.some(err => err.serverId === server.id);
                  return (
                    <TableRow key={server.id} className={hasError ? 'bg-red-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getConnectionIcon(server.connectionStatus?.status)}
                          {getStatusBadge(server.connectionStatus?.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{server.name}</div>
                          <div className="text-sm text-gray-500">ID: {server.id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">{server.endpointUrl}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            Mode: <span className="font-medium">{server.securityMode}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Policy: {server.securityPolicy.split('#')[1] || 'None'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-center">
                          <div className="text-lg font-semibold">
                            1
                          </div>
                          <div className="text-xs text-gray-500">
                            {server.connectionStatus?.monitoredItemsCount || 0} items
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={server.connectionStatus?.status === 'connected' ? 'destructive' : 'default'}
                            onClick={() => handleToggleConnection(server)}
                            disabled={connectionsLoading || ['connecting', 'reconnecting'].includes(server.connectionStatus?.status || '')}
                            className="flex items-center gap-1"
                          >
                            {server.connectionStatus?.status === 'connected' ? (
                              <>
                                <Square className="w-3 h-3" />
                                Disconnect
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                Connect
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingServer(server)}
                          >
                            <Settings className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeletingServerId(server.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Server Form Dialog */}
      <Dialog
        open={showServerForm || !!editingServer}
        onClose={() => {
          setShowServerForm(false);
          setEditingServer(null);
        }}
        title={editingServer ? 'Edit Server' : 'Add Server'}
        maxWidth="lg"
      >
        <ServerForm
          server={editingServer}
          onSubmit={editingServer  
            ? (data) => handleUpdateServer(editingServer.id, data)
            : handleCreateServer
          }
          onCancel={() => {
            setShowServerForm(false);
            setEditingServer(null);
          }}
        />
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingServerId}
        onClose={() => setDeletingServerId(null)}
        title="Delete Server"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete this server configuration? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingServerId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deletingServerId && handleDeleteServer(deletingServerId)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
