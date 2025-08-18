import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
  Breadcrumbs,
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Folder as FolderIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon
} from '@mui/icons-material';
import axios from 'axios';

// Route through Vite dev proxy to avoid CORS issues in dev
const OPCUA_API_BASE = '/opcua-gateway';
const DIRECT_OPCUA_API = '/opcua-direct';

interface OPCUANode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: number;
  hasChildren: boolean;
}

interface OPCUAServer {
  id: string;
  name: string;
  endpointUrl: string;
  enabled: boolean;
  securityPolicy: string;
  securityMode: string;
  userAuthMethod: string;
  samplingInterval: number;
}

interface OPCUAConnection {
  serverId: string;
  status: string;
  endpoint: string;
  lastConnected?: string;
  activeSessions: number;
  monitoredItems: number;
  connectionQuality: string;
}

interface OPCUATagBrowserProps {
  open: boolean;
  onClose: () => void;
  onTagSelect: (tag: OPCUANode) => void;
  selectedTag?: OPCUANode | null;
  title?: string;
}

export default function OPCUATagBrowser({ 
  open, 
  onClose, 
  onTagSelect, 
  selectedTag,
  title = "OPC UA Tag Browser" 
}: OPCUATagBrowserProps) {
  const [servers, setServers] = useState<OPCUAServer[]>([]);
  const [connections, setConnections] = useState<OPCUAConnection[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [nodes, setNodes] = useState<OPCUANode[]>([]);
  const [searchResults, setSearchResults] = useState<OPCUANode[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>(['RootFolder']);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [nodeHistory, setNodeHistory] = useState<Array<{nodeId: string, path: string[]}>>([{nodeId: 'RootFolder', path: ['RootFolder']}]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showNodeDetails, setShowNodeDetails] = useState<OPCUANode | null>(null);
  const [nodeValue, setNodeValue] = useState<any>(null);
  const [readingValue, setReadingValue] = useState(false);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    endpointUrl: '',
    securityPolicy: 'None',
    securityMode: 'None',
    userAuthMethod: 'anonymous',
    username: '',
    password: '',
    samplingInterval: 200
  });

  useEffect(() => {
    if (open) {
      fetchServersAndConnections();
    }
  }, [open]);

  useEffect(() => {
    if (selectedServer) {
      browseNodes('RootFolder');
    }
  }, [selectedServer]);

  const fetchServersAndConnections = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try direct OPC UA API first, as it's the primary service
      try {
        // Fetch servers
        const serversResponse = await axios.get(`${DIRECT_OPCUA_API}/api/v1/servers`);
        const servers = serversResponse.data || [];
        setServers(servers);
        
        // Fetch connections status
        const connectionsResponse = await axios.get(`${DIRECT_OPCUA_API}/api/v1/connections`);
        const connections = connectionsResponse.data || [];
        setConnections(connections);
        
        // Find servers with active connections
        const connectedServers = servers.filter((server: OPCUAServer) => 
          server.enabled && connections.find((conn: OPCUAConnection) => 
            conn.serverId === server.id && conn.status === 'connected'
          )
        );
        
        if (connectedServers.length > 0) {
          setSelectedServer(connectedServers[0].id);
        } else if (servers.length > 0) {
          // If we have servers but none connected, still allow browsing (might auto-connect)
          setSelectedServer(servers[0].id);
          setError('No active OPC UA connections. Attempting to connect...');
        } else {
          setError('No OPC UA servers configured. Please configure a server first.');
        }
      } catch (err) {
        console.warn('Direct OPC UA API not available, trying API Gateway');
        try {
          const response = await axios.get(`${OPCUA_API_BASE}/connections`);
          const gatewayConnections = response.data.connections || [];
          
          // Convert gateway format to our format
          const convertedServers = gatewayConnections.map((conn: any, index: number) => ({
            id: conn.id || `server-${index}`,
            name: `Server ${index + 1}`,
            endpointUrl: conn.endpointUrl || 'Unknown',
            enabled: true,
            securityPolicy: 'Unknown',
            securityMode: 'Unknown',
            userAuthMethod: 'Unknown',
            samplingInterval: 200
          }));
          
          setServers(convertedServers);
          setConnections(gatewayConnections.map((conn: any) => ({
            serverId: conn.id || `server-${gatewayConnections.indexOf(conn)}`,
            status: conn.status || 'unknown',
            endpoint: conn.endpointUrl || 'Unknown',
            activeSessions: 1,
            monitoredItems: conn.monitoredItemsCount || 0,
            connectionQuality: 'unknown'
          })));
          
          if (convertedServers.length > 0) {
            setSelectedServer(convertedServers[0].id);
          } else {
            setError('No OPC UA connections available.');
          }
        } catch (gatewayErr) {
          setError('Failed to connect to OPC UA services. Please ensure the OPC UA client service is running.');
        }
      }
    } catch (error: any) {
      setError(`Failed to fetch OPC UA servers: ${error.response?.data?.error || error.message}`);
      console.error('Error fetching servers and connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const browseNodes = async (nodeId: string, path: string[] = ['RootFolder']) => {
    if (!selectedServer) {
      setError('Please select an OPC UA server first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Use direct OPC UA API
      try {
        const response = await axios.get(`${DIRECT_OPCUA_API}/api/v1/browse/${selectedServer}`, {
          params: { nodeId, maxResults: 1000 }
        });
        
        const results = response.data || [];
        setNodes(results);
        setCurrentPath(path);
        
        // Clear search results when browsing
        setSearchResults([]);
        setSearchTerm('');
      } catch (err) {
        // Fallback to API Gateway
        try {
          const response = await axios.get(`${OPCUA_API_BASE}/browse`, {
            params: { nodeId, maxResults: 1000 }
          });
          
          const results = response.data.results || [];
          setNodes(results);
          setCurrentPath(path);
          setSearchResults([]);
          setSearchTerm('');
        } catch (gatewayErr) {
          throw err; // Use original error
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      setError(`Failed to browse nodes: ${errorMessage}`);
      console.error('Error browsing nodes:', error);
      
      // If it's a connection error, refresh servers and connections
      if (errorMessage.includes('Connection not available') || errorMessage.includes('not found')) {
        fetchServersAndConnections();
      }
    } finally {
      setLoading(false);
    }
  };

  const searchNodes = async () => {
    if (!selectedServer) {
      setError('Please select an OPC UA server first.');
      return;
    }
    
    if (!searchTerm.trim()) {
      setError('Please enter a search term.');
      return;
    }

    try {
      setSearchLoading(true);
      setError(null);
      
      // Use direct OPC UA API
      try {
        const response = await axios.get(`${DIRECT_OPCUA_API}/api/v1/search/${selectedServer}`, {
          params: { q: searchTerm.trim(), maxResults: 100 }
        });
        
        const results = response.data || [];
        setSearchResults(results);
        
        if (results.length === 0) {
          setError(`No nodes found matching "${searchTerm}".`);
        }
      } catch (err) {
        // Fallback to API Gateway
        try {
          const response = await axios.get(`${OPCUA_API_BASE}/search`, {
            params: { q: searchTerm.trim(), maxResults: 100 }
          });
          
          const results = response.data.results || [];
          setSearchResults(results);
          
          if (results.length === 0) {
            setError(`No nodes found matching "${searchTerm}".`);
          }
        } catch (gatewayErr) {
          throw err; // Use original error
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      setError(`Failed to search nodes: ${errorMessage}`);
      console.error('Error searching nodes:', error);
      
      // If it's a connection error, refresh servers and connections
      if (errorMessage.includes('Connection not available') || errorMessage.includes('not found')) {
        fetchServersAndConnections();
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const handleNodeClick = (node: OPCUANode) => {
    if (node.hasChildren) {
      const newPath = [...currentPath, node.displayName];
      browseNodes(node.nodeId, newPath);
      setExpandedNodes(prev => new Set([...prev, node.nodeId]));
    } else {
      // For leaf nodes, we can directly select them
      handleTagSelect(node);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      browseNodes('RootFolder', ['RootFolder']);
    } else {
      // For now, just go back to root since we don't have proper path tracking
      // In a full implementation, we'd need to store nodeId for each path level
      browseNodes('RootFolder', ['RootFolder']);
    }
  };

  const handleTagSelect = (node: OPCUANode) => {
    onTagSelect(node);
    if (title === "OPC UA Tag Browser") {
      onClose();
    }
  };

  const readNodeValue = async (node: OPCUANode) => {
    if (!selectedServer) return;

    try {
      setReadingValue(true);
      const response = await axios.post(`${DIRECT_OPCUA_API}/api/v1/nodes/${selectedServer}/read`, {
        nodeIds: [node.nodeId]
      });
      const nodeValues = response.data || [];
      if (nodeValues.length > 0) {
        setNodeValue(nodeValues[0]);
        setShowNodeDetails(node);
      }
    } catch (error: any) {
      setError(`Failed to read node value: ${error.response?.data?.error || error.message}`);
      console.error('Error reading node value:', error);
    } finally {
      setReadingValue(false);
    }
  };

  const addNodeToHistory = (nodeId: string, path: string[]) => {
    // Remove any history items after current index
    const newHistory = nodeHistory.slice(0, historyIndex + 1);
    // Add new item
    newHistory.push({ nodeId, path });
    setNodeHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const createServer = async () => {
    if (!newServer.name.trim() || !newServer.endpointUrl.trim()) {
      setError('Server name and endpoint URL are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const serverConfig = {
        id: `server-${Date.now()}`,
        name: newServer.name.trim(),
        endpointUrl: newServer.endpointUrl.trim(),
        enabled: true,
        securityPolicy: newServer.securityPolicy,
        securityMode: newServer.securityMode,
        userAuthMethod: newServer.userAuthMethod,
        samplingInterval: newServer.samplingInterval,
        ...(newServer.userAuthMethod === 'username' && {
          username: newServer.username,
          password: newServer.password
        })
      };

      await axios.post(`${DIRECT_OPCUA_API}/api/v1/servers`, serverConfig);
      
      // Reset form and close dialog
      setNewServer({
        name: '',
        endpointUrl: '',
        securityPolicy: 'None',
        securityMode: 'None',
        userAuthMethod: 'anonymous',
        username: '',
        password: '',
        samplingInterval: 200
      });
      setShowServerDialog(false);
      
      // Refresh servers and connections
      await fetchServersAndConnections();
    } catch (error: any) {
      setError(`Failed to create server: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getNodeIcon = (node: OPCUANode) => {
    if (node.hasChildren) {
      return <FolderIcon color="primary" />;
    }
    return <SettingsIcon color="action" />;
  };

  const getNodeClassLabel = (nodeClass: number) => {
    switch (nodeClass) {
      case 1: return 'Object';
      case 2: return 'Variable';
      case 4: return 'Method';
      default: return 'Unknown';
    }
  };

  const renderNodeList = (nodeList: OPCUANode[], title: string) => (
    <Box>
      <Typography variant="h6" gutterBottom>
        {title} ({nodeList.length} items)
      </Typography>
      {nodeList.length === 0 ? (
        <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
          No nodes found. Try expanding parent nodes or adjusting your search.
        </Typography>
      ) : (
        <List dense>
          {nodeList.map((node) => (
            <ListItem
              key={node.nodeId}
              button
              onClick={() => handleNodeClick(node)}
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
                border: selectedTag?.nodeId === node.nodeId ? '2px solid' : '1px solid transparent',
                borderColor: selectedTag?.nodeId === node.nodeId ? 'primary.main' : 'transparent',
                borderRadius: 1,
                mb: 0.5
              }}
            >
              <ListItemIcon>
                {getNodeIcon(node)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight={selectedTag?.nodeId === node.nodeId ? 'bold' : 'normal'}>
                      {node.displayName}
                    </Typography>
                    {node.hasChildren && (
                      <Chip size="small" label={`${node.hasChildren ? 'Container' : 'Variable'}`} variant="outlined" />
                    )}
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="caption" display="block">
                      {node.browseName} ({getNodeClassLabel(node.nodeClass)})
                    </Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ wordBreak: 'break-all' }}>
                      {node.nodeId}
                    </Typography>
                  </Box>
                }
              />
              {!node.hasChildren && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTagSelect(node);
                  }}
                  color="primary"
                  sx={{
                    backgroundColor: selectedTag?.nodeId === node.nodeId ? 'primary.main' : 'transparent',
                    color: selectedTag?.nodeId === node.nodeId ? 'white' : 'inherit',
                    '&:hover': {
                      backgroundColor: selectedTag?.nodeId === node.nodeId ? 'primary.dark' : 'action.hover',
                    }
                  }}
                >
                  <CheckIcon />
                </IconButton>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );

  return (
    <>
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Connection Selection */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  OPC UA Connection
                </Typography>
                <FormControl fullWidth>
                  <InputLabel>Select Connection</InputLabel>
                  <Select
                    value={selectedServer}
                    label="Select Server"
                    onChange={(e) => setSelectedServer(e.target.value)}
                    disabled={servers.length === 0}
                  >
                    {servers.map((server) => {
                      const connection = connections.find(c => c.serverId === server.id);
                      return (
                        <MenuItem key={server.id} value={server.id}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                            <Box>
                              <Typography variant="body2">{server.name}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                {server.endpointUrl}
                              </Typography>
                              {connection && (
                                <Typography variant="caption" color="textSecondary" display="block">
                                  {connection.monitoredItems} monitored items
                                </Typography>
                              )}
                            </Box>
                            <Chip 
                              label={connection?.status || (server.enabled ? 'configured' : 'disabled')} 
                              size="small" 
                              color={connection?.status === 'connected' ? 'success' : server.enabled ? 'warning' : 'default'}
                            />
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <Box mt={1} display="flex" gap={1}>
                  <Button
                    startIcon={<RefreshIcon />}
                    onClick={fetchServersAndConnections}
                    disabled={connectionLoading}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => setShowServerDialog(true)}
                  >
                    Add Server
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Search */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Search Tags
                </Typography>
                <Box display="flex" gap={1}>
                  <TextField
                    fullWidth
                    label="Search tags..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchNodes()}
                    disabled={!selectedServer}
                    helperText="Search by node name, browse name, or node ID"
                  />
                  <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={searchNodes}
                    disabled={!selectedServer || !searchTerm.trim() || searchLoading}
                  >
                    Search
                  </Button>
                  {searchResults.length > 0 && (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setSearchResults([]);
                        setSearchTerm('');
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </Box>
                {searchLoading && (
                  <Box display="flex" justifyContent="center" mt={2}>
                    <CircularProgress size={24} />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Breadcrumb Navigation */}
          <Grid item xs={12}>
            <Breadcrumbs aria-label="breadcrumb">
              {currentPath.map((path, index) => (
                <Link
                  key={index}
                  color={index === currentPath.length - 1 ? "text.primary" : "inherit"}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleBreadcrumbClick(index);
                  }}
                  underline="hover"
                >
                  {path}
                </Link>
              ))}
            </Breadcrumbs>
          </Grid>

          {/* Content Area */}
          <Grid item xs={12}>
            <Paper sx={{ height: '400px', overflow: 'auto' }}>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <CircularProgress />
                </Box>
              ) : searchResults.length > 0 ? (
                renderNodeList(searchResults, `Search Results for "${searchTerm}"`)
              ) : (
                renderNodeList(nodes, 'Address Space')
              )}
            </Paper>
          </Grid>

          {/* Selected Tag Display */}
          {selectedTag && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Selected Tag
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1">{selectedTag.displayName}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {selectedTag.browseName} ({getNodeClassLabel(selectedTag.nodeClass)})
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {selectedTag.nodeId}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => onTagSelect(null as any)}
                      color="error"
                    >
                      <CloseIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={() => selectedTag && handleTagSelect(selectedTag)}
          disabled={!selectedTag}
        >
          Select Tag
        </Button>
      </DialogActions>
    </Dialog>

    
    <Dialog 
      open={showServerDialog} 
      onClose={() => setShowServerDialog(false)} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle>Add OPC UA Server</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ mt: 1 }}>
          <TextField
            fullWidth
            label="Server Name"
            value={newServer.name}
            onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Endpoint URL"
            value={newServer.endpointUrl}
            onChange={(e) => setNewServer({ ...newServer, endpointUrl: e.target.value })}
            margin="normal"
            placeholder="opc.tcp://localhost:4840"
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Authentication Method</InputLabel>
            <Select
              value={newServer.userAuthMethod}
              label="Authentication Method"
              onChange={(e) => setNewServer({ ...newServer, userAuthMethod: e.target.value })}
            >
              <MenuItem value="anonymous">Anonymous</MenuItem>
              <MenuItem value="username">Username/Password</MenuItem>
            </Select>
          </FormControl>
          
          {newServer.userAuthMethod === 'username' && (
            <>
              <TextField
                fullWidth
                label="Username"
                value={newServer.username}
                onChange={(e) => setNewServer({ ...newServer, username: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                type="password"
                label="Password"
                value={newServer.password}
                onChange={(e) => setNewServer({ ...newServer, password: e.target.value })}
                margin="normal"
              />
            </>
          )}
          
          <TextField
            fullWidth
            type="number"
            label="Sampling Interval (ms)"
            value={newServer.samplingInterval}
            onChange={(e) => setNewServer({ ...newServer, samplingInterval: parseInt(e.target.value) || 200 })}
            margin="normal"
            inputProps={{ min: 100, max: 10000 }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowServerDialog(false)}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={createServer}
          disabled={loading || !newServer.name.trim() || !newServer.endpointUrl.trim()}
        >
          Create Server
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
