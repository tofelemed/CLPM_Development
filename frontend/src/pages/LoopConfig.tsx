import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Plus, 
  Settings, 
  Gauge, 
  Tag,
  Activity,
  BarChart3,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import LoopConfiguration from '../components/LoopConfiguration';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/v1';

interface Loop {
  id: string;
  name: string;
  description: string;
  importance: number;
  pv_tag: string;
  op_tag: string;
  sp_tag: string;
  mode_tag: string;
  valve_tag?: string;
  created_at: string;
  status: 'active' | 'inactive' | 'maintenance';
}

interface LoopConfig {
  loop_id: string;
  sf_low: number;
  sf_high: number;
  sat_high: number;
  rpi_low: number;
  rpi_high: number;
  osc_limit: number;
  kpi_window: number;
  importance: number;
  sampling_interval: number;
}

const LoopConfig: React.FC = () => {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loopConfigs, setLoopConfigs] = useState<{[key: string]: LoopConfig}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadLoops();
    loadLoopConfigs();
  }, []);

  const loadLoops = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/loops`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLoops(data.loops || []);
      } else {
        throw new Error('Failed to load loops');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadLoopConfigs = async () => {
    try {
      const configs: {[key: string]: LoopConfig} = {};
      
      for (const loop of loops) {
        const response = await fetch(`${API}/loops/${loop.id}/config`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const config = await response.json();
          configs[loop.id] = config;
        }
      }
      
      setLoopConfigs(configs);
    } catch (error) {
      console.error('Failed to load loop configs:', error);
    }
  };

  const getImportanceColor = (importance: number) => {
    if (importance >= 4) return 'bg-red-100 text-red-800';
    if (importance >= 3) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getImportanceLabel = (importance: number) => {
    if (importance >= 4) return 'Critical';
    if (importance >= 3) return 'High';
    return 'Low';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleConfigUpdate = () => {
    loadLoops();
    loadLoopConfigs();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-2">Error loading loops</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <Button onClick={loadLoops} className="mt-4">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loop Configuration</h1>
          <p className="text-gray-600">Manage control loops and their OPC UA tag mappings</p>
        </div>
        <Button 
          onClick={() => setShowConfigModal(true)}
          className="inline-flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Configure Loops
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loops</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loops.length}</div>
            <p className="text-xs text-muted-foreground">
              Configured control loops
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loops</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loops.filter(l => l.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Loops</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loops.filter(l => l.importance >= 4).length}
            </div>
            <p className="text-xs text-muted-foreground">
              High importance level
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Configured</CardTitle>
            <Settings className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {Object.keys(loopConfigs).length}
            </div>
            <p className="text-xs text-muted-foreground">
              With KPI settings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Control Loop Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loops.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Gauge className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No control loops configured</p>
                  <p className="text-sm">Click "Configure Loops" to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {loops.map((loop) => (
                    <div key={loop.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold">{loop.name}</h3>
                            <Badge className={getImportanceColor(loop.importance)}>
                              {getImportanceLabel(loop.importance)}
                            </Badge>
                            <Badge className={getStatusColor(loop.status)}>
                              {loop.status}
                            </Badge>
                          </div>
                          
                          <p className="text-gray-600 mb-3">{loop.description}</p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-500">PV Tag:</span>
                              <p className="font-mono text-xs bg-gray-100 p-1 rounded truncate">{loop.pv_tag}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">OP Tag:</span>
                              <p className="font-mono text-xs bg-gray-100 p-1 rounded truncate">{loop.op_tag}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">SP Tag:</span>
                              <p className="font-mono text-xs bg-gray-100 p-1 rounded truncate">{loop.sp_tag}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Mode Tag:</span>
                              <p className="font-mono text-xs bg-gray-100 p-1 rounded truncate">{loop.mode_tag}</p>
                            </div>
                            {loop.valve_tag && (
                              <div>
                                <span className="font-medium text-gray-500">Valve Tag:</span>
                                <p className="font-mono text-xs bg-gray-100 p-1 rounded truncate">{loop.valve_tag}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right text-sm text-gray-500">
                            Created: {new Date(loop.created_at).toLocaleDateString()}
                          </div>
                          
                          {loopConfigs[loop.id] && (
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Configured
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                KPI Configuration Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(loopConfigs).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No KPI configurations found</p>
                  <p className="text-sm">Configure loops to set KPI thresholds and monitoring parameters</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(loopConfigs).map(([loopId, config]) => {
                    const loop = loops.find(l => l.id === loopId);
                    if (!loop) return null;
                    
                    return (
                      <div key={loopId} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-md font-medium">{loop.name}</h4>
                          <Badge variant="outline" className="text-green-600">
                            Configured
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-500">Service Factor:</span>
                            <p className="font-semibold">{config.sf_low} - {config.sf_high}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Saturation:</span>
                            <p className="font-semibold">≤ {config.sat_high}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">RPI Range:</span>
                            <p className="font-semibold">{config.rpi_low} - {config.rpi_high}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Oscillation:</span>
                            <p className="font-semibold">≤ {config.osc_limit}</p>
                          </div>
                        </div>
                        
                        <div className="mt-3 text-xs text-gray-500">
                          Sampling: {config.sampling_interval}ms | KPI Window: {config.kpi_window} minutes
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Monitoring & Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Monitoring dashboard coming soon</p>
                <p className="text-sm">Real-time KPI monitoring and alert management</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configuration Modal */}
      {showConfigModal && (
        <LoopConfiguration
          open={showConfigModal}
          onClose={() => {
            setShowConfigModal(false);
            handleConfigUpdate();
          }}
        />
      )}
    </div>
  );
};

export default LoopConfig;
