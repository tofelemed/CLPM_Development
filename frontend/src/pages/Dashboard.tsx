import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Tooltip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import NotificationsIcon from '@mui/icons-material/Notifications';
import TimelineIcon from '@mui/icons-material/Timeline';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { format, subHours, subDays } from 'date-fns';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/v1';
const OPCUA_API = import.meta.env.VITE_OPCUA_API_BASE || 'http://localhost:8080/api/v1';

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

interface KPISummary {
  totalLoops: number;
  normalLoops: number;
  oscillatingLoops: number;
  stictionLoops: number;
  deadbandLoops: number;
  averageServiceFactor: number;
  loopsExceedingThresholds: number;
}

interface OscillationCluster {
  period: number;
  loops: string[];
  rootCauseLoop: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  affectedLoops: {
    id: string;
    name: string;
    classification: string;
  }[];
}

export default function Dashboard() {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [kpiSummary, setKpiSummary] = useState<KPISummary | null>(null);
  const [oscillationClusters, setOscillationClusters] = useState<OscillationCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [plantAreaFilter, setPlantAreaFilter] = useState<string>('all');
  const [criticalityFilter, setCriticalityFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | null>(subHours(new Date(), 1));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
      
      // Fetch loops data from main API
      const loopsResponse = await axios.get(`${API}/loops`);
      const apiLoops = loopsResponse.data.loops || loopsResponse.data;
      
             // Transform API loops to Dashboard format
       const transformedLoops: Loop[] = apiLoops.map((loop: any, index: number) => {
         // Determine classification based on description
         let classification: 'normal' | 'oscillating' | 'stiction' | 'deadband' = 'normal';
         let serviceFactor = 0.85;
         let pi = 0.78;
         let rpi = 0.82;
         let oscillationIndex = 0.12;
         let stictionSeverity = 0.05;
         
         if (loop.description.toLowerCase().includes('oscillation')) {
           classification = 'oscillating';
           serviceFactor = 0.45;
           pi = 0.32;
           rpi = 0.38;
           oscillationIndex = 0.78;
         } else if (loop.description.toLowerCase().includes('stiction')) {
           classification = 'stiction';
           serviceFactor = 0.62;
           pi = 0.58;
           rpi = 0.61;
           stictionSeverity = 0.68;
         }
         
         return {
           id: loop.id,
           name: loop.name,
           description: loop.description,
           pvTag: loop.pv_tag,
           opTag: loop.op_tag,
           spTag: loop.sp_tag,
           importance: loop.importance || 0.5,
           classification,
           serviceFactor,
           pi,
           rpi,
           oscillationIndex,
           stictionSeverity,
           plantArea: 'Plant Area', // Default value
           criticality: loop.importance > 7 ? 'high' : loop.importance > 4 ? 'medium' : 'low',
           lastUpdated: loop.updated_at || new Date().toISOString(),
           deadband: 0.02,
           saturation: 0.08,
           setpointChanges: Math.floor(Math.random() * 20),
           modeChanges: Math.floor(Math.random() * 5),
           valveTravel: 0.75,
           settlingTime: 45,
           overshoot: 0.05,
           riseTime: 30,
           peakError: Math.random() * 15,
           integralError: 20 + Math.random() * 50,
           derivativeError: Math.random() * 5,
           controlError: 1.2,
           valveReversals: 8,
           noiseLevel: 0.03,
           processGain: 0.5 + Math.random() * 1.5,
           timeConstant: 60 + Math.random() * 120,
           deadTime: 30 + Math.random() * 60
         };
       });
      
      // Add some mock loops if API has few loops for demo purposes
      const mockLoops: Loop[] = transformedLoops.length > 0 ? [] : [
        {
          id: 'loop-1',
            name: 'Temperature Control Loop',
          description: 'Reactor temperature control',
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
        },
        {
          id: 'loop-2',
            name: 'Pressure Control Loop',
          description: 'Distillation column pressure',
            pvTag: 'PRESS_PV',
            opTag: 'PRESS_OP',
          spTag: 'PRESS_SP',
          importance: 0.7,
          classification: 'oscillating',
          serviceFactor: 0.45,
          pi: 0.32,
          rpi: 0.38,
          oscillationIndex: 0.78,
          stictionSeverity: 0.15,
          rootCause: 'Flow control loop interaction',
          plantArea: 'Distillation Section',
          criticality: 'high',
          lastUpdated: new Date().toISOString(),
          deadband: 0.15,
          saturation: 0.25,
          setpointChanges: 8,
          modeChanges: 5,
          valveTravel: 0.45,
          settlingTime: 180,
          overshoot: 0.25,
          riseTime: 300,
          peakError: 8.7,
          integralError: 45.2,
          derivativeError: 2.1,
          controlError: 4.8,
          valveReversals: 25,
          noiseLevel: 0.12,
          processGain: 0.8,
          timeConstant: 120,
          deadTime: 45
        },
        {
          id: 'loop-3',
          name: 'Flow Control Loop',
          description: 'Feed flow rate control',
          pvTag: 'FLOW_PV',
          opTag: 'FLOW_OP',
          spTag: 'FLOW_SP',
          importance: 0.8,
          classification: 'stiction',
          serviceFactor: 0.62,
          pi: 0.58,
          rpi: 0.61,
          oscillationIndex: 0.25,
          stictionSeverity: 0.68,
          plantArea: 'Feed Section',
          criticality: 'medium',
          lastUpdated: new Date().toISOString(),
          deadband: 0.08,
          saturation: 0.18,
          setpointChanges: 15,
          modeChanges: 2,
          valveTravel: 0.35,
          settlingTime: 90,
          overshoot: 0.12,
          riseTime: 200,
          peakError: 5.2,
          integralError: 28.9,
          derivativeError: 1.5,
          controlError: 2.8,
          valveReversals: 12,
          noiseLevel: 0.06,
          processGain: 1.0,
          timeConstant: 150,
          deadTime: 35
        },
        {
          id: 'loop-4',
          name: 'Level Control Loop',
          description: 'Tank level control',
          pvTag: 'LEVEL_PV',
          opTag: 'LEVEL_OP',
          spTag: 'LEVEL_SP',
          importance: 0.6,
          classification: 'normal',
          serviceFactor: 0.92,
          pi: 0.88,
          rpi: 0.91,
          oscillationIndex: 0.08,
          stictionSeverity: 0.03,
          plantArea: 'Storage Section',
          criticality: 'low',
          lastUpdated: new Date().toISOString(),
          deadband: 0.01,
          saturation: 0.03,
          setpointChanges: 6,
          modeChanges: 1,
          valveTravel: 0.85,
          settlingTime: 30,
          overshoot: 0.02,
          riseTime: 80,
          peakError: 1.1,
          integralError: 8.3,
          derivativeError: 0.3,
          controlError: 0.6,
          valveReversals: 4,
          noiseLevel: 0.02,
          processGain: 1.5,
          timeConstant: 200,
          deadTime: 20
        },
        {
          id: 'loop-5',
          name: 'pH Control Loop',
          description: 'pH control for neutralization',
          pvTag: 'PH_PV',
          opTag: 'PH_OP',
          spTag: 'PH_SP',
          importance: 0.5,
          classification: 'deadband',
          serviceFactor: 0.35,
          pi: 0.28,
          rpi: 0.31,
          oscillationIndex: 0.45,
          stictionSeverity: 0.22,
          plantArea: 'Treatment Section',
          criticality: 'medium',
          lastUpdated: new Date().toISOString(),
          deadband: 0.25,
          saturation: 0.35,
          setpointChanges: 20,
          modeChanges: 8,
          valveTravel: 0.25,
          settlingTime: 240,
          overshoot: 0.35,
          riseTime: 400,
          peakError: 12.5,
          integralError: 67.8,
          derivativeError: 3.2,
          controlError: 7.1,
          valveReversals: 35,
          noiseLevel: 0.18,
          processGain: 0.6,
          timeConstant: 90,
          deadTime: 60
        }
      ];

      setLoops([...transformedLoops, ...mockLoops]);

      // Calculate KPI summary
      const allLoops = [...transformedLoops, ...mockLoops];
      const summary: KPISummary = {
        totalLoops: allLoops.length,
        normalLoops: allLoops.filter(l => l.classification === 'normal').length,
        oscillatingLoops: allLoops.filter(l => l.classification === 'oscillating').length,
        stictionLoops: allLoops.filter(l => l.classification === 'stiction').length,
        deadbandLoops: allLoops.filter(l => l.classification === 'deadband').length,
        averageServiceFactor: allLoops.reduce((sum, l) => sum + l.serviceFactor, 0) / allLoops.length,
        loopsExceedingThresholds: allLoops.filter(l => l.serviceFactor < 0.5 || l.pi < 0.5).length
      };

      setKpiSummary(summary);

      // Mock oscillation clusters
      const mockClusters: OscillationCluster[] = [
        {
          period: 5.2,
          loops: ['loop-2', 'loop-3'],
          rootCauseLoop: 'loop-2',
          severity: 'high',
          timestamp: new Date().toISOString(),
          affectedLoops: [
            { id: 'loop-2', name: 'Pressure Control Loop', classification: 'oscillating' },
            { id: 'loop-3', name: 'Flow Control Loop', classification: 'oscillating' }
          ]
        },
        {
          period: 12.8,
          loops: ['loop-1'],
          rootCauseLoop: 'loop-1',
          severity: 'medium',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          affectedLoops: [
            { id: 'loop-1', name: 'Temperature Control Loop', classification: 'oscillating' }
          ]
        }
      ];

      setOscillationClusters(mockClusters);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getLoopColor = (loop: Loop) => {
    // Enhanced color logic based on multiple KPIs
    const avgPerformance = (loop.serviceFactor + loop.pi + loop.rpi) / 3;
    const oscillationImpact = loop.oscillationIndex > 0.3 ? 0.2 : 0;
    const stictionImpact = loop.stictionSeverity > 0.5 ? 0.2 : 0;
    const overallScore = avgPerformance - oscillationImpact - stictionImpact;
    
    if (overallScore > 0.7) return '#4caf50'; // Green
    if (overallScore > 0.5) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  const getLoopSize = (importance: number) => {
    return Math.max(20, importance * 30); // Smaller: minimum 20px, max 50px
  };

  const filteredLoops = loops.filter(loop => {
    const matchesSearch = loop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loop.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClassification = classificationFilter === 'all' || loop.classification === classificationFilter;
    const matchesPlantArea = plantAreaFilter === 'all' || loop.plantArea === plantAreaFilter;
    const matchesCriticality = criticalityFilter === 'all' || loop.criticality === criticalityFilter;
    return matchesSearch && matchesClassification && matchesPlantArea && matchesCriticality;
  });

  const plantAreas = [...new Set(loops.map(l => l.plantArea))];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: '100%', overflow: 'hidden' }}>
      <Typography variant="h4" gutterBottom sx={{ 
        fontWeight: 700, 
        color: '#2c3e50',
        mb: 3,
        fontSize: { xs: '1.5rem', sm: '2rem' }
      }}>
        Dashboard
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error} (Showing sample data)
        </Alert>
      )}

      {/* KPI Summary Cards */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}>
            <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5, fontSize: '0.75rem' }}>
                Total Loops
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                {kpiSummary?.totalLoops || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
          }}>
            <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5, fontSize: '0.75rem' }}>
                Normal Loops
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                {kpiSummary?.normalLoops || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
          }}>
            <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5, fontSize: '0.75rem' }}>
                Avg Service Factor
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                {(kpiSummary?.averageServiceFactor || 0).toFixed(1)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
            color: 'white',
            boxShadow: '0 4px 12px rgba(244, 67, 54, 0.3)'
          }}>
            <CardContent sx={{ p: 1.5, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5, fontSize: '0.75rem' }}>
                Exceeding Thresholds
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                {kpiSummary?.loopsExceedingThresholds || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        {/* Filters and Treemap */}
        <Grid item xs={12} lg={8}>
          {/* Enhanced Filters */}
          <Paper sx={{ p: 1.5, mb: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  fullWidth
                  label="Search Loops"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Classification</InputLabel>
                  <Select
                    value={classificationFilter}
                    label="Classification"
                    onChange={(e) => setClassificationFilter(e.target.value)}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="oscillating">Oscillating</MenuItem>
                    <MenuItem value="stiction">Stiction</MenuItem>
                    <MenuItem value="deadband">Deadband</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Plant Area</InputLabel>
                  <Select
                    value={plantAreaFilter}
                    label="Plant Area"
                    onChange={(e) => setPlantAreaFilter(e.target.value)}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MenuItem value="all">All Areas</MenuItem>
                    {plantAreas.map(area => (
                      <MenuItem key={area} value={area}>{area}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Criticality</InputLabel>
                  <Select
                    value={criticalityFilter}
                    label="Criticality"
                    onChange={(e) => setCriticalityFilter(e.target.value)}
                    sx={{ borderRadius: '8px' }}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3} md={3}>
                <Box display="flex" gap={1}>
                  <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={(newValue) => setStartDate(newValue)}
                    slotProps={{ 
                      textField: { 
                        size: 'small',
                        sx: { '& .MuiOutlinedInput-root': { borderRadius: '8px' } }
                      } 
                    }}
                  />
                  <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={(newValue) => setEndDate(newValue)}
                    slotProps={{ 
                      textField: { 
                        size: 'small',
                        sx: { '& .MuiOutlinedInput-root': { borderRadius: '8px' } }
                      } 
                    }}
                  />
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Enhanced Treemap */}
          <Paper sx={{ p: 1.5, minHeight: 50, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#2c3e50' }}>
              Loop Performance Treemap
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                p: 1,
                minHeight: 40,
                alignItems: 'flex-start',
                alignContent: 'flex-start',
                maxWidth: '100%',
                overflow: 'hidden'
              }}
            >
              {filteredLoops.map((loop) => (
                <Tooltip
                  key={loop.id}
                  title={
                    <Box sx={{ maxWidth: 280, p: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ color: '#2c3e50' }}>
                        {loop.name}
                      </Typography>
                      <Typography variant="body2" gutterBottom sx={{ fontSize: '0.8rem', color: '#666' }}>
                        {loop.description}
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      
                      {/* Key Metrics */}
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            <strong>Service Factor:</strong> {(loop.serviceFactor * 100).toFixed(1)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            <strong>PI:</strong> {loop.pi.toFixed(2)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            <strong>Oscillation:</strong> {loop.oscillationIndex.toFixed(2)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            <strong>Stiction:</strong> {(loop.stictionSeverity * 100).toFixed(0)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            <strong>Classification:</strong> {loop.classification}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                            <strong>Criticality:</strong> {loop.criticality}
                          </Typography>
                        </Grid>
                      </Grid>
                      
                      {loop.rootCause && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#e74c3c' }}>
                            <strong>Root Cause:</strong> {loop.rootCause}
                          </Typography>
                        </>
                      )}
                    </Box>
                  }
                  arrow
                >
                  <Card
                    sx={{
                      cursor: 'pointer',
                      width: getLoopSize(loop.importance),
                      height: getLoopSize(loop.importance),
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: getLoopColor(loop),
                      color: 'white',
                      border: loop.classification !== 'normal' ? '2px solid #f44336' : '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      animation: loop.classification !== 'normal' ? 'pulse 2s infinite' : 'none',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'scale(1.08)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 10
                      },
                      '@keyframes pulse': {
                        '0%, 100%': { 
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2), 0 0 0 0 rgba(244, 67, 54, 0.7)' 
                        },
                        '50%': { 
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2), 0 0 0 4px rgba(244, 67, 54, 0)' 
                        }
                      }
                    }}
                    onClick={() => navigate(`/loops/${loop.id}`)}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 0.5, width: '100%' }}>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontWeight: 'bold', 
                          display: 'block', 
                          fontSize: '0.6rem',
                          lineHeight: 1.1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%'
                        }}
                      >
                        {loop.name.length > 8 ? loop.name.substring(0, 6) + '...' : loop.name}
                      </Typography>
                      <Chip
                        label={loop.classification.charAt(0).toUpperCase()}
                        size="small"
                        color={getClassificationColor(loop.classification) as any}
                        sx={{ 
                          mt: 0.2, 
                          mb: 0.2, 
                          height: '14px',
                          fontSize: '0.55rem',
                          minWidth: '14px',
                          '& .MuiChip-label': { px: 0.25 }
                        }}
                      />
                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.55rem', lineHeight: 1 }}>
                        {loop.serviceFactor.toFixed(1)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Tooltip>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Root-Cause Alerts Panel */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 1.5, height: 'fit-content', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#2c3e50' }}>
                Root-Cause Alerts
              </Typography>
              <IconButton
                size="small"
                onClick={() => setAlertsExpanded(!alertsExpanded)}
                sx={{ color: '#666' }}
              >
                {alertsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            <Collapse in={alertsExpanded}>
              {oscillationClusters.length > 0 ? (
                <List dense>
                  {oscillationClusters.map((cluster, index) => (
                                         <ListItem
                       key={index}
                       sx={{
                         border: `2px solid ${cluster.severity === 'high' ? '#f44336' : cluster.severity === 'medium' ? '#ff9800' : '#2196f3'}`,
                         borderRadius: '8px',
                         mb: 1,
                         animation: 'pulse 2s infinite',
                         transition: 'all 0.2s ease-in-out',
                         '&:hover': {
                           transform: 'translateY(-1px)',
                           boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                         },
                         '@keyframes pulse': {
                           '0%, 100%': { 
                             boxShadow: `0 0 0 0 ${cluster.severity === 'high' ? 'rgba(244, 67, 54, 0.7)' : cluster.severity === 'medium' ? 'rgba(255, 152, 0, 0.7)' : 'rgba(33, 150, 243, 0.7)'}` 
                           },
                           '50%': { 
                             boxShadow: `0 0 0 4px ${cluster.severity === 'high' ? 'rgba(244, 67, 54, 0)' : cluster.severity === 'medium' ? 'rgba(255, 152, 0, 0)' : 'rgba(33, 150, 243, 0)'}` 
                           }
                         }
                       }}
                     >
                      <ListItemIcon>
                        <TimelineIcon color={getSeverityColor(cluster.severity) as any} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${cluster.period.toFixed(1)}s Period`}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              Affected: {cluster.affectedLoops.map(l => l.name).join(', ')}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Root Cause: {cluster.affectedLoops.find(l => l.id === cluster.rootCauseLoop)?.name || cluster.rootCauseLoop}
                            </Typography>
                            <Typography variant="caption" display="block">
                              {format(new Date(cluster.timestamp), 'MMM dd, HH:mm')}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No oscillation clusters detected
                </Typography>
              )}
            </Collapse>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
