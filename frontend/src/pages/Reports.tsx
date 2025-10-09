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
  Autocomplete
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon
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
  const [format, setFormat] = useState('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLoops, setSelectedLoops] = useState<Loop[]>([]);
  const [loops, setLoops] = useState<Loop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        timeRange,
        format
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

      const response = await axios.post(`${API_URL}/reports/generate`, payload, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: response.headers['content-type']
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from content-disposition header or create default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `report.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccess('Report generated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        reportName: reportName || `${reportType} Report`,
        reportType,
        timeRange,
        format: 'pdf'
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

      const response = await axios.post(`${API_URL}/reports/preview`, payload);
      console.log('Report Preview:', response.data);

      alert(`Preview:\nTotal Loops: ${response.data.data.summary.totalLoops}\nAvg Service Factor: ${(response.data.data.summary.avgServiceFactor * 100).toFixed(1)}%\nLoops with Issues: ${response.data.data.summary.loopsWithIssues}`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to preview report');
    } finally {
      setLoading(false);
    }
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
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Format</InputLabel>
                  <Select
                    label="Format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                  >
                    <MenuItem value="pdf">PDF</MenuItem>
                   
                    <MenuItem value="csv">CSV</MenuItem>
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
                      <Chip label="PDF" size="small" sx={{ mr: 0.5 }} />
                      <Chip label="CSV" size="small" />
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
                      <Chip label="PDF" size="small" sx={{ mr: 0.5 }} />
                      <Chip label="CSV" size="small" />
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
                      <Chip label="PDF" size="small" sx={{ mr: 0.5 }} />
                      <Chip label="CSV" size="small" />
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
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                size="large"
                onClick={handleGenerateReport}
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<VisibilityIcon />}
                size="large"
                onClick={handlePreview}
                disabled={loading}
              >
                Preview Data
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
