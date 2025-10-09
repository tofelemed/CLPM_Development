import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Divider
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

interface Loop {
  id: string;
  name: string;
  description?: string;
}

export default function Reports() {
  const [reportName, setReportName] = useState('');
  const [reportType, setReportType] = useState('daily');
  const [timeRange, setTimeRange] = useState('24h');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLoops, setSelectedLoops] = useState<Loop[]>([]);
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [csvBlob, setCsvBlob] = useState<Blob | null>(null);
  const [csvFilename, setCsvFilename] = useState<string>('');

  // Fetch available loops
  useEffect(() => {
    const fetchLoops = async () => {
      try {
        const response = await axios.get(`${API_URL}/loops`);
        setLoops(response.data.loops || []);
      } catch (err) {
        console.error('Failed to fetch loops:', err);
        setLoops([]);
      }
    };
    fetchLoops();
  }, []);

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = {
        reportName: reportName || `${reportType} Report`,
        reportType,
        timeRange
      };

      if (timeRange === 'custom') {
        if (!startDate || !endDate) {
          throw new Error('Start and end dates are required for custom time range');
        }
        payload.startDate = startDate;
        payload.endDate = endDate;
      }

      if (selectedLoops.length > 0) {
        payload.loopIds = selectedLoops.map(l => l.id);
      }

      // First, get the preview data
      const previewResponse = await axios.post(`${API_URL}/reports/preview`, payload);
      setReportData(previewResponse.data.data);

      // Then generate CSV
      const csvPayload = { ...payload, format: 'csv' };
      const csvResponse = await axios.post(`${API_URL}/reports/generate`, csvPayload, {
        responseType: 'blob'
      });

      // Store CSV blob for download
      const blob = new Blob([csvResponse.data], {
        type: 'text/csv'
      });
      setCsvBlob(blob);

      // Extract filename
      const contentDisposition = csvResponse.headers['content-disposition'];
      let filename = `report.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      setCsvFilename(filename);

      // Show dialog with results
      setShowResultDialog(true);
      setSuccess('Report generated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!csvBlob) return;
    
    const url = window.URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', csvFilename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleCloseDialog = () => {
    setShowResultDialog(false);
    setReportData(null);
    setCsvBlob(null);
    setCsvFilename('');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Report Configuration */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Report Configuration
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Report Name"
                  placeholder="e.g., Daily Loop Performance Report"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Report Type</InputLabel>
                  <Select
                    label="Report Type"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <MenuItem value="daily">Daily Performance Summary</MenuItem>
                    <MenuItem value="weekly">Weekly Analysis</MenuItem>
                    <MenuItem value="monthly">Monthly Performance Review</MenuItem>
                    <MenuItem value="custom">Custom Report</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Time Range</InputLabel>
                  <Select
                    label="Time Range"
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                  >
                    <MenuItem value="24h">Last 24 Hours</MenuItem>
                    <MenuItem value="7d">Last 7 Days</MenuItem>
                    <MenuItem value="30d">Last 30 Days</MenuItem>
                    <MenuItem value="custom">Custom Range</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {timeRange === 'custom' && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Start Date"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="End Date"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  options={loops}
                  getOptionLabel={(option) => `${option.name} (${option.id})`}
                  value={selectedLoops}
                  onChange={(_, newValue) => setSelectedLoops(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Loop Selection"
                      placeholder="Select loops to include (leave empty for all loops)"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Quick Templates */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Templates
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Card
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => {
                    setReportType('daily');
                    setTimeRange('24h');
                    setReportName('Daily Performance Summary');
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={1}>
                      <AssessmentIcon sx={{ mr: 1 }} />
                      <Typography variant="subtitle1">Daily Summary</Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      24-hour performance summary with key KPIs
                    </Typography>
                    <Box mt={1}>
                      <Chip label="CSV Export" size="small" color="primary" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => {
                    setReportType('weekly');
                    setTimeRange('7d');
                    setReportName('Weekly Analysis Report');
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={1}>
                      <SettingsIcon sx={{ mr: 1 }} />
                      <Typography variant="subtitle1">Weekly Analysis</Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      7-day performance trends and analysis
                    </Typography>
                    <Box mt={1}>
                      <Chip label="CSV Export" size="small" color="primary" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Card
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => {
                    setReportType('monthly');
                    setTimeRange('30d');
                    setReportName('Monthly Performance Review');
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={1}>
                      <AssessmentIcon sx={{ mr: 1 }} />
                      <Typography variant="subtitle1">Monthly Review</Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      30-day comprehensive performance review
                    </Typography>
                    <Box mt={1}>
                      <Chip label="CSV Export" size="small" color="primary" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="center" gap={2}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AssessmentIcon />}
                size="large"
                onClick={handleGenerateReport}
                disabled={loading}
              >
                {loading ? 'Generating Report...' : 'Generate Report'}
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
              Report will be generated in CSV format. You can download or print to PDF from the results dialog.
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Results Dialog */}
      <Dialog
        open={showResultDialog}
        onClose={handleCloseDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            '@media print': {
              boxShadow: 'none',
              maxWidth: '100%',
              margin: 0
            }
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', '@media print': { display: 'none' } }}>
          <Typography variant="h5">Report Results</Typography>
          <IconButton onClick={handleCloseDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent dividers>
          {reportData && (
            <Box>
              {/* Report Metadata */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                <Typography variant="h6" gutterBottom>
                  {reportData.metadata.reportName}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Report Type:</strong> {reportData.metadata.reportType}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Generated:</strong> {new Date(reportData.metadata.generatedAt).toLocaleString()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Period:</strong> {new Date(reportData.metadata.timeRange.start).toLocaleString()} to {new Date(reportData.metadata.timeRange.end).toLocaleString()}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Summary Section */}
              <Typography variant="h6" gutterBottom>Executive Summary</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>Total Loops</Typography>
                      <Typography variant="h4">{reportData.summary.totalLoops}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>Avg Service Factor</Typography>
                      <Typography variant="h4" color={reportData.summary.avgServiceFactor >= 0.75 ? 'success.main' : 'error.main'}>
                        {(reportData.summary.avgServiceFactor * 100).toFixed(1)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>Loops with Issues</Typography>
                      <Typography variant="h4" color={reportData.summary.loopsWithIssues === 0 ? 'success.main' : 'warning.main'}>
                        {reportData.summary.loopsWithIssues}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>Avg Performance Index</Typography>
                      <Typography variant="h4" color={reportData.summary.avgPI >= 0.65 ? 'success.main' : 'error.main'}>
                        {(reportData.summary.avgPI * 100).toFixed(1)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>Avg RPI</Typography>
                      <Typography variant="h4">
                        {(reportData.summary.avgRPI * 100).toFixed(1)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>Health Score</Typography>
                      <Typography variant="h4" color={reportData.summary.healthPercentage >= 70 ? 'success.main' : 'warning.main'}>
                        {reportData.summary.healthPercentage}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Loop Details Table */}
              <Typography variant="h6" gutterBottom>Loop Details</Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Loop Name</strong></TableCell>
                      <TableCell align="center"><strong>Service Factor</strong></TableCell>
                      <TableCell align="center"><strong>PI</strong></TableCell>
                      <TableCell align="center"><strong>RPI</strong></TableCell>
                      <TableCell align="center"><strong>Osc Index</strong></TableCell>
                      <TableCell align="center"><strong>Stiction</strong></TableCell>
                      <TableCell align="center"><strong>Records</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.loops.filter((l: any) => l !== null).map((loop: any) => (
                      <TableRow key={loop.loop_id}>
                        <TableCell>{loop.name}</TableCell>
                        <TableCell align="center">
                          {loop.kpiStats ? 
                            <Chip 
                              label={`${(loop.kpiStats.avgServiceFactor * 100).toFixed(1)}%`}
                              size="small"
                              color={loop.kpiStats.avgServiceFactor >= 0.75 ? 'success' : 'error'}
                            /> : 'N/A'}
                        </TableCell>
                        <TableCell align="center">
                          {loop.kpiStats ? `${(loop.kpiStats.avgPI * 100).toFixed(1)}%` : 'N/A'}
                        </TableCell>
                        <TableCell align="center">
                          {loop.kpiStats ? `${(loop.kpiStats.avgRPI * 100).toFixed(1)}%` : 'N/A'}
                        </TableCell>
                        <TableCell align="center">
                          {loop.kpiStats ? loop.kpiStats.avgOscIndex?.toFixed(3) : 'N/A'}
                        </TableCell>
                        <TableCell align="center">
                          {loop.kpiStats ? loop.kpiStats.avgStiction?.toFixed(3) : 'N/A'}
                        </TableCell>
                        <TableCell align="center">{loop.recordCount || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 1, '@media print': { display: 'none' } }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadCSV}
            color="primary"
          >
            Download CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrintReport}
            color="primary"
          >
            Print / Save as PDF
          </Button>
          <Button onClick={handleCloseDialog} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
