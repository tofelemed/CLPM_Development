import React from 'react';
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
  Alert
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

export default function Reports() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        This feature is planned for future implementation. Users will be able to generate PDF and Excel reports 
        summarizing loop performance and diagnostics with scheduling options.
      </Alert>

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
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Report Type</InputLabel>
                  <Select label="Report Type" defaultValue="">
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
                  <Select label="Time Range" defaultValue="">
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
                  <Select label="Format" defaultValue="">
                    <MenuItem value="pdf">PDF</MenuItem>
                    <MenuItem value="excel">Excel</MenuItem>
                    <MenuItem value="csv">CSV</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Loop Selection"
                  placeholder="Select loops to include (leave empty for all loops)"
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="KPIs to Include"
                  placeholder="Service Factor, PI, RPI, Oscillation Index, Stiction Severity"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Scheduling Options */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Scheduling Options
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Schedule Type</InputLabel>
                  <Select label="Schedule Type" defaultValue="">
                    <MenuItem value="once">Generate Once</MenuItem>
                    <MenuItem value="daily">Daily at Shift Change</MenuItem>
                    <MenuItem value="weekly">Weekly on Monday</MenuItem>
                    <MenuItem value="monthly">Monthly on 1st</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email Recipients"
                  placeholder="email1@company.com, email2@company.com"
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ScheduleIcon />}
                  disabled
                >
                  Schedule Report
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Report Templates */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Report Templates
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <AssessmentIcon sx={{ mr: 1 }} />
                      <Typography variant="h6">Daily Summary</Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      Daily performance summary with key KPIs and alerts
                    </Typography>
                    <Chip label="PDF" size="small" sx={{ mr: 1 }} />
                    <Chip label="Excel" size="small" />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <SettingsIcon sx={{ mr: 1 }} />
                      <Typography variant="h6">Configuration Review</Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      Loop configuration and threshold analysis report
                    </Typography>
                    <Chip label="PDF" size="small" sx={{ mr: 1 }} />
                    <Chip label="Excel" size="small" />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <AssessmentIcon sx={{ mr: 1 }} />
                      <Typography variant="h6">Diagnostic Analysis</Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" paragraph>
                      Detailed diagnostic results and root-cause analysis
                    </Typography>
                    <Chip label="PDF" size="small" sx={{ mr: 1 }} />
                    <Chip label="Excel" size="small" />
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
                startIcon={<DownloadIcon />}
                size="large"
                disabled
              >
                Generate Report
              </Button>
              <Button
                variant="outlined"
                startIcon={<SettingsIcon />}
                size="large"
                disabled
              >
                Save Template
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
