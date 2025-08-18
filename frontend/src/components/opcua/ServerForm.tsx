import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, TestTube2, Shield, User, Key } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectOption } from '../ui/select';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ServerConfig, SecurityPolicy, MessageSecurityMode } from '../../types/opcua';
import { useOPCUASecurity } from '../../hooks/useOPCUA';

interface ServerFormProps {
  server?: ServerConfig | null;
  onSubmit: (data: Omit<ServerConfig, 'id'> | Partial<ServerConfig>) => Promise<void>;
  onCancel: () => void;
}

interface FormData {
  name: string;
  endpointUrl: string;
  securityPolicy: string;
  securityMode: string;
  userAuthMethod: 'anonymous' | 'username' | 'certificate';
  username: string;
  password: string;
  trustUnknownCerts: boolean;
  samplingInterval: number;
  maxSessionSubscriptions: number;
  enabled: boolean;
}

const SECURITY_POLICIES: SelectOption[] = [
  { value: 'http://opcfoundation.org/UA/SecurityPolicy#None', label: 'None' },
  { value: 'http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15', label: 'Basic128Rsa15' },
  { value: 'http://opcfoundation.org/UA/SecurityPolicy#Basic256', label: 'Basic256' },
  { value: 'http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256', label: 'Basic256Sha256' },
  { value: 'http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep', label: 'Aes128Sha256RsaOaep' },
  { value: 'http://opcfoundation.org/UA/SecurityPolicy#Aes256_Sha256_RsaPss', label: 'Aes256Sha256RsaPss' },
];

const SECURITY_MODES: SelectOption[] = [
  { value: 'None', label: 'None' },
  { value: 'Sign', label: 'Sign' },
  { value: 'SignAndEncrypt', label: 'SignAndEncrypt' },
];

const AUTH_METHODS: SelectOption[] = [
  { value: 'anonymous', label: 'Anonymous' },
  { value: 'username', label: 'Username/Password' },
  { value: 'certificate', label: 'Certificate' },
];

export const ServerForm: React.FC<ServerFormProps> = ({ server, onSubmit, onCancel }) => {
  const { securityOptions, discoverSecurity, testConnection, loading: securityLoading } = useOPCUASecurity();
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    endpointUrl: '',
    securityPolicy: 'http://opcfoundation.org/UA/SecurityPolicy#None',
    securityMode: 'None',
    userAuthMethod: 'anonymous',
    username: '',
    password: '',
    trustUnknownCerts: true,
    samplingInterval: 1000,
    maxSessionSubscriptions: 10,
    enabled: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Initialize form with server data if editing
  useEffect(() => {
    if (server) {
      setFormData({
        name: server.name,
        endpointUrl: server.endpointUrl,
        securityPolicy: server.securityPolicy,
        securityMode: server.securityMode,
        userAuthMethod: server.userAuthMethod,
        username: server.username || '',
        password: server.password || '',
        trustUnknownCerts: server.trustUnknownCerts,
        samplingInterval: server.samplingInterval,
        maxSessionSubscriptions: server.maxSessionSubscriptions,
        enabled: server.enabled,
      });
    }
  }, [server]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Server name is required';
    }

    if (!formData.endpointUrl.trim()) {
      newErrors.endpointUrl = 'Endpoint URL is required';
    } else if (!formData.endpointUrl.startsWith('opc.tcp://')) {
      newErrors.endpointUrl = 'Endpoint URL must start with opc.tcp://';
    }

    if (formData.userAuthMethod === 'username' && !formData.username.trim()) {
      newErrors.username = 'Username is required for username authentication';
    }

    if (formData.samplingInterval < 100) {
      newErrors.samplingInterval = 'Sampling interval must be at least 100ms';
    }

    if (formData.maxSessionSubscriptions < 1) {
      newErrors.maxSessionSubscriptions = 'Must allow at least 1 subscription';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const serverData: Omit<ServerConfig, 'id'> = {
        name: formData.name,
        endpointUrl: formData.endpointUrl,
        securityPolicy: formData.securityPolicy as SecurityPolicy,
        securityMode: formData.securityMode as MessageSecurityMode,
        userAuthMethod: formData.userAuthMethod,
        username: formData.userAuthMethod === 'username' ? formData.username : undefined,
        password: formData.userAuthMethod === 'username' ? formData.password : undefined,
        trustUnknownCerts: formData.trustUnknownCerts,
        samplingInterval: formData.samplingInterval,
        maxSessionSubscriptions: formData.maxSessionSubscriptions,
        redundantEndpoints: [],
        enabled: formData.enabled,
      };

      await onSubmit(serverData);
    } catch (error) {
      // Error handling is done by parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscoverSecurity = async () => {
    if (!formData.endpointUrl.trim()) {
      setErrors(prev => ({ ...prev, endpointUrl: 'Enter endpoint URL first' }));
      return;
    }

    try {
      await discoverSecurity(formData.endpointUrl);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleTestConnection = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const result = await testConnection({
        name: formData.name,
        endpointUrl: formData.endpointUrl,
        securityPolicy: formData.securityPolicy as SecurityPolicy,
        securityMode: formData.securityMode as MessageSecurityMode,
        userAuthMethod: formData.userAuthMethod,
        username: formData.userAuthMethod === 'username' ? formData.username : undefined,
        password: formData.userAuthMethod === 'username' ? formData.password : undefined,
        trustUnknownCerts: formData.trustUnknownCerts,
        samplingInterval: formData.samplingInterval,
        maxSessionSubscriptions: formData.maxSessionSubscriptions,
        redundantEndpoints: [],
        enabled: formData.enabled,
      });
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: 'Connection test failed' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Server Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Server Name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={errors.name}
                placeholder="My OPC UA Server"
                required
              />

              <div className="space-y-2">
                <Input
                  label="Endpoint URL"
                  value={formData.endpointUrl}
                  onChange={(e) => handleInputChange('endpointUrl', e.target.value)}
                  error={errors.endpointUrl}
                  placeholder="opc.tcp://localhost:4840"
                  required
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDiscoverSecurity}
                    disabled={securityLoading || !formData.endpointUrl.trim()}
                    className="flex items-center gap-1"
                  >
                    <Shield className="w-3 h-3" />
                    Discover Security
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={!formData.endpointUrl.trim()}
                    className="flex items-center gap-1"
                  >
                    <TestTube2 className="w-3 h-3" />
                    Test Connection
                  </Button>
                </div>
              </div>

              {testResult && (
                <div className={`p-3 rounded-md ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? '✓' : '✗'}
                    <span>{testResult.message}</span>
                  </div>
                </div>
              )}

              {securityOptions.length > 0 && (
                <Card className="bg-blue-50">
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-blue-900 mb-2">Discovered Security Options:</h4>
                    <div className="space-y-2">
                      {securityOptions.map((option, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white rounded text-sm">
                          <div>
                            <span className="font-medium">{option.securityMode}</span>
                            <span className="text-gray-500 ml-2">
                              {option.securityPolicy.split('#')[1] || 'None'}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleInputChange('securityMode', option.securityMode);
                              handleInputChange('securityPolicy', option.securityPolicy);
                            }}
                          >
                            Use
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => handleInputChange('enabled', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable server</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Security Policy"
                value={formData.securityPolicy}
                onChange={(e) => handleInputChange('securityPolicy', e.target.value)}
                options={SECURITY_POLICIES}
                required
              />

              <Select
                label="Security Mode"
                value={formData.securityMode}
                onChange={(e) => handleInputChange('securityMode', e.target.value)}
                options={SECURITY_MODES}
                required
              />

              <Select
                label="Authentication Method"
                value={formData.userAuthMethod}
                onChange={(e) => handleInputChange('userAuthMethod', e.target.value)}
                options={AUTH_METHODS}
                required
              />

              {formData.userAuthMethod === 'username' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    User Credentials
                  </h4>
                  
                  <Input
                    label="Username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    error={errors.username}
                    placeholder="Enter username"
                    required
                  />

                  <div className="relative">
                    <Input
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="Enter password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-8"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {formData.userAuthMethod === 'certificate' && (
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-900 flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Certificate Authentication
                  </h4>
                  <p className="text-sm text-yellow-700 mt-2">
                    Certificate authentication is not yet implemented in this interface. 
                    Please configure certificates through the backend API.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.trustUnknownCerts}
                    onChange={(e) => handleInputChange('trustUnknownCerts', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Trust unknown certificates</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Default Sampling Interval (ms)"
                type="number"
                value={formData.samplingInterval}
                onChange={(e) => handleInputChange('samplingInterval', parseInt(e.target.value) || 1000)}
                error={errors.samplingInterval}
                min={100}
                helperText="Minimum time between data samples"
              />

              <Input
                label="Max Session Subscriptions"
                type="number"
                value={formData.maxSessionSubscriptions}
                onChange={(e) => handleInputChange('maxSessionSubscriptions', parseInt(e.target.value) || 10)}
                error={errors.maxSessionSubscriptions}
                min={1}
                helperText="Maximum number of subscriptions per session"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : server ? 'Update Server' : 'Create Server'}
        </Button>
      </div>
    </form>
  );
};
