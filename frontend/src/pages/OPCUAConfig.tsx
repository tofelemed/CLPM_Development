import React, { useState } from 'react';
import { Settings, Activity, Tag, Server } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ServerManager } from '../components/opcua/ServerManager';
import { TagBrowser } from '../components/opcua/TagBrowser';
import { HealthDashboard } from '../components/opcua/HealthDashboard';
import { useOPCUAServers } from '../hooks/useOPCUA';

export const OPCUAConfig: React.FC = () => {
  const { servers } = useOPCUAServers();
  const [selectedServerId, setSelectedServerId] = useState<string>('');

  // Auto-select first server if none selected
  React.useEffect(() => {
    if (!selectedServerId && servers.length > 0) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers, selectedServerId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                OPC UA Configuration
              </h1>
              <p className="text-gray-600 mt-1">
                Manage OPC UA server connections, browse tags, and monitor system health
              </p>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <Tabs defaultValue="servers" className="w-full">
            <div className="border-b border-gray-200 px-6 pt-6">
              <TabsList className="grid w-full max-w-md grid-cols-4 bg-gray-100 p-1 rounded-lg">
                <TabsTrigger 
                  value="servers" 
                  className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                >
                  <Server className="w-4 h-4" />
                  Servers
                </TabsTrigger>
                <TabsTrigger 
                  value="browser" 
                  className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                >
                  <Tag className="w-4 h-4" />
                  Browser
                </TabsTrigger>
                <TabsTrigger 
                  value="health" 
                  className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                >
                  <Activity className="w-4 h-4" />
                  Health
                </TabsTrigger>
                <TabsTrigger 
                  value="settings" 
                  className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Server Management Tab */}
            <TabsContent value="servers" className="p-6">
              <ServerManager />
            </TabsContent>

            {/* Tag Browser Tab */}
            <TabsContent value="browser" className="p-6">
              <div className="space-y-6">
                {/* Server Selector */}
                {servers.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <label className="text-sm font-medium text-blue-900">
                        Browse server:
                      </label>
                      <select
                        value={selectedServerId}
                        onChange={(e) => setSelectedServerId(e.target.value)}
                        className="px-3 py-2 border border-blue-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select a server</option>
                        {servers.map((server) => (
                          <option key={server.id} value={server.id}>
                            {server.name} ({server.endpointUrl})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <TagBrowser 
                  serverId={selectedServerId || undefined}
                  multiSelect={true}
                  showValues={true}
                />
              </div>
            </TabsContent>

            {/* Health Dashboard Tab */}
            <TabsContent value="health" className="p-6">
              <HealthDashboard />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Global Settings */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Global Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Sampling Interval (ms)
                    </label>
                    <input
                      type="number"
                      defaultValue={1000}
                      min={100}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Health Check Interval (ms)
                    </label>
                    <input
                      type="number"
                      defaultValue={10000}
                      min={1000}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoReconnect"
                      defaultChecked
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="autoReconnect" className="text-sm font-medium text-gray-700">
                      Enable automatic reconnection
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="trustUnknown"
                      defaultChecked
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="trustUnknown" className="text-sm font-medium text-gray-700">
                      Trust unknown certificates by default
                    </label>
                  </div>
                </div>
              </div>

              {/* Certificate Management */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Certificate Management
                </h3>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Manage trusted and rejected certificates for OPC UA connections.
                  </p>
                  
                  <div className="space-y-2">
                    <button className="w-full px-4 py-2 text-left text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors">
                      View Trusted Certificates
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors">
                      View Rejected Certificates
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm font-medium text-yellow-600 bg-yellow-50 rounded-md hover:bg-yellow-100 transition-colors">
                      View Expiring Certificates
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Export */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Data Export
                </h3>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Export server configurations and monitoring data.
                  </p>
                  
                  <div className="space-y-2">
                    <button className="w-full px-4 py-2 text-left text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors">
                      Export Server Configurations
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors">
                      Export Health Metrics
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors">
                      Export Connection Logs
                    </button>
                  </div>
                </div>
              </div>

              {/* System Information */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  System Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">OPC UA Client Version:</span>
                    <span className="text-sm font-medium">1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Node OPC UA Version:</span>
                    <span className="text-sm font-medium">2.118.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">API Base URL:</span>
                    <span className="text-sm font-medium font-mono">{import.meta.env.VITE_OPCUA_API_BASE}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Environment:</span>
                    <span className="text-sm font-medium">
                      {import.meta.env.MODE === 'development' ? 'Development' : 'Production'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
