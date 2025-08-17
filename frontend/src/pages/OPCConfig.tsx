import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton
} from '@mui/material';
import { 
  Save, 
  Refresh, 
  Settings as SettingsIcon, 
  Visibility as VisibilityIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import OPCUAConnectionManager from '../components/OPCUAConnectionManager'
import OPCUATagBrowser from '../components/OPCUATagBrowser';
import axios from 'axios'; 



const OPCUA_API_BASE = (import.meta as any).env.VITE_OPCUA_API_BASE || 'http://localhost:3001';

export default function OPCConfig() {
  const [serverUrl, setServerUrl] = React.useState('opc.tcp://localhost:4840');
  const [securityMode, setSecurityMode] = React.useState('None');
  const [securityPolicy, setSecurityPolicy] = React.useState('None');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [autoReconnect, setAutoReconnect] = React.useState(true);
  const [connectionTimeout, setConnectionTimeout] = React.useState(30);
  const [isConnected, setIsConnected] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [connections, setConnections] = React.useState<any[]>([]);
  const [showConnectionManager, setShowConnectionManager] = React.useState(false);
  const [showTagBrowser, setShowTagBrowser] = React.useState(false);
  const [selectedConnection, setSelectedConnection] = React.useState('');
  const [testResults, setTestResults] = React.useState<{[key: string]: any}>({});
  const [securityOptions, setSecurityOptions] = React.useState<any>(null);

  React.useEffect(() => {
    loadConnections();
    loadSecurityOptions();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${OPCUA_API_BASE}/connections`);
      setConnections(response.data.connections || []);
      
      // Set the first connected connection as selected
      const connectedConnection = response.data.connections?.find((conn: any) => conn.status === 'connected');
      if (connectedConnection) {
        setSelectedConnection(connectedConnection.id);
        setServerUrl(connectedConnection.endpointUrl);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSecurityOptions = async () => {
    try {
      const response = await axios.get(`${OPCUA_API_BASE}/security-options`);
      setSecurityOptions(response.data);
    } catch (error) {
      console.error('Failed to load security options:', error);
    }
  };

  const handleSave = () => {
    console.log('Saving OPC configuration...');
  };

  const handleTestConnection = async () => {
    if (!selectedConnection) {
      alert('Please select a connection first');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${OPCUA_API_BASE}/connections/${selectedConnection}/test`);
      setTestResults(prev => ({ ...prev, [selectedConnection]: response.data }));
      setIsConnected(response.data.success);
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setTestResults(prev => ({ 
        ...prev, 
        [selectedConnection]: { 
          success: false, 
          error: error.response?.data?.error || error.message 
        } 
      }));
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedConnection) {
      alert('Please select a connection first');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${OPCUA_API_BASE}/connections/${selectedConnection}/connect`);
      await loadConnections();
      setIsConnected(true);
    } catch (error: any) {
      console.error('Connection failed:', error);
      alert(`Connection failed: ${error.response?.data?.error || error.message}`);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedConnection) return;

    try {
      setLoading(true);
      await axios.post(`${OPCUA_API_BASE}/connections/${selectedConnection}/disconnect`);
      await loadConnections();
      setIsConnected(false);
    } catch (error: any) {
      console.error('Disconnect failed:', error);
      alert(`Disconnect failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    console.log('Refreshing OPC configuration...');
    loadConnections();
    loadSecurityOptions();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        OPC UA Configuration
      </Typography>
      
      <Grid container spacing={3}>
        {/* Connection Management */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Connection Management" />
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <FormControl fullWidth>
                    <InputLabel>Active OPC UA Connection</InputLabel>
                    <Select
                      value={selectedConnection}
                      label="Active OPC UA Connection"
                      onChange={(e) => {
                        setSelectedConnection(e.target.value);
                        const connection = connections.find(c => c.id === e.target.value);
                        if (connection) {
                          setServerUrl(connection.endpointUrl);
                          setSecurityMode(connection.securityMode || 'None');
                          setSecurityPolicy(connection.securityPolicy || 'None');
                          setIsConnected(connection.status === 'connected');
                        }
                      }}
                    >
                      {connections.map((conn) => (
                        <MenuItem key={conn.id} value={conn.id}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                            <Box>
                              <Typography variant="body2">{conn.endpointUrl}</Typography>
                              {conn.monitoredItemsCount !== undefined && (
                                <Typography variant="caption" color="textSecondary">
                                  {conn.monitoredItemsCount} monitored items
                                </Typography>
                              )}
                            </Box>
                            <Chip 
                              label={conn.status} 
                              size="small" 
                              color={conn.status === 'connected' ? 'success' : 'error'}
                            />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box display="flex" gap={1}>
                    <Button
                      variant="outlined"
                      startIcon={<SettingsIcon />}
                      onClick={() => setShowConnectionManager(true)}
                      fullWidth
                    >
                      Manage
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={() => setShowTagBrowser(true)}
                      disabled={!selectedConnection || !isConnected}
                      fullWidth
                    >
                      Browse
                    </Button>
                  </Box>
                </Grid>
              </Grid>
              
              {connections.length === 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  No OPC UA connections found. Click "Manage" to create a new connection.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Connection Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Connection Settings" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Server URL"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="opc.tcp://localhost:4840"
                    helperText="OPC UA server endpoint URL"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Security Mode</InputLabel>
                    <Select
                      value={securityMode}
                      label="Security Mode"
                      onChange={(e) => setSecurityMode(e.target.value)}
                    >
                      <MenuItem value="None">None</MenuItem>
                      <MenuItem value="Sign">Sign</MenuItem>
                      <MenuItem value="SignAndEncrypt">Sign and Encrypt</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Security Policy</InputLabel>
                    <Select
                      value={securityPolicy}
                      label="Security Policy"
                      onChange={(e) => setSecurityPolicy(e.target.value)}
                    >
                      <MenuItem value="None">None</MenuItem>
                      <MenuItem value="Basic128Rsa15">Basic128Rsa15</MenuItem>
                      <MenuItem value="Basic256">Basic256</MenuItem>
                      <MenuItem value="Basic256Sha256">Basic256Sha256</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Connection Timeout (seconds)"
                    type="number"
                    value={connectionTimeout}
                    onChange={(e) => setConnectionTimeout(Number(e.target.value))}
                    inputProps={{ min: 1, max: 300 }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoReconnect}
                        onChange={(e) => setAutoReconnect(e.target.checked)}
                      />
                    }
                    label="Auto-reconnect on connection loss"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Authentication */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Authentication" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username if required"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password if required"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Alert severity="info">
                    Leave username and password empty for anonymous authentication
                  </Alert>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Status and Actions */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Connection Status" />
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <Alert 
                    severity={isConnected ? "success" : "warning"}
                    icon={isConnected ? undefined : undefined}
                  >
                    {isConnected ? "Connected to OPC UA Server" : "Not connected"}
                  </Alert>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Box display="flex" gap={2} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={handleRefresh}
                    >
                      Refresh
                    </Button>
                    
                    <Button
                      variant="outlined"
                      onClick={handleTestConnection}
                      disabled={loading || !selectedConnection}
                      color={isConnected ? "success" : "primary"}
                      startIcon={loading ? <CircularProgress size={16} /> : undefined}
                    >
                      {loading ? "Testing..." : "Test Connection"}
                    </Button>
                    
                    {isConnected ? (
                      <Button
                        variant="contained"
                        onClick={handleDisconnect}
                        disabled={loading}
                        color="error"
                        startIcon={<StopIcon />}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={handleConnect}
                        disabled={loading || !selectedConnection}
                        color="success"
                        startIcon={<PlayArrowIcon />}
                      >
                        Connect
                      </Button>
                    )}
                    
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleSave}
                      color="primary"
                    >
                      Save Configuration
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Test Results */}
        {selectedConnection && testResults[selectedConnection] && (
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Connection Test Results" />
              <CardContent>
                <Alert 
                  severity={testResults[selectedConnection].success ? "success" : "error"}
                  sx={{ mb: 2 }}
                >
                  {testResults[selectedConnection].success 
                    ? "Connection test successful!" 
                    : `Connection test failed: ${testResults[selectedConnection].error}`
                  }
                </Alert>
                
                {testResults[selectedConnection].details && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Test Details:
                    </Typography>
                    <Box component="pre" sx={{ 
                      bgcolor: 'grey.100', 
                      p: 2, 
                      borderRadius: 1, 
                      fontSize: '0.875rem',
                      overflow: 'auto',
                      maxHeight: 200
                    }}>
                      {JSON.stringify(testResults[selectedConnection].details, null, 2)}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Connection Status Details */}
        {selectedConnection && (
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Connection Details" />
              <CardContent>
                <Grid container spacing={2}>
                  {connections.find(c => c.id === selectedConnection) && (() => {
                    const conn = connections.find(c => c.id === selectedConnection);
                    return (
                      <>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2"><strong>Endpoint URL:</strong> {conn.endpointUrl}</Typography>
                          <Typography variant="body2"><strong>Status:</strong> 
                            <Chip 
                              label={conn.status} 
                              size="small" 
                              color={conn.status === 'connected' ? 'success' : 'error'} 
                              sx={{ ml: 1 }}
                            />
                          </Typography>
                          <Typography variant="body2"><strong>Security Mode:</strong> {conn.securityMode || 'None'}</Typography>
                          <Typography variant="body2"><strong>Security Policy:</strong> {conn.securityPolicy || 'None'}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          {conn.monitoredItemsCount !== undefined && (
                            <Typography variant="body2"><strong>Monitored Items:</strong> {conn.monitoredItemsCount}</Typography>
                          )}
                          {conn.reconnectAttempts !== undefined && (
                            <Typography variant="body2"><strong>Reconnect Attempts:</strong> {conn.reconnectAttempts}</Typography>
                          )}
                          <Typography variant="body2"><strong>Last Updated:</strong> {new Date().toLocaleString()}</Typography>
                        </Grid>
                      </>
                    );
                  })()}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Connection Manager Dialog */}
      <OPCUAConnectionManager
        open={showConnectionManager}
        onClose={() => {
          setShowConnectionManager(false);
          loadConnections();
        }}
      />

      {/* Tag Browser Dialog */}
      <OPCUATagBrowser
        open={showTagBrowser}
        onClose={() => setShowTagBrowser(false)}
        onTagSelect={(node) => {
          console.log('Selected tag:', node);
          setShowTagBrowser(false);
        }}
        title="Browse OPC UA Tags"
      />
    </Box>
  );
}
