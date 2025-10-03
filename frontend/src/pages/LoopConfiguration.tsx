import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Card,
  CardContent,
  CardHeader,
  Slider,
  Chip,
  Tabs,
  Tab,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { 
  Save, 
  Refresh, 
  Settings, 
  Add as AddIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { AlertTriangle, Gauge, Database } from 'lucide-react';
import { Dialog } from '../components/ui/dialog';

export default function LoopConfiguration() {
  const [defaultSamplingInterval, setDefaultSamplingInterval] = React.useState(1000);
  const [defaultKPIWindow, setDefaultKPIWindow] = React.useState(3600);
  const [defaultOscillationLimit, setDefaultOscillationLimit] = React.useState(0.1);
  const [defaultImportance, setDefaultImportance] = React.useState(5);
  const [autoDiscovery, setAutoDiscovery] = React.useState(true);
  const [performanceMonitoring, setPerformanceMonitoring] = React.useState(true);
  const [alerting, setAlerting] = React.useState(true);
  const [dataRetention, setDataRetention] = React.useState(90);
  const [currentTab, setCurrentTab] = React.useState(0);
  const [loops, setLoops] = React.useState<any[]>([]);
  const [showLoopDialog, setShowLoopDialog] = React.useState(false);
  const [editingLoop, setEditingLoop] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [csvImportDialog, setCsvImportDialog] = React.useState(false);
  const [csvData, setCsvData] = React.useState('');
  const [availableConnections, setAvailableConnections] = React.useState<any[]>([]);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    connectionId: '',
    samplingInterval: 1000,
    kpiWindow: 3600,
    oscillationLimit: 0.1,
    importance: 5,
    tags: {} as Record<string, any>
  });
    
  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Saving loop configuration...');
  };

  const handleRefresh = () => {
    // TODO: Implement refresh functionality
    console.log('Refreshing loop configuration...');
  };

  const handleResetDefaults = () => {
    setDefaultSamplingInterval(1000);
    setDefaultKPIWindow(3600);
    setDefaultOscillationLimit(0.1);
    setDefaultImportance(5);
    setAutoDiscovery(true);
    setPerformanceMonitoring(true);
    setAlerting(true);
    setDataRetention(90);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      connectionId: '',
      samplingInterval: 1000,
      kpiWindow: 3600,
      oscillationLimit: 0.1,
      importance: 5,
      tags: {}
    });
  };

  const handleSaveLoop = () => {
    console.log('Saving loop:', formData);
    setShowLoopDialog(false);
    setEditingLoop(null);
    resetForm();
  };

  const handleDeleteLoop = (loopId: string) => {
    if (confirm('Are you sure you want to delete this loop?')) {
      setLoops(prev => prev.filter(loop => loop.id !== loopId));
    }
  };


  const generateCsvTemplate = () => {
    const template = 'name,description,connectionId,pvTag,spTag,opTag,modeTag,valveTag,samplingInterval,kpiWindow,oscillationLimit,importance\nLoop001,Temperature Control Loop,connection1,ns=2;s=TIC001.PV,ns=2;s=TIC001.SP,ns=2;s=TIC001.OP,,,1000,3600,0.1,5';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'loop_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCsvImport = () => {
    console.log('Importing CSV data:', csvData);
    setCsvImportDialog(false);
    setCsvData('');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Loop Configuration
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)} aria-label="loop configuration tabs"> 
          <Tab label="Default Settings" icon={<Settings />} />
          <Tab label="Loop Management" icon={<Database />} />
        </Tabs>
      </Box>
      
      {currentTab === 0 && (
      <Grid container spacing={3}>
        {/* Default Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Default Settings" 
              avatar={<Settings />}
              subheader="Default values for new control loops"
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography gutterBottom>
                    Default Sampling Interval (ms)
                  </Typography>
                  <Slider
                    value={defaultSamplingInterval}
                    onChange={(_, value) => setDefaultSamplingInterval(value as number)}
                    min={100}
                    max={10000}
                    step={100}
                    marks={[
                      { value: 100, label: '100ms' },
                      { value: 1000, label: '1s' },
                      { value: 5000, label: '5s' },
                      { value: 10000, label: '10s' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Current: {defaultSamplingInterval}ms
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography gutterBottom>
                    Default KPI Window (seconds)
                  </Typography>
                  <Slider
                    value={defaultKPIWindow}
                    onChange={(_, value) => setDefaultKPIWindow(value as number)}
                    min={300}
                    max={7200}
                    step={300}
                    marks={[
                      { value: 300, label: '5m' },
                      { value: 900, label: '15m' },
                      { value: 1800, label: '30m' },
                      { value: 3600, label: '1h' },
                      { value: 7200, label: '2h' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Current: {defaultKPIWindow}s
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography gutterBottom>
                    Default Oscillation Limit
                  </Typography>
                  <Slider
                    value={defaultOscillationLimit}
                    onChange={(_, value) => setDefaultOscillationLimit(value as number)}
                    min={0.01}
                    max={1.0}
                    step={0.01}
                    marks={[
                      { value: 0.01, label: '0.01' },
                      { value: 0.1, label: '0.1' },
                      { value: 0.5, label: '0.5' },
                      { value: 1.0, label: '1.0' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Current: {defaultOscillationLimit}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography gutterBottom>
                    Default Importance Level
                  </Typography>
                  <Slider
                    value={defaultImportance}
                    onChange={(_, value) => setDefaultImportance(value as number)}
                    min={1}
                    max={10}
                    step={1}
                    marks={[
                      { value: 1, label: 'Low' },
                      { value: 5, label: 'Medium' },
                      { value: 10, label: 'High' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Current: {defaultImportance}/10
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* System Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="System Settings" 
              avatar={<Gauge />}
              subheader="Global loop management settings"
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoDiscovery}
                        onChange={(e) => setAutoDiscovery(e.target.checked)}
                      />
                    }
                    label="Auto-discovery of new loops"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Automatically detect and configure new control loops
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={performanceMonitoring}
                        onChange={(e) => setPerformanceMonitoring(e.target.checked)}
                      />
                    }
                    label="Performance monitoring"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Enable real-time performance monitoring for all loops
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={alerting}
                        onChange={(e) => setAlerting(e.target.checked)}
                      />
                    }
                    label="Alerting system"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Enable automated alerts for loop performance issues
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Data Retention (days)"
                    type="number"
                    value={dataRetention}
                    onChange={(e) => setDataRetention(Number(e.target.value))}
                    inputProps={{ min: 1, max: 365 }}
                    helperText="How long to keep historical loop data"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Thresholds */}
        <Grid item xs={12}>
          <Card>
            <CardHeader 
              title="Performance Thresholds" 
              avatar={<AlertTriangle />}
              subheader="Thresholds for performance monitoring and alerting"
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Oscillation Warning
                  </Typography>
                  <Chip label="0.05" color="warning" variant="outlined" />
                  <Typography variant="body2" color="text.secondary">
                    Warning threshold for oscillation detection
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Oscillation Critical
                  </Typography>
                  <Chip label="0.1" color="error" variant="outlined" />
                  <Typography variant="body2" color="text.secondary">
                    Critical threshold for oscillation detection
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    RPI Warning
                  </Typography>
                  <Chip label="0.8" color="warning" variant="outlined" />
                  <Typography variant="body2" color="text.secondary">
                    Warning threshold for RPI performance
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    RPI Critical
                  </Typography>
                  <Chip label="0.6" color="error" variant="outlined" />
                  <Typography variant="body2" color="text.secondary">
                    Critical threshold for RPI performance
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Actions */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Actions" />
            <CardContent>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={handleResetDefaults}
                  color="secondary"
                >
                  Reset to Defaults
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={handleRefresh}
                >
                  Refresh
                </Button>
                
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSave}
                  color="primary"
                >
                  Save Configuration
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      )}
      
      {currentTab === 1 && (
        <Grid container spacing={3}>
          {/* Loop Management Header */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Control Loop Management
                  </Typography>
                  <Box display="flex" gap={1}>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={generateCsvTemplate}
                      size="small"
                    >
                      CSV Template
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<UploadIcon />}
                      onClick={() => setCsvImportDialog(true)}
                      size="small"
                    >
                      Import CSV
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        resetForm();
                        setShowLoopDialog(true);
                      }}
                    >
                      Add Loop
                    </Button>
                  </Box>
                </Box>
                
                <Alert severity="info" sx={{ mb: 2 }}>
                  Configure individual control loops by selecting OPC UA tags for PV, SP, OP, and other signals.
                  Use the tag browser to easily select tags from connected OPC UA servers.
                </Alert>
              </CardContent>
            </Card>
          </Grid>

          {/* Loops Table */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Connection</TableCell>
                        <TableCell>Tags</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loops.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Box py={4}>
                              <Typography variant="body2" color="textSecondary">
                                No loops configured. Click "Add Loop" to get started.
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        loops.map((loop) => (
                          <TableRow key={loop.id}>
                            <TableCell>{loop.name}</TableCell>
                            <TableCell>{loop.description}</TableCell>
                            <TableCell>{loop.connectionName || loop.connectionId}</TableCell>
                            <TableCell>
                              <Box display="flex" gap={0.5} flexWrap="wrap">
                                {(Object.entries(loop.tags) as [string, any][]).map(([type, tag]) =>
                                  tag ? (
                                    <Chip
                                      key={type}
                                      label={type}
                                      size="small"
                                      variant="outlined"
                                      color={type === 'PV' ? 'primary' : type === 'SP' ? 'secondary' : 'default'}
                                    />
                                  ) : null
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={loop.status}
                                size="small"
                                color={loop.status === 'active' ? 'success' : loop.status === 'error' ? 'error' : 'default'}
                              />
                            </TableCell>
                            <TableCell>
                              <Box display="flex" gap={0.5}>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingLoop(loop);
                                    setFormData({
                                      name: loop.name,
                                      description: loop.description,
                                      connectionId: loop.connectionId,
                                      samplingInterval: loop.samplingInterval,
                                      kpiWindow: loop.kpiWindow,
                                      oscillationLimit: loop.oscillationLimit,
                                      importance: loop.importance,
                                      tags: loop.tags
                                    });
                                    setShowLoopDialog(true);
                                  }}
                                  title="Edit"
                                >
                                  <EditIcon />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteLoop(loop.id)}
                                  title="Delete"
                                  color="error"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Loop Dialog */}
      <Dialog open={showLoopDialog} onClose={() => setShowLoopDialog(false)} maxWidth="lg">
        <DialogTitle>
          {editingLoop ? 'Edit Loop' : 'Add New Loop'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Loop Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>OPC UA Connection</InputLabel>
                <Select
                  value={formData.connectionId}
                  label="OPC UA Connection"
                  onChange={(e) => setFormData(prev => ({ ...prev, connectionId: e.target.value }))}
                  required
                >
                  {availableConnections.map((conn) => (
                    <MenuItem key={conn.id} value={conn.id}>
                      {conn.endpointUrl} ({conn.status})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>

            {/* Tag Configuration */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>OPC UA Tags</Typography>
              <Grid container spacing={2}>
                {(['PV', 'SP', 'OP', 'MODE', 'VALVE'] as const).map((tagType) => (
                  <Grid item xs={12} md={6} key={tagType}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="subtitle2" color={tagType === 'PV' ? 'primary' : tagType === 'SP' ? 'secondary' : 'textSecondary'}>
                            {tagType} Tag {['PV', 'SP', 'OP'].includes(tagType) && '*'}
                          </Typography>
                          <Button
                            size="small"
                            startIcon={<SearchIcon />}
                            disabled={true}
                          >
                            Browse (Disabled)
                          </Button>
                        </Box>
                        {formData.tags[tagType] ? (
                          <Box>
                            <Typography variant="body2" noWrap title={formData.tags[tagType]!.displayName}>
                              <strong>{formData.tags[tagType]!.displayName}</strong>
                            </Typography>
                            <Typography variant="caption" color="textSecondary" noWrap title={formData.tags[tagType]!.nodeId}>
                              {formData.tags[tagType]!.nodeId}
                            </Typography>
                            <Box mt={1}>
                              <Button
                                size="small"
                                color="error"
                                onClick={() => {
                                  setFormData(prev => {
                                    const newTags = { ...prev.tags };
                                    delete newTags[tagType];
                                    return { ...prev, tags: newTags };
                                  });
                                }}
                              >
                                Remove
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="textSecondary">
                            No tag selected
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Loop Parameters */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Loop Parameters</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Sampling Interval (ms)"
                    type="number"
                    value={formData.samplingInterval}
                    onChange={(e) => setFormData(prev => ({ ...prev, samplingInterval: parseInt(e.target.value) }))}
                    inputProps={{ min: 100, max: 10000 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="KPI Window (s)"
                    type="number"
                    value={formData.kpiWindow}
                    onChange={(e) => setFormData(prev => ({ ...prev, kpiWindow: parseInt(e.target.value) }))}
                    inputProps={{ min: 300, max: 7200 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Oscillation Limit"
                    type="number"
                    value={formData.oscillationLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, oscillationLimit: parseFloat(e.target.value) }))}
                    inputProps={{ min: 0.01, max: 1.0, step: 0.01 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Importance (1-10)"
                    type="number"
                    value={formData.importance}
                    onChange={(e) => setFormData(prev => ({ ...prev, importance: parseInt(e.target.value) }))}
                    inputProps={{ min: 1, max: 10 }}
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowLoopDialog(false);
            setEditingLoop(null);
            resetForm();
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveLoop}
            variant="contained"
            disabled={loading || !formData.name || !formData.connectionId || !formData.tags.PV || !formData.tags.SP || !formData.tags.OP}
          >
            {loading ? 'Saving...' : editingLoop ? 'Update' : 'Create'} Loop
          </Button>
        </DialogActions>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvImportDialog} onClose={() => setCsvImportDialog(false)} maxWidth="md">
        <DialogTitle>Import Loops from CSV</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Upload a CSV file with loop configurations. Download the template to see the required format.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={10}
            label="CSV Data"
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            placeholder="name,description,connectionId,pvTag,spTag,opTag,modeTag,valveTag,samplingInterval,kpiWindow,oscillationLimit,importance&#10;Loop001,Temperature Control Loop,connection1,ns=2;s=TIC001.PV,ns=2;s=TIC001.SP,ns=2;s=TIC001.OP,,,1000,3600,0.1,5"
            helperText="Paste CSV content here or drag and drop a CSV file"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={generateCsvTemplate} startIcon={<DownloadIcon />}>
            Download Template
          </Button>
          <Button onClick={() => setCsvImportDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleCsvImport} variant="contained" disabled={!csvData.trim()}>
            Import
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
