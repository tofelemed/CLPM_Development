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

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/v1';

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
      {value === index && (
        <Box sx={{ 
          p: 3, 
          minHeight: '600px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {children}
        </Box>
      )}
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
      
      // Fetch loop details
      const loopResponse = await axios.get(`${API}/loops/${id}`);
      const loopData = loopResponse.data;
      
      // Transform loop data to match our interface
      const transformedLoop: Loop = {
        id: loopData.id,
        name: loopData.name,
        description: loopData.description,
        pvTag: loopData.pv_tag,
        opTag: loopData.op_tag,
        spTag: loopData.sp_tag,
        importance: loopData.importance || 0.5,
        classification: 'normal', // Will be updated from diagnostics
        serviceFactor: 0, // Will be updated from KPI data
        pi: 0, // Will be updated from KPI data
        rpi: 0, // Will be updated from KPI data
        oscillationIndex: 0, // Will be updated from KPI data
        stictionSeverity: 0, // Will be updated from KPI data
        plantArea: 'Plant Area',
        criticality: loopData.importance > 7 ? 'high' : loopData.importance > 4 ? 'medium' : 'low',
        lastUpdated: loopData.updated_at || new Date().toISOString(),
        deadband: 0,
        saturation: 0,
        setpointChanges: 0,
        modeChanges: 0,
        valveTravel: 0,
        settlingTime: 0,
        overshoot: 0,
        riseTime: 0,
        peakError: 0,
        integralError: 0,
        derivativeError: 0,
        controlError: 0,
        valveReversals: 0,
        noiseLevel: 0,
        processGain: 0,
        timeConstant: 0,
        deadTime: 0
      };

      setLoop(transformedLoop);

      // Fetch loop configuration
      try {
        const configResponse = await axios.get(`${API}/loops/${id}/config`);
        const configData = configResponse.data;
        setConfig({
          sf_low: configData.sf_low || 0.6,
          sf_high: configData.sf_high || 0.9,
          sat_high: configData.sat_high || 0.95,
          rpi_low: configData.rpi_low || 0.5,
          rpi_high: configData.rpi_high || 0.8,
          osc_limit: configData.osc_limit || 0.3,
          kpi_window: configData.kpi_window || 60,
          importance: configData.importance || 0.9
        });
      } catch (configError) {
        console.warn('Could not fetch loop configuration:', configError);
        // Use default config
        setConfig({
          sf_low: 0.6,
          sf_high: 0.9,
          sat_high: 0.95,
          rpi_low: 0.5,
          rpi_high: 0.8,
          osc_limit: 0.3,
          kpi_window: 60,
          importance: 0.9
        });
      }

             // Fetch raw trend data with smart sampling
       try {
         // Get the available data range from the database first
         const dataRangeResponse = await axios.get(`${API}/loops/${id}/data/range`);
         let dataStartTime, dataEndTime;
         
         try {
           const rangeData = dataRangeResponse.data;
           dataStartTime = new Date(rangeData.start);
           dataEndTime = new Date(rangeData.end);
         } catch (rangeError) {
           // Fallback: use a reasonable default range if range endpoint fails
           dataEndTime = new Date();
           dataStartTime = new Date(dataEndTime.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
         }
         
         // Calculate the requested time window
         const requestedWindow = parseTimeWindow(timeWindow);
         const availableDuration = dataEndTime.getTime() - dataStartTime.getTime();
         
         // Smart sampling: limit data points based on time window
         let sampleInterval = '1 minute'; // Default
         let limit = 1000; // Default limit
         
         if (timeWindow === '1h') {
           sampleInterval = '1 minute';
           limit = 60;
         } else if (timeWindow === '6h') {
           sampleInterval = '5 minutes';
           limit = 72;
         } else if (timeWindow === '24h') {
           sampleInterval = '15 minutes';
           limit = 96;
         } else if (timeWindow === '7d') {
           sampleInterval = '1 hour';
           limit = 168;
         }
         
         // Use the requested time window, not the full available range
         const endTime = new Date();
         const startTime = new Date(endTime.getTime() - requestedWindow);
         
         console.log('Requested window:', timeWindow, '(', requestedWindow / (1000 * 60 * 60), 'hours)');
         console.log('Sample interval:', sampleInterval, 'Limit:', limit);
         console.log('Fetching trend data from:', startTime.toISOString(), 'to:', endTime.toISOString());
         
         const dataResponse = await axios.get(`${API}/loops/${id}/data`, {
           params: {
             start: startTime.toISOString(),
             end: endTime.toISOString(),
             fields: 'pv,op,sp,mode,valve_position',
             interval: sampleInterval,
             limit: limit
           }
         });
         
         const rawData = dataResponse.data;
         console.log('Raw trend data response:', rawData);
         
         const trendData: TrendData[] = [];
         
         if (rawData.ts && rawData.ts.length > 0) {
           for (let i = 0; i < rawData.ts.length; i++) {
             trendData.push({
               timestamp: rawData.ts[i],
               pv: Number(rawData.pv?.[i]) || 0,
               sp: Number(rawData.sp?.[i]) || 0,
               op: Number(rawData.op?.[i]) || 0,
               mode: rawData.mode?.[i] || 'AUTO',
               valvePosition: Number(rawData.valve_position?.[i]) || 0
             });
           }
         }
         
         console.log('Processed trend data:', trendData.length, 'points');
         setTrendData(trendData);
       } catch (dataError) {
         console.warn('Could not fetch trend data:', dataError);
         setTrendData([]);
       }

      // Fetch comprehensive KPI history
      try {
        // Use a wider time window to ensure we get data
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days
        
        const kpiResponse = await axios.get(`${API}/loops/${id}/kpis/comprehensive`, {
          params: {
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            limit: 100
          }
        });
        
        const kpiResults = kpiResponse.data.results || [];
        console.log('KPI Response:', kpiResponse.data);
        console.log('KPI Results count:', kpiResults.length);
        
        const kpiData: KPIData[] = kpiResults.map((kpi: any) => ({
          timestamp: kpi.timestamp,
          serviceFactor: Number(kpi.service_factor) || 0,
          pi: Number(kpi.pi) || 0,
          rpi: Number(kpi.rpi) || 0,
          oscillationIndex: Number(kpi.osc_index) || 0,
          stictionIndex: Number(kpi.stiction) || 0
        }));
        
        setKpiData(kpiData);
        
        // Update loop with latest comprehensive KPI data
        if (kpiResults.length > 0) {
          const latestKpi = kpiResults[0];
          console.log('Latest KPI data:', latestKpi);
          
          setLoop(prev => {
            if (!prev) {
              console.warn('Previous loop state is null, cannot update KPI data');
              return prev;
            }
            
            const updatedLoop = {
              ...prev,
              serviceFactor: Number(latestKpi.service_factor) || 0,
              pi: Number(latestKpi.pi) || 0,
              rpi: Number(latestKpi.rpi) || 0,
              oscillationIndex: Number(latestKpi.osc_index) || 0,
              stictionSeverity: Number(latestKpi.stiction) || 0,
              saturation: Number(latestKpi.saturation) || 0,
              valveTravel: Number(latestKpi.valve_travel) || 0,
              deadband: Number(latestKpi.deadband) || 0,
              settlingTime: Number(latestKpi.settling_time) || 0,
              overshoot: Number(latestKpi.overshoot) || 0,
              riseTime: Number(latestKpi.rise_time) || 0,
              peakError: Number(latestKpi.peak_error) || 0,
              integralError: Number(latestKpi.integral_error) || 0,
              derivativeError: Number(latestKpi.derivative_error) || 0,
              controlError: Number(latestKpi.control_error) || 0,
              valveReversals: Number(latestKpi.valve_reversals) || 0,
              noiseLevel: Number(latestKpi.noise_level) || 0,
              processGain: Number(latestKpi.process_gain) || 0,
              timeConstant: Number(latestKpi.time_constant) || 0,
              deadTime: Number(latestKpi.dead_time) || 0,
              setpointChanges: Number(latestKpi.setpoint_changes) || 0,
              modeChanges: Number(latestKpi.mode_changes) || 0
            };
            
            console.log('Updated loop with KPI data:', updatedLoop);
            return updatedLoop;
          });
        } else {
          console.warn('No KPI results found');
        }
      } catch (kpiError) {
        console.warn('Could not fetch comprehensive KPI data:', kpiError);
        setKpiData([]);
      }

      // Fetch diagnostic results
      try {
        const diagResponse = await axios.get(`${API}/loops/${id}/diagnostics`);
        const diagData = diagResponse.data;
        
        // Fetch diagnostic history
        const diagHistoryResponse = await axios.get(`${API}/loops/${id}/diagnostics/history`);
        const diagHistory = diagHistoryResponse.data || [];
        
                 const diagnosticResults: DiagnosticResult[] = diagHistory.map((diag: any) => ({
           timestamp: diag.timestamp,
           classification: diag.classification || 'normal',
           stictionSeverity: Number(diag.stiction_pct) || 0,
           oscillationPeriod: Number(diag.osc_period) || 0,
           hurstExponent: 0.5, // Not available in current schema
           rootCause: diag.root_cause || undefined
         }));
        
        setDiagnostics(diagnosticResults);
        
        // Update loop classification with latest diagnostic
        if (diagData) {
          setLoop(prev => prev ? {
            ...prev,
            classification: diagData.classification || 'normal'
          } : prev);
        }
      } catch (diagError) {
        console.warn('Could not fetch diagnostic data:', diagError);
        setDiagnostics([]);
      }

    } catch (err: any) {
      console.error('Error fetching loop data:', err);
      setError(err.response?.data?.message || 'Failed to fetch loop data');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to parse time window
  const parseTimeWindow = (window: string): number => {
    const match = window.match(/^(\d+)([hmd])$/);
    if (!match) return 60 * 60 * 1000; // Default to 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h':
        return value * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000;
    }
  };

  const handleRunDiagnostics = async () => {
    try {
      setRunningDiagnostics(true);
      
      // Call the diagnostics API
      const response = await axios.post(`${API}/loops/${id}/diagnostics/run`, {});
      const result = response.data;
      
             // Create new diagnostic result from API response
       const newDiagnostic: DiagnosticResult = {
         timestamp: new Date().toISOString(),
         classification: result.classification || 'normal',
         stictionSeverity: Number(result.stiction_pct) || 0,
         oscillationPeriod: Number(result.osc_period_s) || 0,
         hurstExponent: 0.5, // Not available in current API
         rootCause: result.root_cause || undefined
       };
      
      setDiagnostics([newDiagnostic, ...diagnostics]);
      
      // Update loop classification
      setLoop(prev => prev ? {
        ...prev,
        classification: result.classification || 'normal'
      } : prev);
      
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

  // Debug: Log current loop state
  console.log('Current loop state:', loop);

  return (
    <Box sx={{ 
      width: '100%',
      padding: '24px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* Metadata Panel */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
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
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ 
        width: '100%', 
        borderRadius: 2, 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
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
             <Box display="flex" alignItems="center" gap={2}>
               <Typography variant="body2" color="textSecondary">
                 Available: {trendData.length > 0 ? 
                   `${format(new Date(trendData[0]?.timestamp), 'MMM dd, HH:mm')} - ${format(new Date(trendData[trendData.length - 1]?.timestamp), 'MMM dd, HH:mm')}` : 
                   'No data available'}
               </Typography>
               <FormControl size="small" sx={{ minWidth: 120 }}>
                 <InputLabel>Time Window</InputLabel>
                 <Select
                   value={timeWindow}
                   label="Time Window"
                   onChange={(e) => setTimeWindow(e.target.value)}
                 >
                   <MenuItem value="1h">1 hour</MenuItem>
                   <MenuItem value="6h">6 hours</MenuItem>
                   <MenuItem value="24h">1 day</MenuItem>
                   <MenuItem value="7d">1 week</MenuItem>
                 </Select>
               </FormControl>
             </Box>
           </Box>
          
                     <ResponsiveContainer width="100%" height={500}>
             <LineChart data={trendData}>
               <CartesianGrid strokeDasharray="3 3" />
               <XAxis 
                 dataKey="timestamp" 
                 tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                 interval="preserveStartEnd"
                 minTickGap={50}
               />
               <YAxis yAxisId="left" />
               <YAxis yAxisId="right" orientation="right" />
                              <RechartsTooltip 
                 labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm:ss')}
                 formatter={(value: any, name: string) => {
                   // Handle null, undefined, or non-numeric values
                   const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                   return [numValue.toFixed(2), name];
                 }}
               />
               <Line 
                 yAxisId="left"
                 type="monotone" 
                 dataKey="pv" 
                 stroke="#2196f3" 
                 name="PV" 
                 strokeWidth={2}
                 dot={false}
                 connectNulls={true}
               />
               <Line 
                 yAxisId="left"
                 type="monotone" 
                 dataKey="sp" 
                 stroke="#4caf50" 
                 name="SP" 
                 strokeWidth={2}
                 dot={false}
                 connectNulls={true}
               />
               <Line 
                 yAxisId="right"
                 type="monotone" 
                 dataKey="op" 
                 stroke="#ff9800" 
                 name="OP" 
                 strokeWidth={2}
                 dot={false}
                 connectNulls={true}
               />
               <Line 
                 yAxisId="right"
                 type="monotone" 
                 dataKey="valvePosition" 
                 stroke="#9c27b0" 
                 name="Valve Position" 
                 strokeWidth={1}
                 strokeDasharray="5 5"
                 dot={false}
                 connectNulls={true}
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
          
                     <ResponsiveContainer width="100%" height={500}>
            <LineChart data={kpiData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => format(new Date(value), 'HH:mm')}
              />
              <YAxis domain={[0, 1]} />
              <RechartsTooltip 
                labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm')}
                formatter={(value: any, name: string) => {
                  // Handle null, undefined, or non-numeric values
                  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                  return [numValue.toFixed(3), name];
                }}
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
          
          <Grid container spacing={3} sx={{ minHeight: '500px' }}>
            {/* Primary Performance KPIs */}
            <Grid item xs={12} md={6}>
              <Card sx={{ 
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Primary Performance KPIs
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Service Factor</Typography>
                      <Typography variant="h6" color={loop.serviceFactor > 0.7 ? 'success.main' : 'error.main'}>
                        {((loop.serviceFactor || 0) * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Performance Index</Typography>
                      <Typography variant="h6" color={loop.pi > 0.7 ? 'success.main' : 'error.main'}>
                        {(loop.pi || 0).toFixed(3)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Relative PI</Typography>
                      <Typography variant="h6" color={loop.rpi > 0.7 ? 'success.main' : 'error.main'}>
                        {(loop.rpi || 0).toFixed(3)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Oscillation Index</Typography>
                      <Typography variant="h6" color={loop.oscillationIndex < 0.3 ? 'success.main' : 'error.main'}>
                        {(loop.oscillationIndex || 0).toFixed(3)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Stiction Severity</Typography>
                      <Typography variant="h6" color={loop.stictionSeverity < 0.3 ? 'success.main' : 'error.main'}>
                        {((loop.stictionSeverity || 0) * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Deadband</Typography>
                      <Typography variant="h6" color={loop.deadband < 0.1 ? 'success.main' : 'error.main'}>
                        {(loop.deadband || 0).toFixed(3)}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Control Performance */}
            <Grid item xs={12} md={6}>
              <Card sx={{ 
                height: '100%',
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    Control Performance
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Saturation</Typography>
                                             <Typography variant="h6" color={loop.saturation < 0.2 ? 'success.main' : 'error.main'}>
                         {((loop.saturation || 0) * 100).toFixed(1)}%
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Valve Travel</Typography>
                                             <Typography variant="h6" color={loop.valveTravel > 0.5 ? 'success.main' : 'warning.main'}>
                         {((loop.valveTravel || 0) * 100).toFixed(1)}%
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Settling Time</Typography>
                                             <Typography variant="h6" color={loop.settlingTime < 120 ? 'success.main' : 'warning.main'}>
                         {loop.settlingTime || 0}s
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Overshoot</Typography>
                                             <Typography variant="h6" color={loop.overshoot < 0.1 ? 'success.main' : 'error.main'}>
                         {((loop.overshoot || 0) * 100).toFixed(1)}%
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Rise Time</Typography>
                                             <Typography variant="h6" color={loop.riseTime < 300 ? 'success.main' : 'warning.main'}>
                         {loop.riseTime || 0}s
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Peak Error</Typography>
                                             <Typography variant="h6" color={loop.peakError < 5 ? 'success.main' : 'error.main'}>
                         {(loop.peakError || 0).toFixed(1)}
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
                         {(loop.processGain || 0).toFixed(2)}
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Time Constant</Typography>
                                             <Typography variant="h6">
                         {loop.timeConstant || 0}s
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Dead Time</Typography>
                                             <Typography variant="h6">
                         {loop.deadTime || 0}s
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Noise Level</Typography>
                                             <Typography variant="h6" color={loop.noiseLevel < 0.1 ? 'success.main' : 'error.main'}>
                         {(loop.noiseLevel || 0).toFixed(3)}
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
                         {loop.setpointChanges || 0}
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Mode Changes</Typography>
                                             <Typography variant="h6">
                         {loop.modeChanges || 0}
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Valve Reversals</Typography>
                                             <Typography variant="h6" color={loop.valveReversals < 15 ? 'success.main' : 'error.main'}>
                         {loop.valveReversals || 0}
                       </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Control Error</Typography>
                                             <Typography variant="h6" color={loop.controlError < 3 ? 'success.main' : 'error.main'}>
                         {(loop.controlError || 0).toFixed(2)}
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
                         {(loop.integralError || 0).toFixed(1)}
                       </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Derivative Error</Typography>
                                             <Typography variant="h6" color={loop.derivativeError < 2 ? 'success.main' : 'error.main'}>
                         {(loop.derivativeError || 0).toFixed(1)}
                       </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Peak Error</Typography>
                                             <Typography variant="h6" color={loop.peakError < 5 ? 'success.main' : 'error.main'}>
                         {(loop.peakError || 0).toFixed(1)}
                       </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" color="textSecondary">Control Error</Typography>
                      <Typography variant="h6" color={loop.controlError < 3 ? 'success.main' : 'error.main'}>
                         {(loop.controlError || 0).toFixed(1)}
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
           {diagnostics && diagnostics.length > 0 && (
            <Card sx={{ 
              mb: 3, 
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
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
                       {(Number(diagnostics[0].stictionSeverity) * 100).toFixed(1)}%
                     </Typography>
                   </Grid>
                                     <Grid item xs={12} sm={6} md={3}>
                     <Typography variant="body2" color="textSecondary">Oscillation Period</Typography>
                     <Typography variant="h6">
                       {diagnostics[0].oscillationPeriod && Number(diagnostics[0].oscillationPeriod) > 0 ? `${Number(diagnostics[0].oscillationPeriod).toFixed(1)}s` : 'None'}
                     </Typography>
                   </Grid>
                                     <Grid item xs={12} sm={6} md={3}>
                     <Typography variant="body2" color="textSecondary">Hurst Exponent</Typography>
                     <Typography variant="h6">
                       {Number(diagnostics[0].hurstExponent).toFixed(3)}
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
           {diagnostics && diagnostics.length > 0 ? (
             <List sx={{ 
               backgroundColor: '#ffffff',
               borderRadius: 2,
               boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
               overflow: 'hidden'
             }}>
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
                         Stiction: {(Number(diagnostic.stictionSeverity) * 100).toFixed(1)}% | 
                         Period: {diagnostic.oscillationPeriod && Number(diagnostic.oscillationPeriod) > 0 ? `${Number(diagnostic.oscillationPeriod).toFixed(1)}s` : 'None'} | 
                         Hurst: {Number(diagnostic.hurstExponent).toFixed(3)}
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
           ) : (
             <Alert severity="info" sx={{ borderRadius: 2 }}>
               No diagnostic history available.
             </Alert>
           )}
        </TabPanel>

        {/* Configuration Tab */}
        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" gutterBottom>
            Configuration Thresholds
          </Typography>
          {config ? (
            <Grid container spacing={3} sx={{ minHeight: '400px' }}>
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ 
                  height: '100%',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>Service Factor</Typography>
                    <Typography variant="body2">Low: {config.sf_low}</Typography>
                    <Typography variant="body2">High: {config.sf_high}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ 
                  height: '100%',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>RPI Range</Typography>
                    <Typography variant="body2">Low: {config.rpi_low}</Typography>
                    <Typography variant="body2">High: {config.rpi_high}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ 
                  height: '100%',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>Oscillation Limit</Typography>
                    <Typography variant="body2">Max: {config.osc_limit}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ 
                  height: '100%',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>Saturation</Typography>
                    <Typography variant="body2">High: {config.sat_high}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ 
                  height: '100%',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>KPI Window</Typography>
                    <Typography variant="body2">{config.kpi_window} minutes</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={{ 
                  height: '100%',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>Importance</Typography>
                    <Typography variant="body2">{config.importance}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No configuration found. Please configure this loop.
            </Alert>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
}
