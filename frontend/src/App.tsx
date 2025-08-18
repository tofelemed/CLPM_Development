import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Components
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import LoopConfig from './pages/LoopConfig'
import Dashboard from './pages/Dashboard';
import LoopsList from './pages/LoopsList';
import LoopDetail from './pages/LoopDetail';
import APCAttainment from './pages/APCAttainment';
import OscillationClusters from './pages/OscillationClusters';
import Reports from './pages/Reports';
import { OPCUAConfig } from './pages/OPCUAConfig';
import LoopConfiguration from './pages/LoopConfiguration';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Create theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Admin/Engineer Route Component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin' && user?.role !== 'engineer') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/loops" element={<LoopsList />} />
        <Route path="/loops/:id" element={<LoopDetail />} />
        <Route path="/loops/:id/config" element={
          <AdminRoute>
            <LoopConfig />
          </AdminRoute>
        } />
        <Route path="/apc" element={<APCAttainment />} />
        <Route path="/osc-clusters" element={<OscillationClusters />} />
        <Route path="/reports" element={<Reports />} />
        
        {/* Configuration Routes - Admin/Engineer Only */}
        <Route path="/config/opc" element={
          <AdminRoute>
            <OPCUAConfig />
          </AdminRoute>
        } />
        <Route path="/config/loops" element={
          <AdminRoute>
            <LoopConfiguration />
          </AdminRoute>
        } />
        
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <CssBaseline />
          <AuthProvider>
            <Box sx={{ display: 'flex', minHeight: '100vh' }}>
              <AppContent />
            </Box>
          </AuthProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}