import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  Activity, 
  BarChart3, 
  FileText, 
  Users, 
  Shield,
  Cog,
  Database,
  Network,
  Gauge,
  Tag
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OPCUATagBrowser from './OPCUATagBrowser';
import OPCUAConnectionManager from './OPCUAConnectionManager';
import LoopConfiguration from './LoopConfiguration';

// Main App Shell Component
const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <Router>
      


      <div className="min-h-screen bg-gray-50">
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}>
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">CLPM</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="px-4 py-6 space-y-2">
            <NavLink to="/dashboard" icon={LayoutDashboard}>
              Dashboard
            </NavLink>
            
            <NavLink to="/loops" icon={Activity}>
              Control Loops
            </NavLink>
            
            <NavLink to="/kpis" icon={BarChart3}>
              KPIs & Analytics
            </NavLink>
            
            <NavLink to="/diagnostics" icon={FileText}>
              Diagnostics
            </NavLink>
            
            <NavLink to="/reports" icon={FileText}>
              Reports
            </NavLink>

            {/* Configuration Section - Admin Only */}
            {user.role === 'admin' && (
              <>
                <div className="pt-6 pb-2">
                  <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Configuration
                  </h3>
                </div>
                
                <NavLink to="/config/opcua" icon={Network}>
                  OPC UA Settings
                </NavLink>
                
                <NavLink to="/config/loops" icon={Gauge}>
                  Loop Configuration
                </NavLink>
                
                <NavLink to="/config/tags" icon={Tag}>
                  Tag Browser
                </NavLink>
                
                <NavLink to="/config/system" icon={Cog}>
                  System Settings
                </NavLink>
              </>
            )}

            {/* User Management - Admin Only */}
            {user.role === 'admin' && (
              <>
                <div className="pt-6 pb-2">
                  <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Administration
                  </h3>
                </div>
                
                <NavLink to="/admin/users" icon={Users}>
                  User Management
                </NavLink>
                
                <NavLink to="/admin/security" icon={Shield}>
                  Security Settings
                </NavLink>
                
                <NavLink to="/admin/database" icon={Database}>
                  Database Admin
                </NavLink>
              </>
            )}
          </nav>

          {/* User Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user.role}
                </p>
              </div>
              <button
                onClick={logout}
                className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600"
                title="Logout"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="lg:pl-64">
          {/* Top bar */}
          <div className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-200">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div className="flex-1 px-4 lg:px-0">
                <PageTitle />
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Notifications */}
                <button className="p-2 rounded-md text-gray-400 hover:text-gray-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/loops" element={<LoopsPage />} />
                <Route path="/kpis" element={<KPIsPage />} />
                <Route path="/diagnostics" element={<DiagnosticsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                
                {/* Configuration Routes - Admin Only */}
                <Route path="/config/opcua" element={<OPCUAConfigPage />} />
                <Route path="/config/loops" element={<LoopConfigPage />} />
                <Route path="/config/tags" element={<TagBrowserPage />} />
                <Route path="/config/system" element={<SystemConfigPage />} />
                
                {/* Admin Routes */}
                <Route path="/admin/users" element={<UserManagementPage />} />
                <Route path="/admin/security" element={<SecurityPage />} />
                <Route path="/admin/database" element={<DatabaseAdminPage />} />
                
                {/* Default redirect */}
                <Route path="/" element={<Dashboard />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
};

// Navigation Link Component
const NavLink: React.FC<{ to: string; icon: React.ComponentType<any>; children: React.ReactNode }> = ({ 
  to, 
  icon: Icon, 
  children 
}) => {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
  
  return (
    <Link
      to={to}
      className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{children}</span>
    </Link>
  );
};

// Page Title Component
const PageTitle: React.FC = () => {
  const location = useLocation();
  
  const getPageTitle = (pathname: string) => {
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname === '/loops') return 'Control Loops';
    if (pathname === '/kpis') return 'KPIs & Analytics';
    if (pathname === '/diagnostics') return 'Diagnostics';
    if (pathname === '/reports') return 'Reports';
    if (pathname === '/config/opcua') return 'OPC UA Configuration';
    if (pathname === '/config/loops') return 'Loop Configuration';
    if (pathname === '/config/tags') return 'Tag Browser';
    if (pathname === '/config/system') return 'System Configuration';
    if (pathname === '/admin/users') return 'User Management';
    if (pathname === '/admin/security') return 'Security Settings';
    if (pathname === '/admin/database') return 'Database Administration';
    return 'CLPM';
  };
  
  return (
    <h1 className="text-2xl font-bold text-gray-900">
      {getPageTitle(location.pathname)}
    </h1>
  );
};

// Placeholder Page Components
const Dashboard: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
    <p className="text-gray-600">Welcome to CLPM Dashboard</p>
  </div>
);

const LoopsPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">Control Loops</h2>
    <p className="text-gray-600">Control loop management and monitoring</p>
  </div>
);

const KPIsPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">KPIs & Analytics</h2>
    <p className="text-gray-600">Performance indicators and analytics</p>
  </div>
);

const DiagnosticsPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">Diagnostics</h2>
    <p className="text-gray-600">System diagnostics and analysis</p>
  </div>
);

const ReportsPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">Reports</h2>
    <p className="text-gray-600">Generate and view reports</p>
  </div>
);

const OPCUAConfigPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">OPC UA Configuration</h2>
    <OPCUAConnectionManager open={true} onClose={() => {}} />
  </div>
);

const LoopConfigPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">Loop Configuration</h2>
    <LoopConfiguration open={true} onClose={() => {}} />
  </div>
);

const TagBrowserPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">Tag Browser</h2>
    <OPCUATagBrowser 
      open={true} 
      onClose={() => {}} 
      onTagSelect={() => {}}
      selectedTag={null}
      title="OPC UA Tag Browser"
    />
  </div>
);

const SystemConfigPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">System Configuration</h2>
    <p className="text-gray-600">System-wide configuration settings</p>
  </div>
);

const UserManagementPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">User Management</h2>
    <p className="text-gray-600">Manage users and permissions</p>
  </div>
);

const SecurityPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">Security Settings</h2>
    <p className="text-gray-600">Configure security policies and authentication</p>
  </div>
);

const DatabaseAdminPage: React.FC = () => (
  <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-xl font-semibold mb-4">Database Administration</h2>
    <p className="text-gray-600">Database management and maintenance</p>
  </div>
);

export default AppShell;
