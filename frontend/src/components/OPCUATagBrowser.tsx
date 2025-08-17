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

const OPCUA_API_BASE = (import.meta as any).env.VITE_OPCUA_API_BASE || 'http://localhost:3001';

interface OPCUANode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: number;
  hasChildren: boolean;
}

interface OPCUAConnection {
  id: string;
  endpointUrl: string;
  status: string;
  monitoredItemsCount: number;
  reconnectAttempts: number;
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
  const [connections, setConnections] = useState<OPCUAConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
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

  useEffect(() => {
    if (open) {
      fetchConnections();
    }
  }, [open]);

  useEffect(() => {
    if (selectedConnection) {
      browseNodes('RootFolder');
    }
  }, [selectedConnection]);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${OPCUA_API_BASE}/connections`);
      const connections = response.data.connections || [];
      
      // Filter only connected connections
      const connectedConnections = connections.filter((conn: OPCUAConnection) => conn.status === 'connected');
      setConnections(connectedConnections);
      
      if (connectedConnections.length > 0) {
        setSelectedConnection(connectedConnections[0].id);
      } else if (connections.length > 0) {
        setError('No connected OPC UA servers found. Please connect to a server first.');
      } else {
        setError('No OPC UA connections configured. Please create a connection first.');
      }
    } catch (error: any) {
      setError(`Failed to fetch OPC UA connections: ${error.response?.data?.error || error.message}`);
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const browseNodes = async (nodeId: string, path: string[] = ['RootFolder']) => {
    if (!selectedConnection) {
      setError('Please select a connected OPC UA server first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${OPCUA_API_BASE}/connections/${selectedConnection}/browse`, {
        params: { nodeId, maxResults: 1000 }
      });
      
      const results = response.data.results || [];
      setNodes(results);
      setCurrentPath(path);
      
      // Clear search results when browsing
      setSearchResults([]);
      setSearchTerm('');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      setError(`Failed to browse nodes: ${errorMessage}`);
      console.error('Error browsing nodes:', error);
      
      // If it's a connection error, refresh connections
      if (errorMessage.includes('Connection not available') || errorMessage.includes('not found')) {
        fetchConnections();
      }
    } finally {
      setLoading(false);
    }
  };

  const searchNodes = async () => {
    if (!selectedConnection) {
      setError('Please select a connected OPC UA server first.');
      return;
    }
    
    if (!searchTerm.trim()) {
      setError('Please enter a search term.');
      return;
    }

    try {
      setSearchLoading(true);
      setError(null);
      
      const response = await axios.get(`${OPCUA_API_BASE}/connections/${selectedConnection}/search`, {
        params: { q: searchTerm.trim(), maxResults: 100 }
      });
      
      const results = response.data.results || [];
      setSearchResults(results);
      
      if (results.length === 0) {
        setError(`No nodes found matching "${searchTerm}".`);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message;
      setError(`Failed to search nodes: ${errorMessage}`);
      console.error('Error searching nodes:', error);
      
      // If it's a connection error, refresh connections
      if (errorMessage.includes('Connection not available') || errorMessage.includes('not found')) {
        fetchConnections();
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
    if (!selectedConnection) return;

    try {
      setReadingValue(true);
      const response = await axios.get(`${OPCUA_API_BASE}/connections/${selectedConnection}/nodes/${encodeURIComponent(node.nodeId)}/read`);
      setNodeValue(response.data.value);
      setShowNodeDetails(node);
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
                    value={selectedConnection}
                    label="Select Connection"
                    onChange={(e) => setSelectedConnection(e.target.value)}
                    disabled={connections.length === 0}
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
                <Box mt={1}>
                  <Button
                    startIcon={<RefreshIcon />}
                    onClick={fetchConnections}
                    disabled={connectionLoading}
                  >
                    Refresh Connections
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
                    disabled={!selectedConnection}
                    helperText="Search by node name, browse name, or node ID"
                  />
                  <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={searchNodes}
                    disabled={!selectedConnection || !searchTerm.trim() || searchLoading}
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
  );
}
