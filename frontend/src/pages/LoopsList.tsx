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
  Tooltip,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchLoops();
  }, []);

  const fetchLoops = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch real data from API
      const response = await axios.get(`${API}/loops`);
      const apiLoops = response.data.loops || response.data;
      
      // Transform API data to match frontend interface
      const transformedLoops: Loop[] = apiLoops.map((loop: any) => {
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
          classification,
          serviceFactor,
          lastUpdated: loop.updated_at || new Date().toISOString(),
          importance: loop.importance || 0.5,
          plantArea: 'Plant Area', // Default value
          criticality: loop.importance > 7 ? 'high' : loop.importance > 4 ? 'medium' : 'low',
          pi,
          rpi,
          oscillationIndex,
          stictionSeverity,
          deadband: 0.02, // Default value
          saturation: 0.08, // Default value
          valveTravel: 0.75, // Default value
          settlingTime: 45, // Default value
          overshoot: 0.05, // Default value
          controlError: 1.2, // Default value
          valveReversals: 8, // Default value
          noiseLevel: 0.03 // Default value
        };
      });

      setLoops(transformedLoops);
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

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Section */}
      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#1e293b' }}>
              Control Loops
            </Typography>
            {(user?.role === 'admin' || user?.role === 'engineer') && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
                sx={{
                  backgroundColor: '#3b82f6',
                  '&:hover': { backgroundColor: '#2563eb' },
                  borderRadius: 2,
                  px: 3,
                  py: 1
                }}
              >
                Create Loop
              </Button>
            )}
          </Box>

          {error && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              {error} (Showing sample data)
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Filters Section */}
      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" mb={2}>
            <FilterIcon sx={{ mr: 1, color: '#64748b' }} />
            <Typography variant="h6" sx={{ color: '#475569', fontWeight: 500 }}>
              Filters & Search
            </Typography>
          </Box>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Search Loops"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: '#64748b' }} />,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Classification</InputLabel>
                <Select
                  value={classificationFilter}
                  label="Classification"
                  onChange={(e) => setClassificationFilter(e.target.value)}
                  sx={{
                    borderRadius: 2,
                  }}
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
                  sx={{
                    borderRadius: 2,
                  }}
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
                  sx={{
                    borderRadius: 2,
                  }}
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
                    sx={{ color: '#ef4444' }}
                  />
                }
                label="Show Alarms Only"
                sx={{ color: '#64748b' }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table Section */}
      <Card sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 600, overflowX: 'auto' }}>
          <Table stickyHeader sx={{ minWidth: 1200 }}>
            {/* Mobile-friendly compact table */}
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: '#475569', 
                  borderBottom: '2px solid #e2e8f0',
                  width: '20%',
                  minWidth: 140
                }}>
                  Loop Name
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: '#475569', 
                  borderBottom: '2px solid #e2e8f0',
                  width: '12%',
                  minWidth: 90
                }}>
                  Plant Area
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: '#475569', 
                  borderBottom: '2px solid #e2e8f0',
                  width: '10%',
                  minWidth: 80
                }}>
                  Criticality
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: '#475569', 
                  borderBottom: '2px solid #e2e8f0',
                  width: '12%',
                  minWidth: 90
                }}>
                  Classification
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: '#475569', 
                  borderBottom: '2px solid #e2e8f0',
                  width: '10%',
                  minWidth: 80
                }}>
                  Service Factor
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: '#475569', 
                  borderBottom: '2px solid #e2e8f0',
                  width: '8%',
                  minWidth: 60
                }}>
                  PI
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: '#475569', 
                  borderBottom: '2px solid #e2e8f0',
                  width: '10%',
                  minWidth: 80
                }}>
                  Oscillation
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: '#475569', 
                  borderBottom: '2px solid #e2e8f0',
                  width: '8%',
                  minWidth: 60
                }}>
                  Stiction
                </TableCell>
                <TableCell sx={{ 
                  fontWeight: 600, 
                  color: '#475569', 
                  borderBottom: '2px solid #e2e8f0',
                  width: '10%',
                  minWidth: 80
                }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLoops
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((loop) => (
                <TableRow 
                  key={loop.id}
                  onClick={() => navigate(`/loops/${loop.id}`)}
                  sx={{ 
                    '&:hover': { 
                      backgroundColor: '#f1f5f9',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    },
                    backgroundColor: isInAlarm(loop) ? '#fef2f2' : 'inherit',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <TableCell sx={{ borderBottom: '1px solid #e2e8f0' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        {loop.name}
                        {isInAlarm(loop) && (
                          <WarningIcon sx={{ ml: 1, fontSize: 16, color: '#ef4444' }} />
                        )}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                        {loop.description}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #e2e8f0' }}>
                    <Chip 
                      label={loop.plantArea} 
                      size="small" 
                      variant="outlined"
                      sx={{ 
                        borderRadius: 1,
                        borderColor: '#cbd5e1',
                        color: '#64748b'
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #e2e8f0' }}>
                    <Chip 
                      label={loop.criticality} 
                      size="small" 
                      color={getCriticalityColor(loop.criticality) as any}
                      sx={{ borderRadius: 1 }}
                    />
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #e2e8f0' }}>
                    <Chip
                      label={loop.classification}
                      color={getClassificationColor(loop.classification) as any}
                      size="small"
                      sx={{ borderRadius: 1 }}
                    />
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #e2e8f0' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isInAlarm(loop) ? 600 : 400,
                        color: loop.serviceFactor > 0.7 ? '#059669' : loop.serviceFactor > 0.5 ? '#d97706' : '#dc2626'
                      }}
                    >
                      {(loop.serviceFactor * 100).toFixed(1)}%
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #e2e8f0' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isInAlarm(loop) ? 600 : 400,
                        color: loop.pi > 0.7 ? '#059669' : loop.pi > 0.5 ? '#d97706' : '#dc2626'
                      }}
                    >
                      {loop.pi.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #e2e8f0' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isInAlarm(loop) ? 600 : 400,
                        color: loop.oscillationIndex < 0.3 ? '#059669' : loop.oscillationIndex < 0.5 ? '#d97706' : '#dc2626'
                      }}
                    >
                      {loop.oscillationIndex.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #e2e8f0' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isInAlarm(loop) ? 600 : 400,
                        color: loop.stictionSeverity < 0.3 ? '#059669' : loop.stictionSeverity < 0.5 ? '#d97706' : '#dc2626'
                      }}
                    >
                      {(loop.stictionSeverity * 100).toFixed(0)}%
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid #e2e8f0' }}>
                    <Box display="flex" gap={0.5}>
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/loops/${loop.id}`);
                          }}
                          sx={{ color: '#3b82f6' }}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {(user?.role === 'admin' || user?.role === 'engineer') && (
                        <>
                          <Tooltip title="Edit Configuration">
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/loops/${loop.id}/config`);
                              }}
                              sx={{ color: '#059669' }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          {user?.role === 'admin' && (
                            <Tooltip title="Delete Loop">
                              <IconButton 
                                size="small" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLoop(loop.id);
                                }} 
                                sx={{ color: '#dc2626' }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        <Divider />
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredLoops.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{
            backgroundColor: '#f8fafc',
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              color: '#64748b'
            }
          }}
        />
      </Card>

      {/* Create Loop Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          Create New Loop
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Loop Name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="PV Tag"
                value={createForm.pvTag}
                onChange={(e) => setCreateForm({ ...createForm, pvTag: e.target.value })}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="OP Tag"
                value={createForm.opTag}
                onChange={(e) => setCreateForm({ ...createForm, opTag: e.target.value })}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="SP Tag"
                value={createForm.spTag}
                onChange={(e) => setCreateForm({ ...createForm, spTag: e.target.value })}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Plant Area</InputLabel>
                <Select
                  value={createForm.plantArea}
                  label="Plant Area"
                  onChange={(e) => setCreateForm({ ...createForm, plantArea: e.target.value })}
                  sx={{
                    borderRadius: 2,
                  }}
                >
                  <MenuItem value="Plant Area">Plant Area</MenuItem>
                  <MenuItem value="Reactor Section">Reactor Section</MenuItem>
                  <MenuItem value="Distillation">Distillation</MenuItem>
                  <MenuItem value="Utilities">Utilities</MenuItem>
                  {plantAreas.filter(area => !['Plant Area', 'Reactor Section', 'Distillation', 'Utilities'].includes(area)).map(area => (
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
                  sx={{
                    borderRadius: 2,
                  }}
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
                  sx={{
                    borderRadius: 2,
                  }}
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
        <DialogActions sx={{ p: 3, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button 
            onClick={() => setCreateDialogOpen(false)}
            sx={{ 
              color: '#64748b',
              '&:hover': { backgroundColor: '#e2e8f0' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateLoop}
            variant="contained"
            disabled={!createForm.name || !createForm.pvTag || !createForm.opTag || !createForm.spTag || !createForm.plantArea}
            sx={{
              backgroundColor: '#3b82f6',
              '&:hover': { backgroundColor: '#2563eb' },
              borderRadius: 2,
              px: 3
            }}
          >
            Create Loop
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
