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

const OPCUA_API_BASE = (import.meta as any).env.VITE_API_BASE || 'http://localhost:8080/api/v1';

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
      setConnections(response.data.connections);
      
      if (response.data.connections.length > 0) {
        setSelectedConnection(response.data.connections[0].id);
      }
    } catch (error: any) {
      setError('Failed to fetch OPC UA connections');
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const browseNodes = async (nodeId: string, path: string[] = ['RootFolder']) => {
    if (!selectedConnection) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${OPCUA_API_BASE}/connections/${selectedConnection}/browse`, {
        params: { nodeId, maxResults: 1000 }
      });
      
      setNodes(response.data.results);
      setCurrentPath(path);
    } catch (error: any) {
      setError(`Failed to browse nodes: ${error.response?.data?.error || error.message}`);
      console.error('Error browsing nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchNodes = async () => {
    if (!selectedConnection || !searchTerm.trim()) return;

    try {
      setSearchLoading(true);
      setError(null);
      
      const response = await axios.get(`${OPCUA_API_BASE}/connections/${selectedConnection}/search`, {
        params: { q: searchTerm, maxResults: 100 }
      });
      
      setSearchResults(response.data.results);
    } catch (error: any) {
      setError(`Failed to search nodes: ${error.response?.data?.error || error.message}`);
      console.error('Error searching nodes:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleNodeClick = (node: OPCUANode) => {
    if (node.hasChildren) {
      const newPath = [...currentPath, node.displayName];
      browseNodes(node.nodeId, newPath);
      setExpandedNodes(prev => new Set([...prev, node.nodeId]));
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      browseNodes('RootFolder', ['RootFolder']);
    } else {
      // Navigate to the specific path level
      const newPath = currentPath.slice(0, index + 1);
      // This would need to be implemented with proper path tracking
      browseNodes('RootFolder', newPath);
    }
  };

  const handleTagSelect = (node: OPCUANode) => {
    onTagSelect(node);
    onClose();
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
        {title}
      </Typography>
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
            }}
          >
            <ListItemIcon>
              {getNodeIcon(node)}
            </ListItemIcon>
            <ListItemText
              primary={node.displayName}
              secondary={
                <Box>
                  <Typography variant="caption" display="block">
                    {node.browseName} ({getNodeClassLabel(node.nodeClass)})
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
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
              >
                <CheckIcon />
              </IconButton>
            )}
          </ListItem>
        ))}
      </List>
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
                          <Typography>{conn.endpointUrl}</Typography>
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
                  />
                  <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={searchNodes}
                    disabled={!selectedConnection || !searchTerm.trim() || searchLoading}
                  >
                    Search
                  </Button>
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
