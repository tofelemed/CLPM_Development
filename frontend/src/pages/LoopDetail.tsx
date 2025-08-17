import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Science as ScienceIcon,
  Warning,
  CheckCircle,
  Error,
  Info,
  PlayArrow,
  Refresh,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts';
import axios from 'axios';
import { format, subHours, subMinutes } from 'date-fns';

const API = (import.meta as any).env.VITE_API_BASE || 'http://localhost:8080/api/v1';

interface Loop {
  id: string;
  name: string;
  description: string;
  pvTag: string;
  opTag: string;
  spTag: string;
  importance: number;
  classification: 'normal' | 'oscillating' | 'stiction' | 'deadband';
  serviceFactor: number;
  pi: number;
  rpi: number;
  oscillationIndex: number;
  stictionSeverity: number;
  rootCause?: string;
  lastUpdated: string;
  plantArea: string;
  criticality: 'low' | 'medium' | 'high';
  // Additional KPIs like Honeywell CLPM
  deadband: number;
  saturation: number;
  setpointChanges: number;
  modeChanges: number;
  valveTravel: number;
  settlingTime: number;
  overshoot: number;
  riseTime: number;
  peakError: number;
  integralError: number;
  derivativeError: number;
  controlError: number;
  valveReversals: number;
  noiseLevel: number;
  processGain: number;
  timeConstant: number;
  deadTime: number;
}

interface LoopConfig {
  sf_low: number;
  sf_high: number;
  sat_high: number;
  rpi_low: number;
  rpi_high: number;
  osc_limit: number;
  kpi_window: number;
  importance: number;
}

interface DiagnosticResult {
  timestamp: string;
  classification: string;
  stictionSeverity: number;
  oscillationPeriod: number;
  hurstExponent: number;
  rootCause?: string;
}

interface TrendData {
  timestamp: string;
  pv: number;
  sp: number;
  op: number;
  mode?: string;
  valvePosition?: number;
}

interface KPIData {
  timestamp: string;
  serviceFactor: number;
  pi: number;
  rpi: number;
  oscillationIndex: number;
  stictionIndex: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`loop-tabpanel-${index}`}
      aria-labelledby={`loop-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function LoopDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loop, setLoop] = useState<Loop | null>(null);
  const [config, setConfig] = useState<LoopConfig | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [timeWindow, setTimeWindow] = useState('1h');
  const [kpiWindow, setKpiWindow] = useState('1h');
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLoopData();
    }
  }, [id, timeWindow, kpiWindow]);

  const fetchLoopData = async () => {
      try {
        setLoading(true);
        setError(null);
        
      // Mock data for demo
      const mockLoop: Loop = {
        id: id!,
        name: 'Temperature Control Loop',
        description: 'Reactor temperature control for optimal reaction conditions',
        pvTag: 'TEMP_PV',
        opTag: 'TEMP_OP',
        spTag: 'TEMP_SP',
        importance: 0.9,
        classification: 'normal',
        serviceFactor: 0.85,
        pi: 0.78,
        rpi: 0.82,
        oscillationIndex: 0.12,
        stictionSeverity: 0.05,
        plantArea: 'Reactor Section',
        criticality: 'high',
        lastUpdated: new Date().toISOString(),
        deadband: 0.02,
        saturation: 0.08,
        setpointChanges: 12,
        modeChanges: 3,
        valveTravel: 0.75,
        settlingTime: 45,
        overshoot: 0.05,
        riseTime: 120,
        peakError: 2.3,
        integralError: 15.7,
        derivativeError: 0.8,
        controlError: 1.2,
        valveReversals: 8,
        noiseLevel: 0.03,
        processGain: 1.2,
        timeConstant: 180,
        deadTime: 30
      };

      const mockConfig: LoopConfig = {
        sf_low: 0.6,
        sf_high: 0.9,
        sat_high: 0.95,
        rpi_low: 0.5,
        rpi_high: 0.8,
        osc_limit: 0.3,
        kpi_window: 60,
        importance: 0.9
      };

      // Generate trend data
      const now = Date.now();
      const mockTrendData: TrendData[] = Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(now - (60 - i) * 60000).toISOString(),
        pv: 150 + Math.sin(i * 0.1) * 5 + Math.random() * 2,
        sp: 150 + Math.sin(i * 0.05) * 3,
        op: 45 + Math.sin(i * 0.1) * 3 + Math.random() * 1,
        mode: i % 20 === 0 ? 'AUTO' : 'MANUAL',
        valvePosition: 45 + Math.sin(i * 0.1) * 3 + Math.random() * 1
      }));

      // Generate KPI data
      const mockKpiData: KPIData[] = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(now - (24 - i) * 3600000).toISOString(),
        serviceFactor: 0.85 + Math.random() * 0.1,
        pi: 0.78 + Math.random() * 0.15,
        rpi: 0.82 + Math.random() * 0.12,
        oscillationIndex: 0.12 + Math.random() * 0.2,
        stictionIndex: 0.05 + Math.random() * 0.1
      }));

      // Generate diagnostics history
      const mockDiagnostics: DiagnosticResult[] = [
        {
          timestamp: new Date().toISOString(),
          classification: 'normal',
          stictionSeverity: 0.05,
          oscillationPeriod: 0,
          hurstExponent: 0.52
        },
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          classification: 'normal',
          stictionSeverity: 0.08,
          oscillationPeriod: 0,
          hurstExponent: 0.51
        },
        {
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          classification: 'oscillating',
          stictionSeverity: 0.12,
          oscillationPeriod: 5.2,
          hurstExponent: 0.48,
          rootCause: 'Flow control interaction'
        }
      ];

      setLoop(mockLoop);
      setConfig(mockConfig);
      setTrendData(mockTrendData);
      setKpiData(mockKpiData);
      setDiagnostics(mockDiagnostics);
      } catch (err: any) {
        console.error('Error fetching loop data:', err);
        setError(err.response?.data?.message || 'Failed to fetch loop data');
      } finally {
        setLoading(false);
      }
    };

  const handleRunDiagnostics = async () => {
    try {
      setRunningDiagnostics(true);
      // Simulate diagnostics run
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Add new diagnostic result
      const newDiagnostic: DiagnosticResult = {
        timestamp: new Date().toISOString(),
        classification: 'normal',
        stictionSeverity: 0.05 + Math.random() * 0.1,
        oscillationPeriod: 0,
        hurstExponent: 0.5 + Math.random() * 0.1
      };
      
      setDiagnostics([newDiagnostic, ...diagnostics]);
    } catch (err: any) {
      console.error('Error running diagnostics:', err);
      setError('Failed to run diagnostics');
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'normal': return 'success';
      case 'oscillating': return 'warning';
      case 'stiction': return 'error';
      case 'deadband': return 'info';
      default: return 'default';
    }
  };

  const getCriticalityColor = (criticality: string) => {
    switch (criticality) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!loop) {
    return (
      <Alert severity="error">
        Loop not found
      </Alert>
    );
  }

  return (
    <Box>
      {/* Metadata Panel */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h4" gutterBottom>
              {loop.name}
            </Typography>
            <Typography variant="body1" color="textSecondary" paragraph>
              {loop.description}
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip label={`PV: ${loop.pvTag}`} size="small" />
              <Chip label={`OP: ${loop.opTag}`} size="small" />
              <Chip label={`SP: ${loop.spTag}`} size="small" />
              <Chip 
                label={loop.classification} 
                color={getClassificationColor(loop.classification) as any}
                size="small"
              />
              <Chip 
                label={loop.criticality} 
                color={getCriticalityColor(loop.criticality) as any}
                size="small"
              />
              <Chip label={`Importance: ${loop.importance}`} size="small" />
            </Box>
          </Grid>
          <Grid item xs={12} md={4} textAlign="right">
            {(user?.role === 'admin' || user?.role === 'engineer') && (
              <Button
                variant="contained"
                startIcon={<SettingsIcon />}
                onClick={() => navigate(`/loops/${id}/config`)}
              >
                Configure
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Live Trends" />
          <Tab label="KPI History" />
          <Tab label="Performance KPIs" />
          <Tab label="Diagnostics" />
          <Tab label="Configuration" />
        </Tabs>

        {/* Live Trends Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Live Trend Data</Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Time Window</InputLabel>
              <Select
                value={timeWindow}
                label="Time Window"
                onChange={(e) => setTimeWindow(e.target.value)}
              >
                <MenuItem value="30m">30 minutes</MenuItem>
                <MenuItem value="1h">1 hour</MenuItem>
                <MenuItem value="6h">6 hours</MenuItem>
                <MenuItem value="24h">24 hours</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <RechartsTooltip 
                labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm:ss')}
                formatter={(value: any, name: string) => [value.toFixed(2), name]}
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="pv" 
                stroke="#2196f3" 
                name="PV" 
                strokeWidth={2}
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="sp" 
                stroke="#4caf50" 
                name="SP" 
                strokeWidth={2}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="op" 
                stroke="#ff9800" 
                name="OP" 
                strokeWidth={2}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="valvePosition" 
                stroke="#9c27b0" 
                name="Valve Position" 
                strokeWidth={1}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
          
          {/* Mode Changes Overlay */}
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>Mode Changes</Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {trendData
                .filter(d => d.mode)
                .map((data, index) => (
                  <Chip
                    key={index}
                    label={`${format(new Date(data.timestamp), 'HH:mm')} - ${data.mode}`}
                    size="small"
                    color={data.mode === 'AUTO' ? 'success' : 'warning'}
                    variant="outlined"
                  />
                ))}
            </Box>
          </Box>
        </TabPanel>

        {/* KPI History Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">KPI History</Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>KPI Window</InputLabel>
              <Select
                value={kpiWindow}
                label="KPI Window"
                onChange={(e) => setKpiWindow(e.target.value)}
              >
                <MenuItem value="15m">15 minutes</MenuItem>
                <MenuItem value="1h">1 hour</MenuItem>
                <MenuItem value="6h">6 hours</MenuItem>
                <MenuItem value="24h">24 hours</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={kpiData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              />
              <YAxis domain={[0, 1]} />
              <RechartsTooltip 
                labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm')}
                formatter={(value: any, name: string) => [value.toFixed(3), name]}
              />
              <Line type="monotone" dataKey="serviceFactor" stroke="#4caf50" name="Service Factor" />
              <Line type="monotone" dataKey="pi" stroke="#2196f3" name="PI" />
              <Line type="monotone" dataKey="rpi" stroke="#ff9800" name="RPI" />
              <Line type="monotone" dataKey="oscillationIndex" stroke="#f44336" name="Oscillation Index" />
              <Line type="monotone" dataKey="stictionIndex" stroke="#9c27b0" name="Stiction Index" />
              
              {/* Threshold Lines */}
              {config && (
                <>
                  <ReferenceLine y={config.sf_high} stroke="#4caf50" strokeDasharray="3 3" />
                  <ReferenceLine y={config.sf_low} stroke="#4caf50" strokeDasharray="3 3" />
                  <ReferenceLine y={config.rpi_high} stroke="#ff9800" strokeDasharray="3 3" />
                  <ReferenceLine y={config.rpi_low} stroke="#ff9800" strokeDasharray="3 3" />
                  <ReferenceLine y={config.osc_limit} stroke="#f44336" strokeDasharray="3 3" />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </TabPanel>

        {/* Performance KPIs Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Comprehensive Performance KPIs
          </Typography>
          
          <Grid container spacing={3}>
            {/* Primary Performance KPIs */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Primary Performance KPIs
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Service Factor</Typography>
                      <Typography variant="h6" color={loop.serviceFactor > 0.7 ? 'success.main' : 'error.main'}>
                        {(loop.serviceFactor * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Performance Index</Typography>
                      <Typography variant="h6" color={loop.pi > 0.7 ? 'success.main' : 'error.main'}>
                        {loop.pi.toFixed(3)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Relative PI</Typography>
                      <Typography variant="h6" color={loop.rpi > 0.7 ? 'success.main' : 'error.main'}>
                        {loop.rpi.toFixed(3)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Oscillation Index</Typography>
                      <Typography variant="h6" color={loop.oscillationIndex < 0.3 ? 'success.main' : 'error.main'}>
                        {loop.oscillationIndex.toFixed(3)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Stiction Severity</Typography>
                      <Typography variant="h6" color={loop.stictionSeverity < 0.3 ? 'success.main' : 'error.main'}>
                        {(loop.stictionSeverity * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Deadband</Typography>
                      <Typography variant="h6" color={loop.deadband < 0.1 ? 'success.main' : 'error.main'}>
                        {loop.deadband.toFixed(3)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Control Performance */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Control Performance
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Saturation</Typography>
                      <Typography variant="h6" color={loop.saturation < 0.2 ? 'success.main' : 'error.main'}>
                        {(loop.saturation * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Valve Travel</Typography>
                      <Typography variant="h6" color={loop.valveTravel > 0.5 ? 'success.main' : 'warning.main'}>
                        {(loop.valveTravel * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Settling Time</Typography>
                      <Typography variant="h6" color={loop.settlingTime < 120 ? 'success.main' : 'warning.main'}>
                        {loop.settlingTime}s
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Overshoot</Typography>
                      <Typography variant="h6" color={loop.overshoot < 0.1 ? 'success.main' : 'error.main'}>
                        {(loop.overshoot * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Rise Time</Typography>
                      <Typography variant="h6" color={loop.riseTime < 300 ? 'success.main' : 'warning.main'}>
                        {loop.riseTime}s
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Peak Error</Typography>
                      <Typography variant="h6" color={loop.peakError < 5 ? 'success.main' : 'error.main'}>
                        {loop.peakError.toFixed(1)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Process Characteristics */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Process Characteristics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Process Gain</Typography>
                      <Typography variant="h6">
                        {loop.processGain.toFixed(2)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Time Constant</Typography>
                      <Typography variant="h6">
                        {loop.timeConstant}s
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Dead Time</Typography>
                      <Typography variant="h6">
                        {loop.deadTime}s
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Noise Level</Typography>
                      <Typography variant="h6" color={loop.noiseLevel < 0.1 ? 'success.main' : 'error.main'}>
                        {loop.noiseLevel.toFixed(3)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Operational Metrics */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Operational Metrics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Setpoint Changes</Typography>
                      <Typography variant="h6">
                        {loop.setpointChanges}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Mode Changes</Typography>
                      <Typography variant="h6">
                        {loop.modeChanges}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Valve Reversals</Typography>
                      <Typography variant="h6" color={loop.valveReversals < 15 ? 'success.main' : 'error.main'}>
                        {loop.valveReversals}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Control Error</Typography>
                      <Typography variant="h6" color={loop.controlError < 3 ? 'success.main' : 'error.main'}>
                        {loop.controlError.toFixed(2)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Error Analysis */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Error Analysis
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Integral Error</Typography>
                      <Typography variant="h6" color={loop.integralError < 30 ? 'success.main' : 'error.main'}>
                        {loop.integralError.toFixed(1)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Derivative Error</Typography>
                      <Typography variant="h6" color={loop.derivativeError < 2 ? 'success.main' : 'error.main'}>
                        {loop.derivativeError.toFixed(1)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Peak Error</Typography>
                      <Typography variant="h6" color={loop.peakError < 5 ? 'success.main' : 'error.main'}>
                        {loop.peakError.toFixed(1)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Control Error</Typography>
                      <Typography variant="h6" color={loop.controlError < 3 ? 'success.main' : 'error.main'}>
                        {loop.controlError.toFixed(1)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Performance Summary */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Performance Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Overall Performance</Typography>
                      <Typography variant="h6" color="primary.main">
                        {((loop.serviceFactor + loop.pi + loop.rpi) / 3 * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Control Quality</Typography>
                      <Typography variant="h6" color={loop.oscillationIndex < 0.3 && loop.stictionSeverity < 0.3 ? 'success.main' : 'error.main'}>
                        {loop.oscillationIndex < 0.3 && loop.stictionSeverity < 0.3 ? 'Good' : 'Poor'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Valve Health</Typography>
                      <Typography variant="h6" color={loop.stictionSeverity < 0.3 && loop.valveReversals < 15 ? 'success.main' : 'error.main'}>
                        {loop.stictionSeverity < 0.3 && loop.valveReversals < 15 ? 'Good' : 'Poor'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Process Stability</Typography>
                      <Typography variant="h6" color={loop.noiseLevel < 0.1 && loop.overshoot < 0.1 ? 'success.main' : 'error.main'}>
                        {loop.noiseLevel < 0.1 && loop.overshoot < 0.1 ? 'Stable' : 'Unstable'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Diagnostics Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Diagnostics</Typography>
            {(user?.role === 'admin' || user?.role === 'engineer') && (
              <Button
                variant="contained"
                startIcon={runningDiagnostics ? <CircularProgress size={16} /> : <PlayArrow />}
                onClick={handleRunDiagnostics}
                disabled={runningDiagnostics}
              >
                {runningDiagnostics ? 'Running...' : 'Run Diagnostics Now'}
              </Button>
            )}
          </Box>

          {/* Latest Diagnostic Result */}
          {diagnostics.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Latest Diagnostic Result
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Classification</Typography>
                    <Chip 
                      label={diagnostics[0].classification}
                      color={getClassificationColor(diagnostics[0].classification) as any}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Stiction Severity</Typography>
                    <Typography variant="h6">
                      {(diagnostics[0].stictionSeverity * 100).toFixed(1)}%
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Oscillation Period</Typography>
                    <Typography variant="h6">
                      {diagnostics[0].oscillationPeriod > 0 ? `${diagnostics[0].oscillationPeriod.toFixed(1)}s` : 'None'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="textSecondary">Hurst Exponent</Typography>
                    <Typography variant="h6">
                      {diagnostics[0].hurstExponent.toFixed(3)}
                    </Typography>
                  </Grid>
                </Grid>
                {diagnostics[0].rootCause && (
                  <Box mt={2}>
                    <Typography variant="body2" color="textSecondary">Root Cause</Typography>
                    <Typography variant="body1">{diagnostics[0].rootCause}</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Diagnostic History */}
          <Typography variant="h6" gutterBottom>
            Diagnostic History
          </Typography>
          <List>
            {diagnostics.map((diagnostic, index) => (
              <ListItem key={index} divider>
                <ListItemIcon>
                  <AssessmentIcon color={getClassificationColor(diagnostic.classification) as any} />
                </ListItemIcon>
                <ListItemText
                  primary={`${diagnostic.classification} - ${format(new Date(diagnostic.timestamp), 'MMM dd, HH:mm')}`}
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        Stiction: {(diagnostic.stictionSeverity * 100).toFixed(1)}% | 
                        Period: {diagnostic.oscillationPeriod > 0 ? `${diagnostic.oscillationPeriod.toFixed(1)}s` : 'None'} | 
                        Hurst: {diagnostic.hurstExponent.toFixed(3)}
                      </Typography>
                      {diagnostic.rootCause && (
                        <Typography variant="body2" color="textSecondary">
                          Root Cause: {diagnostic.rootCause}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </TabPanel>

        {/* Configuration Tab */}
        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" gutterBottom>
            Configuration Thresholds
          </Typography>
          {config ? (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>Service Factor</Typography>
                    <Typography variant="body2">Low: {config.sf_low}</Typography>
                    <Typography variant="body2">High: {config.sf_high}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>RPI Range</Typography>
                    <Typography variant="body2">Low: {config.rpi_low}</Typography>
                    <Typography variant="body2">High: {config.rpi_high}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>Oscillation Limit</Typography>
                    <Typography variant="body2">Max: {config.osc_limit}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>Saturation</Typography>
                    <Typography variant="body2">High: {config.sat_high}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>KPI Window</Typography>
                    <Typography variant="body2">{config.kpi_window} minutes</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>Importance</Typography>
                    <Typography variant="body2">{config.importance}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">
              No configuration found. Please configure this loop.
            </Alert>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
}
