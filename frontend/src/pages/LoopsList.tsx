import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
  CircularProgress,
  Fab,
  Tooltip,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/v1';

interface Loop {
  id: string;
  name: string;
  description: string;
  pvTag: string;
  opTag: string;
  spTag: string;
  classification: 'normal' | 'oscillating' | 'stiction' | 'deadband';
  serviceFactor: number;
  lastUpdated: string;
  importance: number;
  plantArea: string;
  criticality: 'low' | 'medium' | 'high';
  pi: number;
  rpi: number;
  oscillationIndex: number;
  stictionSeverity: number;
  // Additional KPIs like Honeywell CLPM
  deadband: number;
  saturation: number;
  valveTravel: number;
  settlingTime: number;
  overshoot: number;
  controlError: number;
  valveReversals: number;
  noiseLevel: number;
}

interface CreateLoopForm {
  name: string;
  description: string;
  pvTag: string;
  opTag: string;
  spTag: string;
  importance: number;
  plantArea: string;
  criticality: 'low' | 'medium' | 'high';
}

export default function LoopsList() {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateLoopForm>({
    name: '',
    description: '',
    pvTag: '',
    opTag: '',
    spTag: '',
    importance: 0.5,
    plantArea: '',
    criticality: 'medium'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [plantAreaFilter, setPlantAreaFilter] = useState<string>('all');
  const [criticalityFilter, setCriticalityFilter] = useState<string>('all');
  const [showAlarmsOnly, setShowAlarmsOnly] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchLoops();
  }, []);

  const fetchLoops = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data for demo
      const mockLoops: Loop[] = [
        {
          id: 'loop-1',
          name: 'Temperature Control Loop',
          description: 'Reactor temperature control',
          pvTag: 'TEMP_PV',
          opTag: 'TEMP_OP',
          spTag: 'TEMP_SP',
          classification: 'normal',
          serviceFactor: 0.85,
          lastUpdated: new Date().toISOString(),
          importance: 0.9,
          plantArea: 'Reactor Section',
          criticality: 'high',
          pi: 0.78,
          rpi: 0.82,
          oscillationIndex: 0.12,
          stictionSeverity: 0.05,
          deadband: 0.02,
          saturation: 0.08,
          valveTravel: 0.75,
          settlingTime: 45,
          overshoot: 0.05,
          controlError: 1.2,
          valveReversals: 8,
          noiseLevel: 0.03
        },
        {
          id: 'loop-2',
          name: 'Pressure Control Loop',
          description: 'Distillation column pressure',
          pvTag: 'PRESS_PV',
          opTag: 'PRESS_OP',
          spTag: 'PRESS_SP',
          classification: 'oscillating',
          serviceFactor: 0.45,
          lastUpdated: new Date().toISOString(),
          importance: 0.7,
          plantArea: 'Distillation Section',
          criticality: 'high',
          pi: 0.32,
          rpi: 0.38,
          oscillationIndex: 0.78,
          stictionSeverity: 0.15,
          deadband: 0.15,
          saturation: 0.25,
          valveTravel: 0.45,
          settlingTime: 180,
          overshoot: 0.25,
          controlError: 4.8,
          valveReversals: 25,
          noiseLevel: 0.12
        },
        {
          id: 'loop-3',
          name: 'Flow Control Loop',
          description: 'Feed flow rate control',
          pvTag: 'FLOW_PV',
          opTag: 'FLOW_OP',
          spTag: 'FLOW_SP',
          classification: 'stiction',
          serviceFactor: 0.62,
          lastUpdated: new Date().toISOString(),
          importance: 0.8,
          plantArea: 'Feed Section',
          criticality: 'medium',
          pi: 0.58,
          rpi: 0.61,
          oscillationIndex: 0.25,
          stictionSeverity: 0.68,
          deadband: 0.08,
          saturation: 0.18,
          valveTravel: 0.35,
          settlingTime: 90,
          overshoot: 0.12,
          controlError: 2.8,
          valveReversals: 12,
          noiseLevel: 0.06
        },
        {
          id: 'loop-4',
          name: 'Level Control Loop',
          description: 'Tank level control',
          pvTag: 'LEVEL_PV',
          opTag: 'LEVEL_OP',
          spTag: 'LEVEL_SP',
          classification: 'normal',
          serviceFactor: 0.92,
          lastUpdated: new Date().toISOString(),
          importance: 0.6,
          plantArea: 'Storage Section',
          criticality: 'low',
          pi: 0.88,
          rpi: 0.91,
          oscillationIndex: 0.08,
          stictionSeverity: 0.03,
          deadband: 0.01,
          saturation: 0.03,
          valveTravel: 0.85,
          settlingTime: 30,
          overshoot: 0.02,
          controlError: 0.6,
          valveReversals: 4,
          noiseLevel: 0.02
        },
        {
          id: 'loop-5',
          name: 'pH Control Loop',
          description: 'pH control for neutralization',
          pvTag: 'PH_PV',
          opTag: 'PH_OP',
          spTag: 'PH_SP',
          classification: 'deadband',
          serviceFactor: 0.35,
          lastUpdated: new Date().toISOString(),
          importance: 0.5,
          plantArea: 'Treatment Section',
          criticality: 'medium',
          pi: 0.28,
          rpi: 0.31,
          oscillationIndex: 0.45,
          stictionSeverity: 0.22,
          deadband: 0.25,
          saturation: 0.35,
          valveTravel: 0.25,
          settlingTime: 240,
          overshoot: 0.35,
          controlError: 7.1,
          valveReversals: 35,
          noiseLevel: 0.18
        }
      ];

      setLoops(mockLoops);
    } catch (err: any) {
      console.error('Error fetching loops:', err);
      setError(err.response?.data?.message || 'Failed to fetch loops');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLoop = async () => {
    try {
      // In production, this would be an API call
      const newLoop: Loop = {
        id: `loop-${Date.now()}`,
        ...createForm,
        classification: 'normal',
        serviceFactor: 0.0,
        lastUpdated: new Date().toISOString(),
        pi: 0.0,
        rpi: 0.0,
        oscillationIndex: 0.0,
        stictionSeverity: 0.0,
        deadband: 0.0,
        saturation: 0.0,
        valveTravel: 0.0,
        settlingTime: 0,
        overshoot: 0.0,
        controlError: 0.0,
        valveReversals: 0,
        noiseLevel: 0.0
      };
      
      setLoops([...loops, newLoop]);
      setCreateDialogOpen(false);
      setCreateForm({
        name: '',
        description: '',
        pvTag: '',
        opTag: '',
        spTag: '',
        importance: 0.5,
        plantArea: '',
        criticality: 'medium'
      });
    } catch (err: any) {
      console.error('Error creating loop:', err);
      setError('Failed to create loop');
    }
  };

  const handleDeleteLoop = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this loop?')) {
      try {
        // In production, this would be an API call
        setLoops(loops.filter(loop => loop.id !== id));
      } catch (err: any) {
        console.error('Error deleting loop:', err);
        setError('Failed to delete loop');
      }
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

  const isInAlarm = (loop: Loop) => {
    return loop.classification !== 'normal' || 
           loop.serviceFactor < 0.5 || 
           loop.pi < 0.5 || 
           loop.oscillationIndex > 0.3;
  };

  const filteredLoops = loops.filter(loop => {
    const matchesSearch = loop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loop.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClassification = classificationFilter === 'all' || loop.classification === classificationFilter;
    const matchesPlantArea = plantAreaFilter === 'all' || loop.plantArea === plantAreaFilter;
    const matchesCriticality = criticalityFilter === 'all' || loop.criticality === criticalityFilter;
    const matchesAlarmFilter = !showAlarmsOnly || isInAlarm(loop);
    return matchesSearch && matchesClassification && matchesPlantArea && matchesCriticality && matchesAlarmFilter;
  });

  const plantAreas = [...new Set(loops.map(l => l.plantArea))];

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      renderCell: (params) => (
        <Box>
          <Typography variant="subtitle2">{params.value}</Typography>
          <Typography variant="caption" color="textSecondary">
            {params.row.description}
          </Typography>
          {isInAlarm(params.row) && (
            <WarningIcon color="error" sx={{ fontSize: 16, ml: 1 }} />
          )}
        </Box>
      )
    },
    {
      field: 'plantArea',
      headerName: 'Plant Area',
      width: 150,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      )
    },
    {
      field: 'criticality',
      headerName: 'Criticality',
      width: 120,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          size="small" 
          color={getCriticalityColor(params.value) as any}
        />
      )
    },
    {
      field: 'classification',
      headerName: 'Classification',
      width: 140,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getClassificationColor(params.value) as any}
          size="small"
        />
      )
    },
    {
      field: 'serviceFactor',
      headerName: 'Service Factor',
      width: 130,
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value > 0.7 ? 'success.main' : params.value > 0.5 ? 'warning.main' : 'error.main'}
          sx={{ fontWeight: isInAlarm(params.row) ? 'bold' : 'normal' }}
        >
          {(params.value * 100).toFixed(1)}%
        </Typography>
      )
    },
    {
      field: 'pi',
      headerName: 'PI',
      width: 100,
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value > 0.7 ? 'success.main' : params.value > 0.5 ? 'warning.main' : 'error.main'}
          sx={{ fontWeight: isInAlarm(params.row) ? 'bold' : 'normal' }}
        >
          {params.value.toFixed(2)}
        </Typography>
      )
    },
    {
      field: 'oscillationIndex',
      headerName: 'Oscillation',
      width: 120,
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value < 0.3 ? 'success.main' : params.value < 0.5 ? 'warning.main' : 'error.main'}
          sx={{ fontWeight: isInAlarm(params.row) ? 'bold' : 'normal' }}
        >
          {params.value.toFixed(2)}
        </Typography>
      )
    },
    {
      field: 'stictionSeverity',
      headerName: 'Stiction',
      width: 100,
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value < 0.3 ? 'success.main' : params.value < 0.5 ? 'warning.main' : 'error.main'}
          sx={{ fontWeight: isInAlarm(params.row) ? 'bold' : 'normal' }}
        >
          {(params.value * 100).toFixed(0)}%
        </Typography>
      )
    },
    {
      field: 'saturation',
      headerName: 'Saturation',
      width: 100,
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value < 0.2 ? 'success.main' : params.value < 0.4 ? 'warning.main' : 'error.main'}
        >
          {(params.value * 100).toFixed(0)}%
        </Typography>
      )
    },
    {
      field: 'valveReversals',
      headerName: 'Valve Rev',
      width: 100,
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value < 15 ? 'success.main' : params.value < 25 ? 'warning.main' : 'error.main'}
        >
          {params.value}
        </Typography>
      )
    },
    {
      field: 'controlError',
      headerName: 'Control Error',
      width: 120,
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.value < 3 ? 'success.main' : params.value < 5 ? 'warning.main' : 'error.main'}
        >
          {params.value.toFixed(1)}
        </Typography>
      )
    },
    {
      field: 'lastUpdated',
      headerName: 'Last Updated',
      width: 150,
      valueGetter: (params: GridValueGetterParams) => {
        return new Date(params.value).toLocaleString();
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => navigate(`/loops/${params.row.id}`)}>
              <ViewIcon />
            </IconButton>
          </Tooltip>
          {(user?.role === 'admin' || user?.role === 'engineer') && (
            <>
              <Tooltip title="Edit Configuration">
                <IconButton size="small" onClick={() => navigate(`/loops/${params.row.id}/config`)}>
                  <EditIcon />
                </IconButton>
              </Tooltip>
              {user?.role === 'admin' && (
                <Tooltip title="Delete Loop">
                  <IconButton size="small" onClick={() => handleDeleteLoop(params.row.id)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      )
    }
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Control Loops
        </Typography>
        {(user?.role === 'admin' || user?.role === 'engineer') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Loop
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error} (Showing sample data)
        </Alert>
      )}

      {/* Enhanced Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Search Loops"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Classification</InputLabel>
              <Select
                value={classificationFilter}
                label="Classification"
                onChange={(e) => setClassificationFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="oscillating">Oscillating</MenuItem>
                <MenuItem value="stiction">Stiction</MenuItem>
                <MenuItem value="deadband">Deadband</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Plant Area</InputLabel>
              <Select
                value={plantAreaFilter}
                label="Plant Area"
                onChange={(e) => setPlantAreaFilter(e.target.value)}
              >
                <MenuItem value="all">All Areas</MenuItem>
                {plantAreas.map(area => (
                  <MenuItem key={area} value={area}>{area}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Criticality</InputLabel>
              <Select
                value={criticalityFilter}
                label="Criticality"
                onChange={(e) => setCriticalityFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showAlarmsOnly}
                  onChange={(e) => setShowAlarmsOnly(e.target.checked)}
                />
              }
              label="Show Alarms Only"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredLoops}
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          getRowClassName={(params) => 
            isInAlarm(params.row) ? 'alarm-row' : ''
          }
          sx={{
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .alarm-row': {
              backgroundColor: '#fff3e0',
              '&:hover': {
                backgroundColor: '#ffe0b2',
              },
            },
          }}
        />
      </Paper>

      {/* Create Loop Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Loop</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Loop Name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="PV Tag"
                value={createForm.pvTag}
                onChange={(e) => setCreateForm({ ...createForm, pvTag: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="OP Tag"
                value={createForm.opTag}
                onChange={(e) => setCreateForm({ ...createForm, opTag: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="SP Tag"
                value={createForm.spTag}
                onChange={(e) => setCreateForm({ ...createForm, spTag: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Plant Area</InputLabel>
                <Select
                  value={createForm.plantArea}
                  label="Plant Area"
                  onChange={(e) => setCreateForm({ ...createForm, plantArea: e.target.value })}
                >
                  {plantAreas.map(area => (
                    <MenuItem key={area} value={area}>{area}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Criticality</InputLabel>
                <Select
                  value={createForm.criticality}
                  label="Criticality"
                  onChange={(e) => setCreateForm({ ...createForm, criticality: e.target.value as any })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Importance</InputLabel>
                <Select
                  value={createForm.importance}
                  label="Importance"
                  onChange={(e) => setCreateForm({ ...createForm, importance: e.target.value as number })}
                >
                  <MenuItem value={0.1}>Low (0.1)</MenuItem>
                  <MenuItem value={0.3}>Medium-Low (0.3)</MenuItem>
                  <MenuItem value={0.5}>Medium (0.5)</MenuItem>
                  <MenuItem value={0.7}>Medium-High (0.7)</MenuItem>
                  <MenuItem value={0.9}>High (0.9)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateLoop}
            variant="contained"
            disabled={!createForm.name || !createForm.pvTag || !createForm.opTag || !createForm.spTag || !createForm.plantArea}
          >
            Create Loop
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
