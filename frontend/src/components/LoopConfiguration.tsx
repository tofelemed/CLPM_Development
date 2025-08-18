import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Settings, 
  Gauge, 
  Tag,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';
import { TagBrowser } from './opcua/TagBrowser';

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
  updated_at?: string;
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
  alarm_thresholds: {
    service_factor_low: number;
    pi_low: number;
    oscillation_high: number;
    stiction_high: number;
  };
}

interface OPCUAServer {
  id: string;
  name: string;
  endpointUrl: string;
  enabled: boolean;
  status?: string;
}

interface LoopSubscription {
  loopId: string;
  serverId: string;
  enabled: boolean;
  tags: {
    pv: {
      nodeId: string;
      samplingInterval: number;
      queueSize?: number;
    };
    op: {
      nodeId: string;
      samplingInterval: number;
      queueSize?: number;
    };
    sp: {
      nodeId: string;
      samplingInterval: number;
      queueSize?: number;
    };
    mode: {
      nodeId: string;
      samplingInterval: number;
      queueSize?: number;
    };
    valve?: {
      nodeId: string;
      samplingInterval: number;
      queueSize?: number;
    };
  };
}

interface LoopConfigurationProps {
  open: boolean;
  onClose: () => void;
}

const LoopConfiguration: React.FC<LoopConfigurationProps> = ({ open, onClose }) => {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loopConfigs, setLoopConfigs] = useState<{[key: string]: LoopConfig}>({});
  const [opcuaServers, setOpcuaServers] = useState<OPCUAServer[]>([]);
  const [loopSubscriptions, setLoopSubscriptions] = useState<{[key: string]: LoopSubscription}>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLoop, setEditingLoop] = useState<Loop | null>(null);
  const [loading, setLoading] = useState(false);
  const [tagBrowserOpen, setTagBrowserOpen] = useState(false);
  const [currentTagType, setCurrentTagType] = useState<'pv' | 'op' | 'sp' | 'mode' | 'valve'>('pv');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    importance: 3,
    pv_tag: '',
    op_tag: '',
    sp_tag: '',
    mode_tag: '',
    valve_tag: '',
    sampling_interval: 200,
    opcua_server_id: ''
  });

  // Configuration form state
  const [configFormData, setConfigFormData] = useState({
    sf_low: 0.8,
    sf_high: 0.95,
    sat_high: 0.2,
    rpi_low: 0.7,
    rpi_high: 0.9,
    osc_limit: 0.3,
    kpi_window: 1440,
    importance: 3,
    sampling_interval: 200,
    alarm_thresholds: {
      service_factor_low: 0.75,
      pi_low: 0.65,
      oscillation_high: 0.4,
      stiction_high: 0.5
    }
  });

  useEffect(() => {
    if (open) {
      loadLoops();
      loadLoopConfigs();
      loadOPCUAServers();
      loadLoopSubscriptions();
    }
  }, [open]);

  const loadLoops = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_BASE}/loops`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLoops(data.loops || []);
      }
    } catch (error) {
      console.error('Failed to load loops:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLoopConfigs = async () => {
    try {
      const configs: {[key: string]: LoopConfig} = {};
      
      for (const loop of loops) {
        const response = await fetch(`${import.meta.env.VITE_API_BASE}/loops/${loop.id}/config`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const config = await response.json();
          if (config) { // Only add if config exists
            configs[loop.id] = config;
          }
        }
      }
      
      setLoopConfigs(configs);
    } catch (error) {
      console.error('Failed to load loop configs:', error);
    }
  };

  const loadOPCUAServers = async () => {
    try {
      const response = await fetch('/opcua-direct/api/v1/servers');
      if (response.ok) {
        const servers = await response.json();
        setOpcuaServers(servers);
      }
    } catch (error) {
      console.error('Failed to load OPC UA servers:', error);
    }
  };

  const loadLoopSubscriptions = async () => {
    try {
      const response = await fetch('/opcua-direct/api/v1/loops');
      if (response.ok) {
        const subscriptions = await response.json();
        const subscriptionsMap: {[key: string]: LoopSubscription} = {};
        subscriptions.forEach((sub: LoopSubscription) => {
          subscriptionsMap[sub.loopId] = sub;
        });
        setLoopSubscriptions(subscriptionsMap);
      }
    } catch (error) {
      console.error('Failed to load loop subscriptions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const url = editingLoop 
        ? `${import.meta.env.VITE_API_BASE}/loops/${editingLoop.id}`
        : `${import.meta.env.VITE_API_BASE}/loops`;
      
      const method = editingLoop ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const savedLoop = await response.json();
        
        // Save configuration
        await saveLoopConfig(savedLoop.id);
        
        // Save OPC UA subscription if server is selected
        if (formData.opcua_server_id) {
          await saveOPCUASubscription(savedLoop.id);
        }
        
        setShowAddForm(false);
        setEditingLoop(null);
        resetForm();
        await loadLoops();
        await loadLoopConfigs();
        await loadLoopSubscriptions();
      } else {
        const error = await response.json();
        alert(`Failed to save loop: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to save loop:', error);
      alert('Failed to save loop');
    } finally {
      setLoading(false);
    }
  };

  const saveLoopConfig = async (loopId: string) => {
    try {
      const method = editingLoop ? 'PUT' : 'POST';
      const response = await fetch(`${import.meta.env.VITE_API_BASE}/loops/${loopId}/config`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(configFormData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.warn(`Failed to save loop configuration: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to save loop configuration:', error);
    }
  };

  const saveOPCUASubscription = async (loopId: string) => {
    try {
      const subscription: LoopSubscription = {
        loopId: loopId,
        serverId: formData.opcua_server_id,
        enabled: true,
        tags: {
          pv: {
            nodeId: formData.pv_tag,
            samplingInterval: formData.sampling_interval,
            queueSize: 10
          },
          op: {
            nodeId: formData.op_tag,
            samplingInterval: formData.sampling_interval,
            queueSize: 10
          },
          sp: {
            nodeId: formData.sp_tag,
            samplingInterval: formData.sampling_interval,
            queueSize: 10
          },
          mode: {
            nodeId: formData.mode_tag,
            samplingInterval: formData.sampling_interval,
            queueSize: 10
          },
          ...(formData.valve_tag && {
            valve: {
              nodeId: formData.valve_tag,
              samplingInterval: formData.sampling_interval,
              queueSize: 10
            }
          })
        }
      };

      const method = loopSubscriptions[loopId] ? 'PUT' : 'POST';
      const url = method === 'PUT' 
        ? `/opcua-direct/api/v1/loops/${loopId}` 
        : '/opcua-direct/api/v1/loops';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
      });

      if (!response.ok) {
        const error = await response.json();
        console.warn(`Failed to save OPC UA subscription: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to save OPC UA subscription:', error);
    }
  };

  const handleDelete = async (loopId: string) => {
    if (!confirm('Are you sure you want to delete this loop? This action cannot be undone.')) return;
    
    try {
      setLoading(true);
      
      // Delete from main API
      const response = await fetch(`${import.meta.env.VITE_API_BASE}/loops/${loopId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        // Also delete OPC UA subscription if it exists
        if (loopSubscriptions[loopId]) {
          try {
            await fetch(`/opcua-direct/api/v1/loops/${loopId}`, {
              method: 'DELETE'
            });
          } catch (error) {
            console.warn('Failed to delete OPC UA subscription:', error);
          }
        }
        
        await loadLoops();
        await loadLoopConfigs();
        await loadLoopSubscriptions();
      } else {
        const error = await response.json();
        alert(`Failed to delete loop: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete loop:', error);
      alert('Failed to delete loop');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (loop: Loop) => {
    setEditingLoop(loop);
    
    // Get the OPC UA subscription for this loop
    const subscription = loopSubscriptions[loop.id];
    
    setFormData({
      name: loop.name,
      description: loop.description,
      importance: loop.importance,
      pv_tag: loop.pv_tag,
      op_tag: loop.op_tag,
      sp_tag: loop.sp_tag,
      mode_tag: loop.mode_tag,
      valve_tag: loop.valve_tag || '',
      sampling_interval: subscription?.tags.pv.samplingInterval || 200,
      opcua_server_id: subscription?.serverId || ''
    });
    
    // Load existing configuration
    if (loopConfigs[loop.id]) {
      const config = loopConfigs[loop.id];
      setConfigFormData({
        sf_low: config.sf_low,
        sf_high: config.sf_high,
        sat_high: config.sat_high,
        rpi_low: config.rpi_low,
        rpi_high: config.rpi_high,
        osc_limit: config.osc_limit,
        kpi_window: config.kpi_window,
        importance: config.importance,
        sampling_interval: config.sampling_interval,
        alarm_thresholds: config.alarm_thresholds
      });
    }
    
    setShowAddForm(true);
  };

  const handleTagSelect = (tag: any) => {
    setFormData(prev => ({
      ...prev,
      [currentTagType + '_tag']: tag.nodeId
    }));
    setTagBrowserOpen(false);
  };

  const openTagBrowser = (tagType: 'pv' | 'op' | 'sp' | 'mode' | 'valve') => {
    setCurrentTagType(tagType);
    setTagBrowserOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      importance: 3,
      pv_tag: '',
      op_tag: '',
      sp_tag: '',
      mode_tag: '',
      valve_tag: '',
      sampling_interval: 200,
      opcua_server_id: ''
    });
    
    setConfigFormData({
      sf_low: 0.8,
      sf_high: 0.95,
      sat_high: 0.2,
      rpi_low: 0.7,
      rpi_high: 0.9,
      osc_limit: 0.3,
      kpi_window: 1440,
      importance: 3,
      sampling_interval: 200,
      alarm_thresholds: {
        service_factor_low: 0.75,
        pi_low: 0.65,
        oscillation_high: 0.4,
        stiction_high: 0.5
      }
    });
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
                Loop Configuration Management
              </h3>
              <button
                onClick={onClose}
                className="rounded-md text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Loop List */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-900">Control Loops</h4>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Loop
                </button>
              </div>

              {loading ? (
                <div className="text-center py-4">
                  <Clock className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                  <p className="text-gray-500 mt-2">Loading loops...</p>
                </div>
              ) : loops.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Gauge className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No control loops configured</p>
                  <p className="text-sm">Click "Add Loop" to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {loops.map((loop) => (
                    <div key={loop.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h5 className="text-sm font-medium text-gray-900">{loop.name}</h5>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getImportanceColor(loop.importance)}`}>
                              {getImportanceLabel(loop.importance)}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(loop.status)}`}>
                              {loop.status}
                            </span>
                            {loopSubscriptions[loop.id] && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                OPC UA
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mb-3">{loop.description}</p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                            <div>
                              <span className="font-medium text-gray-500">PV:</span>
                              <p className="font-mono bg-gray-100 p-1 rounded truncate">{loop.pv_tag}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">OP:</span>
                              <p className="font-mono bg-gray-100 p-1 rounded truncate">{loop.op_tag}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">SP:</span>
                              <p className="font-mono bg-gray-100 p-1 rounded truncate">{loop.sp_tag}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Mode:</span>
                              <p className="font-mono bg-gray-100 p-1 rounded truncate">{loop.mode_tag}</p>
                            </div>
                            {loop.valve_tag && (
                              <div>
                                <span className="font-medium text-gray-500">Valve:</span>
                                <p className="font-mono bg-gray-100 p-1 rounded truncate">{loop.valve_tag}</p>
                              </div>
                            )}
                          </div>
                          
                          {/* OPC UA Server Info */}
                          {loopSubscriptions[loop.id] && (
                            <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
                              <span className="font-medium text-blue-700">OPC UA Server: </span>
                              <span className="text-blue-600">
                                {opcuaServers.find(s => s.id === loopSubscriptions[loop.id].serverId)?.name || 'Unknown Server'}
                              </span>
                              <span className="ml-2 text-blue-500">
                                ({loopSubscriptions[loop.id].serverId})
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => handleEdit(loop)}
                            className="p-2 text-gray-400 hover:text-blue-600"
                            title="Edit Loop"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDelete(loop.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                            title="Delete Loop"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
              <div className="border-t pt-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">
                  {editingLoop ? 'Edit Loop' : 'Add New Loop'}
                </h4>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Loop Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Importance Level</label>
                      <select
                        value={formData.importance}
                        onChange={(e) => setFormData({...formData, importance: parseInt(e.target.value)})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={1}>Very Low (1)</option>
                        <option value={2}>Low (2)</option>
                        <option value={3}>Medium (3)</option>
                        <option value={4}>High (4)</option>
                        <option value={5}>Critical (5)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  {/* OPC UA Server Selection */}
                  <div className="border-t pt-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      OPC UA Server Selection
                    </h5>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">OPC UA Server</label>
                      <select
                        value={formData.opcua_server_id}
                        onChange={(e) => setFormData({...formData, opcua_server_id: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">No OPC UA Server (Manual Tags Only)</option>
                        {opcuaServers.map(server => (
                          <option key={server.id} value={server.id}>
                            {server.name} - {server.endpointUrl}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-sm text-gray-500">
                        Select an OPC UA server to enable tag browsing and automatic data collection
                      </p>
                    </div>
                  </div>

                  {/* OPC UA Tag Configuration */}
                  <div className="border-t pt-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <Tag className="h-4 w-4 mr-2" />
                      OPC UA Tag Configuration
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Process Variable (PV) Tag</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="text"
                            value={formData.pv_tag}
                            onChange={(e) => setFormData({...formData, pv_tag: e.target.value})}
                            placeholder="ns=2;s=Temperature.PV"
                            className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => openTagBrowser('pv')}
                            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100"
                          >
                            <Tag className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Output (OP) Tag</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="text"
                            value={formData.op_tag}
                            onChange={(e) => setFormData({...formData, op_tag: e.target.value})}
                            placeholder="ns=2;s=Temperature.OP"
                            className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => openTagBrowser('op')}
                            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100"
                          >
                            <Tag className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Setpoint (SP) Tag</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="text"
                            value={formData.sp_tag}
                            onChange={(e) => setFormData({...formData, sp_tag: e.target.value})}
                            placeholder="ns=2;s=Temperature.SP"
                            className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => openTagBrowser('sp')}
                            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100"
                          >
                            <Tag className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Mode Tag</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="text"
                            value={formData.mode_tag}
                            onChange={(e) => setFormData({...formData, mode_tag: e.target.value})}
                            placeholder="ns=2;s=Temperature.MODE"
                            className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => openTagBrowser('mode')}
                            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100"
                          >
                            <Tag className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Valve Tag (Optional)</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="text"
                            value={formData.valve_tag}
                            onChange={(e) => setFormData({...formData, valve_tag: e.target.value})}
                            placeholder="ns=2;s=Temperature.VALVE"
                            className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => openTagBrowser('valve')}
                            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100"
                          >
                            <Tag className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KPI Configuration */}
                  <div className="border-t pt-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      KPI Configuration
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Service Factor Low</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={configFormData.sf_low}
                          onChange={(e) => setConfigFormData({...configFormData, sf_low: parseFloat(e.target.value)})}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Service Factor High</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={configFormData.sf_high}
                          onChange={(e) => setConfigFormData({...configFormData, sf_high: parseFloat(e.target.value)})}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Saturation High</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={configFormData.sat_high}
                          onChange={(e) => setConfigFormData({...configFormData, sat_high: parseFloat(e.target.value)})}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">RPI Low</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={configFormData.rpi_low}
                          onChange={(e) => setConfigFormData({...configFormData, rpi_low: parseFloat(e.target.value)})}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">RPI High</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={configFormData.rpi_high}
                          onChange={(e) => setConfigFormData({...configFormData, rpi_high: parseFloat(e.target.value)})}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Oscillation Limit</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={configFormData.osc_limit}
                          onChange={(e) => setConfigFormData({...configFormData, osc_limit: parseFloat(e.target.value)})}
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
                        setEditingLoop(null);
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
                        <Clock className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {editingLoop ? 'Update' : 'Create'} Loop
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tag Browser Modal */}
      <TagBrowser
        serverId={formData.opcua_server_id}
        onTagSelect={handleTagSelect}
        multiSelect={false}
        showValues={false}
      />
    </div>
  );
};

export default LoopConfiguration;
