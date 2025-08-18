import React from 'react';
import { 
  Activity, 
  Server, 
  Database, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  TrendingUp,
  Cpu,
  HardDrive,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useOPCUAHealth } from '../../hooks/useOPCUA';

export const HealthDashboard: React.FC = () => {
  const { health, loading, error } = useOPCUAHealth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span>{error || 'Failed to load health status'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Healthy</Badge>;
      case 'degraded':
        return <Badge variant="warning" className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Degraded</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Unhealthy</Badge>;
      case 'starting':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Starting</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatUptime = (uptimeMs: number) => {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatMemorySize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-600">Real-time monitoring of OPC UA client status</p>
        </div>
        {getStatusBadge(health.status)}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.status}</div>
            <p className="text-xs text-muted-foreground">
              Uptime: {formatUptime(health.uptime)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {health.connections.connected}
            </div>
            <p className="text-xs text-muted-foreground">
              of {health.connections.total} servers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {health.subscriptions.active}
            </div>
            <p className="text-xs text-muted-foreground">
              of {health.subscriptions.total} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Flow</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {health.dataFlow.samplesPerSecond.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              samples/sec
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {health.connections.connected}
                </div>
                <div className="text-sm text-green-700">Connected</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {health.connections.disconnected}
                </div>
                <div className="text-sm text-gray-700">Disconnected</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {health.connections.failed}
                </div>
                <div className="text-sm text-red-700">Failed</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {health.connections.errors}
                </div>
                <div className="text-sm text-yellow-700">Errors</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">Memory Usage</span>
                </div>
                <span className="text-sm text-gray-600">
                  {health.memory.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${health.memory.percentage}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500">
                {formatMemorySize(health.memory.used)} of {formatMemorySize(health.memory.total)} used
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Flow Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Data Flow Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-xl font-bold text-purple-600">
                  {health.dataFlow.samplesPerSecond.toFixed(1)}
                </div>
                <div className="text-sm text-purple-700">Samples/sec</div>
              </div>
              <div className="text-center p-3 bg-indigo-50 rounded-lg">
                <div className="text-xl font-bold text-indigo-600">
                  {health.dataFlow.batchesPerSecond.toFixed(1)}
                </div>
                <div className="text-sm text-indigo-700">Batches/sec</div>
              </div>
            </div>
            {health.dataFlow.lastSampleTime && (
              <div className="text-xs text-gray-500">
                Last sample: {new Date(health.dataFlow.lastSampleTime).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Certificate Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Certificate Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  {health.certificates.trusted}
                </div>
                <div className="text-sm text-green-700">Trusted</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">
                  {health.certificates.rejected}
                </div>
                <div className="text-sm text-red-700">Rejected</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-600">
                  {health.certificates.revoked}
                </div>
                <div className="text-sm text-gray-700">Revoked</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-xl font-bold text-yellow-600">
                  {health.certificates.expiringSoon}
                </div>
                <div className="text-sm text-yellow-700">Expiring</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Version</div>
              <div className="text-lg font-semibold">{health.version}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Started</div>
              <div className="text-lg font-semibold">
                {new Date(health.timestamp.getTime() - health.uptime).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Last Updated</div>
              <div className="text-lg font-semibold">
                {health.timestamp.toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
