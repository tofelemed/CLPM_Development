import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  Tag, 
  Home, 
  Search, 
  Filter,
  Eye,
  EyeOff,
  Download,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectOption } from '../ui/select';
import { Badge } from '../ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHeaderCell } from '../ui/table';
import { useOPCUABrowsing, useOPCUAServers } from '../../hooks/useOPCUA';
import { BrowseNode } from '../../types/opcua';

interface TagBrowserProps {
  serverId?: string;
  onTagSelect?: (tags: BrowseNode[]) => void;
  multiSelect?: boolean;
  showValues?: boolean;
}

export const TagBrowser: React.FC<TagBrowserProps> = ({ 
  serverId, 
  onTagSelect,
  multiSelect = false,
  showValues = true
}) => {
  const { servers } = useOPCUAServers();
  const {
    nodes,
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
  } = useOPCUABrowsing(serverId);

  const [searchTerm, setSearchTerm] = useState('');
  const [nodeClassFilter, setNodeClassFilter] = useState('');
  const [showOnlyVariables, setShowOnlyVariables] = useState(false);
  const [nodeValues, setNodeValues] = useState<Map<string, any>>(new Map());
  const [loadingValues, setLoadingValues] = useState<Set<string>>(new Set());

  const server = servers.find(s => s.id === serverId);

  // Filter nodes based on search and filters
  const filteredNodes = nodes.filter(node => {
    if (searchTerm && !node.displayName.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !node.browseName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    if (nodeClassFilter && node.nodeClass !== nodeClassFilter) {
      return false;
    }
    
    if (showOnlyVariables && node.nodeClass !== 'Variable') {
      return false;
    }
    
    return true;
  });

  // Get unique node classes for filter dropdown
  const nodeClasses = Array.from(new Set(nodes.map(node => node.nodeClass)))
    .map(nodeClass => ({ value: nodeClass, label: nodeClass }));

  const handleNodeClick = async (node: BrowseNode) => {
    if (node.hasChildren) {
      await navigateToNode(node.nodeId, node.displayName);
    } else if (multiSelect) {
      toggleNodeSelection(node.nodeId);
      if (onTagSelect) {
        const selectedNodeObjects = nodes.filter(n => 
          selectedNodes.has(n.nodeId) || n.nodeId === node.nodeId
        );
        onTagSelect(selectedNodeObjects);
      }
    } else if (onTagSelect) {
      onTagSelect([node]);
    }
  };

  const handleReadValue = async (node: BrowseNode) => {
    if (node.nodeClass !== 'Variable') return;
    
    setLoadingValues(prev => new Set(prev).add(node.nodeId));
    try {
      const value = await readNodeValue(node.nodeId);
      setNodeValues(prev => new Map(prev).set(node.nodeId, value));
    } catch (error) {
      console.error('Failed to read node value:', error);
    } finally {
      setLoadingValues(prev => {
        const newSet = new Set(prev);
        newSet.delete(node.nodeId);
        return newSet;
      });
    }
  };

  const handleRefresh = () => {
    browseNodes(breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].nodeId : undefined);
  };

  const getNodeIcon = (node: BrowseNode) => {
    if (node.hasChildren) {
      return <Folder className="w-4 h-4 text-blue-500" />;
    } else if (node.nodeClass === 'Variable') {
      return <Tag className="w-4 h-4 text-green-500" />;
    } else {
      return <Tag className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (!serverId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No server selected</h3>
            <p className="text-gray-600">Select a server to browse its tags</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Tag Browser
              {server && (
                <Badge variant="outline" className="ml-2">
                  {server.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {multiSelect && selectedNodes.size > 0 && (
                <>
                  <Badge variant="secondary">
                    {selectedNodes.size} selected
                  </Badge>
                  <Button size="sm" variant="outline" onClick={clearSelection}>
                    Clear
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigateBack(-1)}
              className="flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Root
            </Button>
            {breadcrumb.map((crumb, index) => (
              <React.Fragment key={crumb.nodeId}>
                <ChevronRight className="w-3 h-3 text-gray-400" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigateBack(index)}
                  className="text-sm"
                >
                  {crumb.displayName}
                </Button>
              </React.Fragment>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select
              placeholder="Filter by node class"
              value={nodeClassFilter}
              onChange={(e) => setNodeClassFilter(e.target.value)}
              options={[
                { value: '', label: 'All node classes' },
                ...nodeClasses
              ]}
            />
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyVariables}
                  onChange={(e) => setShowOnlyVariables(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Variables only</span>
              </label>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Nodes Table */}
          {!loading && filteredNodes.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  {multiSelect && <TableHeaderCell>Select</TableHeaderCell>}
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Node Class</TableHeaderCell>
                  <TableHeaderCell>Data Type</TableHeaderCell>
                  {showValues && <TableHeaderCell>Value</TableHeaderCell>}
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNodes.map((node) => (
                  <TableRow
                    key={node.nodeId}
                    onClick={() => handleNodeClick(node)}
                    className={`
                      cursor-pointer hover:bg-gray-50
                      ${multiSelect && selectedNodes.has(node.nodeId) ? 'bg-blue-50' : ''}
                    `}
                  >
                    {multiSelect && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedNodes.has(node.nodeId)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleNodeSelection(node.nodeId);
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </TableCell>
                    )}
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getNodeIcon(node)}
                        <div>
                          <div className="font-medium text-gray-900">{node.displayName}</div>
                          <div className="text-xs text-gray-500 font-mono">{node.browseName}</div>
                        </div>
                        {node.hasChildren && (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={node.nodeClass === 'Variable' ? 'default' : 'secondary'}>
                        {node.nodeClass}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      {node.dataType && (
                        <span className="text-sm text-gray-600">{node.dataType}</span>
                      )}
                    </TableCell>
                    
                    {showValues && (
                      <TableCell>
                        {node.nodeClass === 'Variable' && (
                          <div className="flex items-center gap-2">
                            {nodeValues.has(node.nodeId) ? (
                              <div className="font-mono text-sm">
                                {formatValue(nodeValues.get(node.nodeId))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                            {loadingValues.has(node.nodeId) && (
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                            )}
                          </div>
                        )}
                      </TableCell>
                    )}
                    
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {node.nodeClass === 'Variable' && showValues && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReadValue(node);
                            }}
                            disabled={loadingValues.has(node.nodeId)}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Empty State */}
          {!loading && filteredNodes.length === 0 && nodes.length > 0 && (
            <div className="text-center py-8">
              <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matching nodes</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </div>
          )}

          {!loading && nodes.length === 0 && (
            <div className="text-center py-8">
              <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No nodes found</h3>
              <p className="text-gray-600">This location appears to be empty</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
