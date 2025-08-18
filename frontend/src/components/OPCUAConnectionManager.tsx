import React, { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Badge,
  Avatar
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Science as TestIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  Router as NetworkIcon,
  Storage as DatabaseIcon,
  CloudUpload as UploadIcon,
  CloudDownload as DownloadIcon,
  VpnKey as KeyIcon,
  ExpandMore as ExpandMoreIcon,
  PowerSettingsNew as ConnectIcon,
  PowerOff as DisconnectIcon
} from '@mui/icons-material';
import axios from 'axios';

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
  applicationUri?: string;
  clientCertificate?: string;
  clientPrivateKey?: string;
  serverCertificate?: string;
  discoveryServerUrl?: string;
  autoAcceptUntrustedCertificates?: boolean;
  monitoredItemsCount?: number;
  reconnectAttempts?: number;
}

interface SecurityOptions {
  securityPolicies: Array<{ name: string; value: string }>;
  securityModes: Array<{ name: string; value: string }>;
}

interface EndpointInfo {
  endpointUrl: string;
  securityMode: string;
  securityPolicy: string;
  securityLevel: number;
  transportProfileUri: string;
  userTokenPolicies: Array<{
    policyId: string;
    tokenType: string;
    issuedTokenType?: string;
    securityPolicyUri?: string;
  }>;
}

interface OPCUAConnectionManagerProps {
  open: boolean;
  onClose: () => void;
}

// Use Vite proxy in dev to avoid CORS. opcua-client listens on 3002 by default
const OPCUA_API_BASE = (import.meta as any).env.VITE_OPCUA_API_BASE || '/opcua2';

const OPCUAConnectionManager: React.FC<OPCUAConnectionManagerProps> = ({ open, onClose }) => {
  const [connections, setConnections] = useState<OPCUAConnection[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<OPCUAConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<{[key: string]: any}>({});
  const [securityOptions, setSecurityOptions] = useState<SecurityOptions | null>(null);
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState<EndpointInfo[]>([]);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveryUrl, setDiscoveryUrl] = useState('');
  const [showCertificateManager, setShowCertificateManager] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showError, setShowError] = useState(false);

  // Form state for new/edit connection
  const [formData, setFormData] = useState({
    name: '',
    endpointUrl: '',
    username: '',
    password: '',
    securityMode: 'None',
    securityPolicy: 'None',
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
      loadSecurityOptions();
    }
  }, [open]);

  const handleError = (operation: string, error: any, context?: string, connectionData?: any) => {
    console.error(`Failed to ${operation}:`, error);
    
    let errorDetails = '';
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = error.response.data?.error || error.response.data?.message || error.response.statusText;
      errorDetails = `Server Error (${status}): ${message}`;
      
      if (context) {
        errorDetails += `\nContext: ${context}`;
      }
      
      // Add specific guidance based on error type
      if (status === 404) {
        errorDetails += '\nSuggestion: Check if the OPC UA server is running and the endpoint URL is correct.';
      } else if (status === 401 || status === 403) {
        errorDetails += '\nSuggestion: Verify your credentials and security settings.';
        
        // Add security-specific guidance
        if (connectionData) {
          errorDetails += '\n\nSecurity Configuration Analysis:';
          const { securityMode, securityPolicy, certificatePath, privateKeyPath } = connectionData;
          
          if (securityMode === 'None' && securityPolicy === 'None') {
            errorDetails += '\n• Using no security - this should work with most servers';
            errorDetails += '\n• If authentication fails, check if the server requires user credentials';
          } else if (securityMode === 'Sign' || securityMode === 'SignAndEncrypt') {
            errorDetails += `\n• Security Mode: ${securityMode} requires certificates`;
            
            if (!certificatePath) {
              errorDetails += '\n❌ Missing client certificate - required for this security mode';
              errorDetails += '\n💡 Solution: Upload a client certificate (.pem, .crt, .cer, .der)';
            }
            
            if (!privateKeyPath) {
              errorDetails += '\n❌ Missing private key - required for this security mode';
              errorDetails += '\n💡 Solution: Upload a private key (.key, .pem)';
            }
            
            if (securityPolicy !== 'None') {
              errorDetails += `\n• Security Policy: ${securityPolicy}`;
              errorDetails += '\n💡 Try using "None" security policy if server supports it';
            }
          }
          
          errorDetails += '\n\nRecommended Actions:';
          errorDetails += '\n1. Try "None/None" security for initial testing';
          errorDetails += '\n2. Check server documentation for required security settings';
          errorDetails += '\n3. Verify certificates are valid and trusted by the server';
        }
      } else if (status === 500) {
        errorDetails += '\nSuggestion: Check server logs for detailed error information.';
      } else if (status >= 500) {
        errorDetails += '\nSuggestion: The OPC UA server may be experiencing issues. Try again later.';
      }
    } else if (error.request) {
      // Network error
      errorDetails = 'Network Error: Cannot reach the OPC UA server.';
      if (context) {
        errorDetails += `\nOperation: ${operation}`;
        errorDetails += `\nContext: ${context}`;
      }
      errorDetails += '\nSuggestion: Check your network connection and verify the server is running.';
    } else {
      // Other error
      errorDetails = `Error: ${error.message || 'Unknown error occurred'}`;
      if (context) {
        errorDetails += `\nContext: ${context}`;
      }
      
      // Check for certificate-related errors in the message
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('certificate') || errorMsg.includes('cert') || errorMsg.includes('ssl') || errorMsg.includes('tls')) {
        errorDetails += '\n\nCertificate Issue Detected:';
        if (connectionData) {
          const { securityMode, certificatePath, privateKeyPath } = connectionData;
          if (securityMode !== 'None') {
            if (!certificatePath) {
              errorDetails += '\n❌ Client certificate missing but required for security mode: ' + securityMode;
            }
            if (!privateKeyPath) {
              errorDetails += '\n❌ Private key missing but required for security mode: ' + securityMode;
            }
          }
        }
        errorDetails += '\n💡 Try using "None/None" security mode if server supports it';
      }
    }
    
    setErrorMessage(`Failed to ${operation}.\n\n${errorDetails}`);
    setShowError(true);
  };

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${OPCUA_API_BASE}/connections`);
      setConnections(response.data.connections || []);
    } catch (error) {
      handleError('load connections', error, `Attempting to fetch connections from ${OPCUA_API_BASE}/connections`);
    } finally {
      setLoading(false);
    }
  };

  const loadSecurityOptions = async () => {
    try {
      const response = await axios.get(`${OPCUA_API_BASE}/security-options`);
      setSecurityOptions(response.data);
    } catch (error) {
      handleError('load security options', error, `Attempting to fetch security options from ${OPCUA_API_BASE}/security-options`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Validate required fields
      if (!formData.name.trim()) {
        throw new Error('Connection name is required');
      }
      if (!formData.endpointUrl.trim()) {
        throw new Error('Endpoint URL is required');
      }
      
      // Validate endpoint URL format
      if (!formData.endpointUrl.startsWith('opc.tcp://')) {
        throw new Error('Endpoint URL must start with "opc.tcp://"');
      }
      
      const connectionData = {
        name: formData.name,
        endpointUrl: formData.endpointUrl,
        username: formData.username || undefined,
        password: formData.password || undefined,
        securityMode: formData.securityMode,
        securityPolicy: formData.securityPolicy,
        requestedSessionTimeout: formData.requestedSessionTimeout,
        requestedPublishingInterval: formData.requestedPublishingInterval,
        requestedLifetimeCount: formData.requestedLifetimeCount,
        requestedMaxKeepAliveCount: formData.requestedMaxKeepAliveCount,
        maxNotificationsPerPublish: formData.maxNotificationsPerPublish,
        priority: formData.priority,
        certificatePath: formData.certificatePath || undefined,
        privateKeyPath: formData.privateKeyPath || undefined,
        trustListPath: formData.trustListPath || undefined,
        revocationListPath: formData.revocationListPath || undefined
      };
      
      const operation = editingConnection ? 'update' : 'create';
      const context = `${operation} connection "${formData.name}" with endpoint "${formData.endpointUrl}"`;
      
      if (editingConnection) {
        await axios.put(`${OPCUA_API_BASE}/connections/${editingConnection.id}`, connectionData);
      } else {
        await axios.post(`${OPCUA_API_BASE}/connections`, connectionData);
      }
      
        setShowAddForm(false);
        setEditingConnection(null);
        resetForm();
        await loadConnections();
    } catch (error: any) {
      const operation = editingConnection ? 'update connection' : 'create connection';
      const context = `Connection: "${formData.name}", Endpoint: "${formData.endpointUrl}", Security: ${formData.securityMode}/${formData.securityPolicy}`;
      handleError(operation, error, context, formData);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!confirm(`Are you sure you want to delete the connection "${connection?.name || connectionId}"?`)) return;
    
    try {
      setLoading(true);
      await axios.delete(`${OPCUA_API_BASE}/connections/${connectionId}`);
        await loadConnections();
    } catch (error: any) {
      const context = `Connection ID: ${connectionId}, Name: "${connection?.name || 'Unknown'}"`;
      handleError('delete connection', error, context);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    try {
      setLoading(true);
      await axios.post(`${OPCUA_API_BASE}/connections/${connectionId}/connect`);
        await loadConnections();
    } catch (error: any) {
      const context = `Connection: "${connection?.name || 'Unknown'}", Endpoint: "${connection?.endpointUrl || 'Unknown'}", Security: ${connection?.securityMode}/${connection?.securityPolicy}`;
      handleError('connect to OPC UA server', error, context, connection);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    try {
      setLoading(true);
      await axios.post(`${OPCUA_API_BASE}/connections/${connectionId}/disconnect`);
      await loadConnections();
    } catch (error: any) {
      const context = `Connection: "${connection?.name || 'Unknown'}", Endpoint: "${connection?.endpointUrl || 'Unknown'}"`;
      handleError('disconnect from OPC UA server', error, context);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    try {
      setLoading(true);
      const response = await axios.post(`${OPCUA_API_BASE}/connections/${connectionId}/test`);
      setTestResults(prev => ({ ...prev, [connectionId]: response.data }));
    } catch (error: any) {
      console.error('Failed to test connection:', error);
      const context = `Connection: "${connection?.name || 'Unknown'}", Endpoint: "${connection?.endpointUrl || 'Unknown'}", Security: ${connection?.securityMode}/${connection?.securityPolicy}`;
      let errorMessage = '';
      
      if (error.response) {
        errorMessage = error.response.data?.error || error.response.data?.message || error.response.statusText;
        if (error.response.status === 404) {
          errorMessage += ' - The OPC UA server endpoint was not found.';
        } else if (error.response.status === 401) {
          errorMessage += ' - Authentication failed. Check your credentials.';
        } else if (error.response.status === 500) {
          errorMessage += ' - Internal server error during connection test.';
        }
      } else if (error.request) {
        errorMessage = 'Network error: Cannot reach the OPC UA server.';
      } else {
        errorMessage = error.message || 'Unknown error occurred during connection test.';
      }
      
      setTestResults(prev => ({ 
        ...prev, 
        [connectionId]: { 
          success: false, 
          error: errorMessage,
          context: context
        } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverEndpoints = async () => {
    if (!discoveryUrl) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`${OPCUA_API_BASE}/discover`, {
        params: { endpointUrl: discoveryUrl }
      });
      setDiscoveredEndpoints(response.data.endpoints || []);
      setShowDiscovery(true);
    } catch (error: any) {
      const context = `Discovery URL: "${discoveryUrl}"`;
      handleError('discover OPC UA endpoints', error, context);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEndpoint = (endpoint: EndpointInfo) => {
    setFormData(prev => ({
          ...prev, 
      endpointUrl: endpoint.endpointUrl,
      securityMode: endpoint.securityMode,
      securityPolicy: endpoint.securityPolicy
    }));
    setShowDiscovery(false);
    setShowAddForm(true);
  };

  const handleCertificateUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'client' | 'private' | 'trust' | 'revocation') => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingCertificate(true);
      
      // Validate file type
      const validExtensions = {
        client: ['.pem', '.crt', '.cer', '.der'],
        private: ['.pem', '.key', '.der'],
        trust: ['.pem', '.crt', '.der'],
        revocation: ['.crl']
      };
      
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!validExtensions[type].includes(fileExtension)) {
        throw new Error(`Invalid file type for ${type} certificate. Expected: ${validExtensions[type].join(', ')}`);
      }
      
      const uploadFormData = new FormData();
      uploadFormData.append('certificate', file);
      uploadFormData.append('type', type);

      const response = await axios.post(`${OPCUA_API_BASE}/certificates/upload`, uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const filePath = response.data.filePath;
      
      setFormData(prev => ({
        ...prev, 
        [`${type === 'client' ? 'certificate' : type === 'private' ? 'privateKey' : type === 'trust' ? 'trustList' : 'revocationList'}Path`]: filePath
      }));

      alert('Certificate uploaded successfully');
    } catch (error: any) {
      const context = `File: "${file.name}", Type: ${type}, Size: ${(file.size / 1024).toFixed(2)}KB`;
      handleError('upload certificate', error, context);
    } finally {
      setUploadingCertificate(false);
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
        return <CheckCircleIcon color="success" />;
      case 'connecting':
        return <ScheduleIcon color="warning" />;
      case 'error':
        return <WarningIcon color="error" />;
      default:
        return <CloseIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  if (!open) return null;

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <NetworkIcon />
            </Avatar>
            <Typography variant="h5" component="div">
              OPC UA Connection Manager
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="large">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>

        <Box sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
            <Typography variant="h6" component="h2" color="text.primary">
              Active Connections
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
                  onClick={() => setShowAddForm(true)}
              size="large"
                >
                  Add Connection
            </Button>
          </Box>

              {loading ? (
            <Card>
              <CardContent>
                <Box display="flex" flexDirection="column" alignItems="center" py={4}>
                  <CircularProgress size={40} sx={{ mb: 2 }} />
                  <Typography color="text.secondary">Loading connections...</Typography>
                </Box>
              </CardContent>
            </Card>
              ) : connections.length === 0 ? (
            <Card>
              <CardContent>
                <Box display="flex" flexDirection="column" alignItems="center" py={6}>
                  <NetworkIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No OPC UA connections configured
                  </Typography>
                  <Typography color="text.secondary">
                    Click "Add Connection" to get started
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={2}>
                  {connections.map((connection) => (
                <Grid item xs={12} key={connection.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box flex={1}>
                          <Box display="flex" alignItems="center" gap={2} mb={1}>
                            <Typography variant="h6" component="h3">
                              {connection.name}
                            </Typography>
                            <Chip
                              icon={getStatusIcon(connection.status)}
                              label={connection.status}
                              color={getStatusColor(connection.status)}
                              size="small"
                              variant="outlined"
                            />
                            {connection.monitoredItemsCount !== undefined && (
                              <Badge badgeContent={connection.monitoredItemsCount} color="primary">
                                <Typography variant="caption" color="text.secondary">
                                  monitored items
                                </Typography>
                              </Badge>
                            )}
                          </Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontFamily: 'monospace', mb: 1 }}
                          >
                            {connection.endpointUrl}
                          </Typography>
                          {connection.errorMessage && (
                            <Alert severity="error" sx={{ mt: 1 }}>
                              {connection.errorMessage}
                            </Alert>
                          )}
                        </Box>
                        
                        <Box display="flex" gap={1}>
                          <Tooltip title="Test Connection">
                            <IconButton
                            onClick={() => handleTest(connection.id)}
                              disabled={loading}
                          >
                              <TestIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {connection.status === 'connected' ? (
                            <Tooltip title="Disconnect">
                              <IconButton
                              onClick={() => handleDisconnect(connection.id)}
                                disabled={loading}
                                color="error"
                            >
                                <DisconnectIcon />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Connect">
                              <IconButton
                              onClick={() => handleConnect(connection.id)}
                                disabled={loading}
                                color="success"
                            >
                                <ConnectIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="Edit">
                            <IconButton
                            onClick={() => handleEdit(connection)}
                              disabled={loading}
                          >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Delete">
                            <IconButton
                            onClick={() => handleDelete(connection.id)}
                              disabled={loading}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                      
                      {/* Test Results */}
                      {testResults[connection.id] && (
                        <Box mt={2}>
                          <Alert
                            severity={testResults[connection.id].success ? 'success' : 'error'}
                            icon={testResults[connection.id].success ? <CheckCircleIcon /> : <WarningIcon />}
                          >
                            <Typography variant="subtitle2">
                              {testResults[connection.id].success ? 'Connection Test Successful' : 'Connection Test Failed'}
                            </Typography>
                            {testResults[connection.id].context && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                {testResults[connection.id].context}
                              </Typography>
                            )}
                          {testResults[connection.id].details && (
                              <Box mt={1}>
                                <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                                  {JSON.stringify(testResults[connection.id].details, null, 2)}
                                </Typography>
                              </Box>
                          )}
                          {testResults[connection.id].error && (
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {testResults[connection.id].error}
                              </Typography>
                          )}
                          </Alert>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                  ))}
            </Grid>
              )}
        </Box>

            {/* Add/Edit Form */}
            {showAddForm && (
          <Paper sx={{ p: 3, mt: 3 }} elevation={2}>
            <Typography variant="h6" gutterBottom>
                  {editingConnection ? 'Edit Connection' : 'Add New Connection'}
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Connection Name"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        required
                    variant="outlined"
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Endpoint URL"
                        value={formData.endpointUrl}
                        onChange={(e) => setFormData({...formData, endpointUrl: e.target.value})}
                        placeholder="opc.tcp://localhost:4840"
                        required
                    variant="outlined"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Username"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                    variant="outlined"
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                    variant="outlined"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Security Mode</InputLabel>
                    <Select
                        value={formData.securityMode}
                      label="Security Mode"
                        onChange={(e) => setFormData({...formData, securityMode: e.target.value})}
                    >
                      <MenuItem value="None">
                        <Box>
                          <Typography variant="body2">None</Typography>
                          <Typography variant="caption" color="text.secondary">
                            No security - fastest connection
                          </Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="Sign">
                        <Box>
                          <Typography variant="body2">Sign</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Message integrity verification
                          </Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="SignAndEncrypt">
                        <Box>
                          <Typography variant="body2">Sign and Encrypt</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Full security - requires certificates
                          </Typography>
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                  {formData.securityMode !== 'None' && (
                    <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                      ⚠️ This security mode may require certificates
                    </Typography>
                  )}
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Security Policy</InputLabel>
                    <Select
                        value={formData.securityPolicy}
                      label="Security Policy"
                        onChange={(e) => setFormData({...formData, securityPolicy: e.target.value})}
                    >
                      <MenuItem value="None">
                        <Box>
                          <Typography variant="body2">None</Typography>
                          <Typography variant="caption" color="text.secondary">
                            No encryption - compatible with all servers
                          </Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="Basic128Rsa15">
                        <Box>
                          <Typography variant="body2">Basic128Rsa15</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Legacy security (deprecated)
                          </Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="Basic256">
                        <Box>
                          <Typography variant="body2">Basic256</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Standard security
                          </Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="Basic256Sha256">
                        <Box>
                          <Typography variant="body2">Basic256Sha256</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Recommended security
                          </Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="Aes128Sha256RsaOaep">
                        <Box>
                          <Typography variant="body2">Aes128Sha256RsaOaep</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Modern AES encryption
                          </Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem value="Aes256Sha256RsaPss">
                        <Box>
                          <Typography variant="body2">Aes256Sha256RsaPss</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Highest security
                          </Typography>
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                  {formData.securityPolicy !== 'None' && (
                    <Typography variant="caption" color="info.main" sx={{ mt: 1, display: 'block' }}>
                      💡 Strong encryption - server must support this policy
                    </Typography>
                  )}
                </Grid>

                {/* Security Configuration Status */}
                <Grid item xs={12}>
                  {(() => {
                    const isNoSecurity = formData.securityMode === 'None' && formData.securityPolicy === 'None';
                    const requiresCerts = formData.securityMode === 'Sign' || formData.securityMode === 'SignAndEncrypt';
                    const hasCerts = formData.certificatePath && formData.privateKeyPath;
                    
                    return (
                      <Alert 
                        severity={isNoSecurity ? 'info' : requiresCerts && hasCerts ? 'success' : requiresCerts ? 'warning' : 'info'}
                        sx={{ mt: 1 }}
                      >
                        <Typography variant="subtitle2" gutterBottom>
                          🔒 Current Security Configuration: {formData.securityMode}/{formData.securityPolicy}
                        </Typography>
                        
                        {isNoSecurity ? (
                          <Box>
                            <Typography variant="body2">
                              ✅ <strong>No Security Mode</strong> - Perfect for testing!
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              No certificates required. This configuration should work with most OPC UA servers.
                              Great for initial connection testing and development.
                            </Typography>
                          </Box>
                        ) : requiresCerts ? (
                          <Box>
                            <Typography variant="body2">
                              🔐 <strong>Certificate-based Security</strong> - Client certificates required
                            </Typography>
                            <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                              <Typography component="li" variant="body2" color={formData.certificatePath ? 'success.main' : 'error.main'}>
                                Client Certificate: {formData.certificatePath ? '✅ Configured' : '❌ Missing'}
                              </Typography>
                              <Typography component="li" variant="body2" color={formData.privateKeyPath ? 'success.main' : 'error.main'}>
                                Private Key: {formData.privateKeyPath ? '✅ Configured' : '❌ Missing'}
                              </Typography>
                            </Box>
                            {!hasCerts && (
                              <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                                ⚠️ Upload certificates below or switch to "None/None" security for testing
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Box>
                            <Typography variant="body2">
                              🔒 <strong>Server Certificate Validation</strong> - Basic security
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Server identity will be verified, but no client certificate required.
                            </Typography>
                          </Box>
                        )}
                      </Alert>
                    );
                  })()}
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Session Timeout (ms)"
                        type="number"
                        value={formData.requestedSessionTimeout}
                        onChange={(e) => setFormData({...formData, requestedSessionTimeout: parseInt(e.target.value)})}
                    variant="outlined"
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Publishing Interval (ms)"
                        type="number"
                        value={formData.requestedPublishingInterval}
                        onChange={(e) => setFormData({...formData, requestedPublishingInterval: parseInt(e.target.value)})}
                    variant="outlined"
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Priority"
                        type="number"
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                    variant="outlined"
                      />
                </Grid>

                  {/* Certificate Settings */}
                <Grid item xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <SecurityIcon />
                        <Typography variant="subtitle1">Certificate Settings</Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Configure SSL/TLS certificates for secure connections (Optional)
                          </Typography>
                          <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                            💡 Tip: Start testing without certificates using "None/None" security mode above!
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          startIcon={<KeyIcon />}
                          onClick={() => setShowCertificateManager(true)}
                        >
                          Manage Certificates
                        </Button>
                      </Box>
                      
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          🚀 Recommended Testing Approach
                        </Typography>
                        <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                          <Typography component="li" variant="body2">
                            <strong>1. Start Testing:</strong> Use "None/None" security (no certificates needed)
                          </Typography>
                          <Typography component="li" variant="body2">
                            <strong>2. Test Connection:</strong> Verify your OPC UA server connectivity
                          </Typography>
                          <Typography component="li" variant="body2">
                            <strong>3. Add Security:</strong> Then configure certificates for production
                          </Typography>
                          <Typography component="li" variant="body2">
                            <strong>Supported formats:</strong> .pem, .crt, .cer, .der, .key, .crl
                          </Typography>
                        </Box>
                      </Alert>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Box display="flex" gap={1}>
                            <TextField
                              fullWidth
                              label="Client Certificate"
                          value={formData.certificatePath}
                          onChange={(e) => setFormData({...formData, certificatePath: e.target.value})}
                          placeholder="/path/to/client-cert.pem"
                              variant="outlined"
                              size="small"
                            />
                            <Button
                              variant="outlined"
                              component="label"
                              startIcon={<UploadIcon />}
                              size="small"
                            >
                        <input
                                type="file"
                                accept=".pem,.crt,.cer,.der"
                                onChange={(e) => handleCertificateUpload(e, 'client')}
                                hidden
                              />
                            </Button>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Box display="flex" gap={1}>
                            <TextField
                              fullWidth
                              label="Private Key"
                          value={formData.privateKeyPath}
                          onChange={(e) => setFormData({...formData, privateKeyPath: e.target.value})}
                          placeholder="/path/to/client-key.pem"
                              variant="outlined"
                              size="small"
                            />
                            <Button
                              variant="outlined"
                              component="label"
                              startIcon={<UploadIcon />}
                              size="small"
                            >
                              <input
                                type="file"
                                accept=".pem,.key,.der"
                                onChange={(e) => handleCertificateUpload(e, 'private')}
                                hidden
                              />
                            </Button>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Box display="flex" gap={1}>
                            <TextField
                              fullWidth
                              label="Trust List Path"
                              value={formData.trustListPath}
                              onChange={(e) => setFormData({...formData, trustListPath: e.target.value})}
                              placeholder="/path/to/trust-list.pem"
                              variant="outlined"
                              size="small"
                            />
                            <Button
                              variant="outlined"
                              component="label"
                              startIcon={<UploadIcon />}
                              size="small"
                            >
                              <input
                                type="file"
                                accept=".pem,.crt,.der"
                                onChange={(e) => handleCertificateUpload(e, 'trust')}
                                hidden
                              />
                            </Button>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Box display="flex" gap={1}>
                            <TextField
                              fullWidth
                              label="Revocation List Path"
                              value={formData.revocationListPath}
                              onChange={(e) => setFormData({...formData, revocationListPath: e.target.value})}
                              placeholder="/path/to/revocation-list.crl"
                              variant="outlined"
                              size="small"
                            />
                            <Button
                              variant="outlined"
                              component="label"
                              startIcon={<UploadIcon />}
                              size="small"
                            >
                              <input
                                type="file"
                                accept=".crl"
                                onChange={(e) => handleCertificateUpload(e, 'revocation')}
                                hidden
                              />
                            </Button>
                          </Box>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                <Grid item xs={12}>
                  <Box display="flex" justifyContent="flex-end" gap={2} pt={3}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingConnection(null);
                        resetForm();
                      }}
                      size="large"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading}
                      startIcon={loading ? <RefreshIcon className="animate-spin" /> : <SaveIcon />}
                      size="large"
                    >
                      {editingConnection ? 'Update' : 'Create'} Connection
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        )}

        {/* Error Display */}
        <Dialog
          open={showError}
          onClose={() => setShowError(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={2}>
              <WarningIcon color="error" />
              <Typography variant="h6">OPC UA Connection Error</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body1" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {errorMessage}
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary">
              For additional troubleshooting:
            </Typography>
            <Box component="ul" sx={{ mt: 1, pl: 2 }}>
              <Typography component="li" variant="body2" color="text.secondary">
                Check the browser's developer console for detailed logs
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Verify the OPC UA server status and configuration
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Ensure network connectivity to the target endpoint
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowError(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </DialogContent>
    </Dialog>
          
    {/* Discovery Dialog */}
    <Dialog
      open={showDiscovery}
      onClose={() => setShowDiscovery(false)}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Discovered Endpoints</Typography>
          <IconButton onClick={() => setShowDiscovery(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          {discoveredEndpoints.map((endpoint, index) => (
            <Grid item xs={12} key={index}>
              <Card 
                variant="outlined" 
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => handleSelectEndpoint(endpoint)}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box flex={1}>
                      <Typography variant="subtitle1" fontFamily="monospace">
                        {endpoint.endpointUrl}
                      </Typography>
                      <Box display="flex" gap={1} mt={1}>
                        <Chip 
                          label={endpoint.securityMode} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                        />
                        <Chip 
                          label={endpoint.securityPolicy} 
                          size="small" 
                          color="success" 
                          variant="outlined" 
                        />
                        <Chip 
                          label={`Level ${endpoint.securityLevel}`} 
                          size="small" 
                          color="warning" 
                          variant="outlined" 
                        />
                      </Box>
                    </Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      {endpoint.userTokenPolicies.map((policy, pIndex) => (
                        <Typography key={pIndex} variant="caption" color="text.secondary">
                          {policy.tokenType}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
    </Dialog>

    {/* Certificate Manager Dialog */}
    <Dialog
      open={showCertificateManager}
      onClose={() => setShowCertificateManager(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Certificate Manager</Typography>
          <IconButton onClick={() => setShowCertificateManager(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Certificate Security
          </Typography>
          <Typography variant="body2">
            Upload certificates for secure OPC UA connections. Ensure certificates are valid and trusted.
          </Typography>
        </Alert>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card 
              variant="outlined" 
              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => alert('Self-signed certificate generation would be implemented here')}
            >
              <CardContent>
                <Box display="flex" alignItems="center">
                  <KeyIcon color="primary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="subtitle2">Generate Self-Signed Certificate</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Create a new self-signed certificate for testing
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12}>
            <Card 
              variant="outlined" 
              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => alert('Certificate store viewer would be implemented here')}
            >
              <CardContent>
                <Box display="flex" alignItems="center">
                  <DatabaseIcon color="success" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="subtitle2">View Certificate Store</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Browse and manage stored certificates
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12}>
            <Card 
              variant="outlined" 
              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => alert('Certificate export would be implemented here')}
            >
              <CardContent>
                <Box display="flex" alignItems="center">
                  <DownloadIcon color="secondary" sx={{ mr: 2 }} />
                  <Box>
                    <Typography variant="subtitle2">Export Certificates</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Download certificates for backup or sharing
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default OPCUAConnectionManager;
