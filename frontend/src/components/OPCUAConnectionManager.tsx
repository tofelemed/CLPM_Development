import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Settings, 
  TestTube, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Shield,
  Network,
  Database
} from 'lucide-react';

interface OPCUAConnection {
  id: string;
  name: string;
  endpointUrl: string;
  username?: string;
  password?: string;
  securityMode: string;
  securityPolicy: string;
  requestedSessionTimeout: number;
  requestedPublishingInterval: number;
  requestedLifetimeCount: number;
  requestedMaxKeepAliveCount: number;
  maxNotificationsPerPublish: number;
  priority: number;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastConnected?: string;
  errorMessage?: string;
  certificatePath?: string;
  privateKeyPath?: string;
  trustListPath?: string;
  revocationListPath?: string;
}

interface OPCUAConnectionManagerProps {
  open: boolean;
  onClose: () => void;
}

const OPCUAConnectionManager: React.FC<OPCUAConnectionManagerProps> = ({ open, onClose }) => {
  const [connections, setConnections] = useState<OPCUAConnection[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<OPCUAConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<{[key: string]: any}>({});

  // Form state for new/edit connection
  const [formData, setFormData] = useState({
    name: '',
    endpointUrl: '',
    username: '',
    password: '',
    securityMode: 'SignAndEncrypt',
    securityPolicy: 'Basic256Sha256',
    requestedSessionTimeout: 60000,
    requestedPublishingInterval: 1000,
    requestedLifetimeCount: 100,
    requestedMaxKeepAliveCount: 10,
    maxNotificationsPerPublish: 1000,
    priority: 10,
    certificatePath: '',
    privateKeyPath: '',
    trustListPath: '',
    revocationListPath: ''
  });

  useEffect(() => {
    if (open) {
      loadConnections();
    }
  }, [open]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/opcua/connections', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const url = editingConnection 
        ? `/api/opcua/connections/${editingConnection.id}`
        : '/api/opcua/connections';
      
      const method = editingConnection ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setShowAddForm(false);
        setEditingConnection(null);
        resetForm();
        await loadConnections();
      } else {
        const error = await response.json();
        alert(`Failed to save connection: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to save connection:', error);
      alert('Failed to save connection');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/opcua/connections/${connectionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await loadConnections();
      } else {
        const error = await response.json();
        alert(`Failed to delete connection: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to delete connection:', error);
      alert('Failed to delete connection');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (connectionId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/opcua/connections/${connectionId}/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await loadConnections();
      } else {
        const error = await response.json();
        alert(`Failed to connect: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/opcua/connections/${connectionId}/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await loadConnections();
      } else {
        const error = await response.json();
        alert(`Failed to disconnect: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
      alert('Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (connectionId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/opcua/connections/${connectionId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setTestResults(prev => ({ ...prev, [connectionId]: result }));
      } else {
        const error = await response.json();
        setTestResults(prev => ({ 
          ...prev, 
          [connectionId]: { success: false, error: error.message } 
        }));
      }
    } catch (error) {
      console.error('Failed to test connection:', error);
      setTestResults(prev => ({ 
        ...prev, 
        [connectionId]: { success: false, error: 'Network error' } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (connection: OPCUAConnection) => {
    setEditingConnection(connection);
    setFormData({
      name: connection.name,
      endpointUrl: connection.endpointUrl,
      username: connection.username || '',
      password: connection.password || '',
      securityMode: connection.securityMode,
      securityPolicy: connection.securityPolicy,
      requestedSessionTimeout: connection.requestedSessionTimeout,
      requestedPublishingInterval: connection.requestedPublishingInterval,
      requestedLifetimeCount: connection.requestedLifetimeCount,
      requestedMaxKeepAliveCount: connection.requestedMaxKeepAliveCount,
      maxNotificationsPerPublish: connection.maxNotificationsPerPublish,
      priority: connection.priority,
      certificatePath: connection.certificatePath || '',
      privateKeyPath: connection.privateKeyPath || '',
      trustListPath: connection.trustListPath || '',
      revocationListPath: connection.revocationListPath || ''
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      endpointUrl: '',
      username: '',
      password: '',
      securityMode: 'SignAndEncrypt',
      securityPolicy: 'Basic256Sha256',
      requestedSessionTimeout: 60000,
      requestedPublishingInterval: 1000,
      requestedLifetimeCount: 100,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 1000,
      priority: 10,
      certificatePath: '',
      privateKeyPath: '',
      trustListPath: '',
      revocationListPath: ''
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'connecting':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <X className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                OPC UA Connection Manager
              </h3>
              <button
                onClick={onClose}
                className="rounded-md text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Connection List */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-900">Connections</h4>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Connection
                </button>
              </div>

              {loading ? (
                <div className="text-center py-4">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                  <p className="text-gray-500 mt-2">Loading connections...</p>
                </div>
              ) : connections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Network className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No OPC UA connections configured</p>
                  <p className="text-sm">Click "Add Connection" to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {connections.map((connection) => (
                    <div key={connection.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h5 className="text-sm font-medium text-gray-900">{connection.name}</h5>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(connection.status)}`}>
                              {getStatusIcon(connection.status)}
                              <span className="ml-1 capitalize">{connection.status}</span>
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 font-mono">{connection.endpointUrl}</p>
                          {connection.errorMessage && (
                            <p className="text-sm text-red-600 mt-1">{connection.errorMessage}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleTest(connection.id)}
                            className="p-2 text-gray-400 hover:text-blue-600"
                            title="Test Connection"
                          >
                            <TestTube className="h-4 w-4" />
                          </button>
                          
                          {connection.status === 'connected' ? (
                            <button
                              onClick={() => handleDisconnect(connection.id)}
                              className="p-2 text-gray-400 hover:text-red-600"
                              title="Disconnect"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleConnect(connection.id)}
                              className="p-2 text-gray-400 hover:text-green-600"
                              title="Connect"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleEdit(connection)}
                            className="p-2 text-gray-400 hover:text-blue-600"
                            title="Edit"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDelete(connection.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Test Results */}
                      {testResults[connection.id] && (
                        <div className={`mt-3 p-3 rounded-md ${
                          testResults[connection.id].success 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-red-50 border border-red-200'
                        }`}>
                          <div className="flex items-center space-x-2">
                            {testResults[connection.id].success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium">
                              {testResults[connection.id].success ? 'Connection Test Successful' : 'Connection Test Failed'}
                            </span>
                          </div>
                          {testResults[connection.id].details && (
                            <div className="mt-2 text-sm text-gray-600">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(testResults[connection.id].details, null, 2)}</pre>
                            </div>
                          )}
                          {testResults[connection.id].error && (
                            <p className="mt-2 text-sm text-red-600">{testResults[connection.id].error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
              <div className="border-t pt-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">
                  {editingConnection ? 'Edit Connection' : 'Add New Connection'}
                </h4>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Connection Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Endpoint URL</label>
                      <input
                        type="text"
                        value={formData.endpointUrl}
                        onChange={(e) => setFormData({...formData, endpointUrl: e.target.value})}
                        placeholder="opc.tcp://localhost:4840"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Username</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Security Mode</label>
                      <select
                        value={formData.securityMode}
                        onChange={(e) => setFormData({...formData, securityMode: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="None">None</option>
                        <option value="Sign">Sign</option>
                        <option value="SignAndEncrypt">Sign and Encrypt</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Security Policy</label>
                      <select
                        value={formData.securityPolicy}
                        onChange={(e) => setFormData({...formData, securityPolicy: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="None">None</option>
                        <option value="Basic128Rsa15">Basic128Rsa15</option>
                        <option value="Basic256">Basic256</option>
                        <option value="Basic256Sha256">Basic256Sha256</option>
                        <option value="Aes128Sha256RsaOaep">Aes128Sha256RsaOaep</option>
                        <option value="Aes256Sha256RsaPss">Aes256Sha256RsaPss</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Session Timeout (ms)</label>
                      <input
                        type="number"
                        value={formData.requestedSessionTimeout}
                        onChange={(e) => setFormData({...formData, requestedSessionTimeout: parseInt(e.target.value)})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Publishing Interval (ms)</label>
                      <input
                        type="number"
                        value={formData.requestedPublishingInterval}
                        onChange={(e) => setFormData({...formData, requestedPublishingInterval: parseInt(e.target.value)})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Priority</label>
                      <input
                        type="number"
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Certificate Settings */}
                  <div className="border-t pt-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      Certificate Settings
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Client Certificate Path</label>
                        <input
                          type="text"
                          value={formData.certificatePath}
                          onChange={(e) => setFormData({...formData, certificatePath: e.target.value})}
                          placeholder="/path/to/client-cert.pem"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Private Key Path</label>
                        <input
                          type="text"
                          value={formData.privateKeyPath}
                          onChange={(e) => setFormData({...formData, privateKeyPath: e.target.value})}
                          placeholder="/path/to/client-key.pem"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingConnection(null);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {loading ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {editingConnection ? 'Update' : 'Create'} Connection
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OPCUAConnectionManager;
