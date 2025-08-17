import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';

const API = (import.meta as any).env.VITE_API_BASE || 'http://localhost:8080/api/v1';

interface APCAttainment {
  timestamp: string;
  usefulness: number;
  criticality: number;
  reliability: number;
  acceptance: number;
  value: number;
  uptime: number;
  overall: number;
}

interface APCController {
  id: string;
  name: string;
  description: string;
}

export default function APCAttainment() {
  const [controllers, setControllers] = useState<APCController[]>([]);
  const [selectedController, setSelectedController] = useState<string>('');
  const [attainmentData, setAttainmentData] = useState<APCAttainment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchControllers();
  }, []);

  useEffect(() => {
    if (selectedController) {
      fetchAttainmentData();
    }
  }, [selectedController]);

  const fetchControllers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data for demo
      const mockControllers: APCController[] = [
        {
          id: 'apc-1',
          name: 'Distillation Column APC',
          description: 'Advanced control for distillation column optimization'
        },
        {
          id: 'apc-2',
          name: 'Reactor Temperature APC',
          description: 'Temperature control optimization for reactor'
        },
        {
          id: 'apc-3',
          name: 'Furnace Control APC',
          description: 'Furnace efficiency optimization'
        }
      ];
      
      setControllers(mockControllers);
      if (mockControllers.length > 0) {
        setSelectedController(mockControllers[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching controllers:', err);
      setError(err.response?.data?.message || 'Failed to fetch controllers');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttainmentData = async () => {
    try {
      setLoading(true);
      
      // Generate mock attainment data
      const now = Date.now();
      const mockData: APCAttainment[] = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(now - (24 - i) * 3600000).toISOString(),
        usefulness: 0.85 + Math.random() * 0.1,
        criticality: 0.9 + Math.random() * 0.05,
        reliability: 0.88 + Math.random() * 0.08,
        acceptance: 0.92 + Math.random() * 0.06,
        value: 0.87 + Math.random() * 0.09,
        uptime: 0.95 + Math.random() * 0.04,
        overall: 0.89 + Math.random() * 0.08
      }));
      
      setAttainmentData(mockData);
    } catch (err: any) {
      console.error('Error fetching attainment data:', err);
      setError('Failed to fetch attainment data');
    } finally {
      setLoading(false);
    }
  };

  const getAttainmentColor = (value: number) => {
    if (value >= 0.9) return '#4caf50';
    if (value >= 0.8) return '#ff9800';
    return '#f44336';
  };

  const selectedControllerData = controllers.find(c => c.id === selectedController);

  if (loading && controllers.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        APC Attainment
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error} (Showing sample data)
        </Alert>
      )}

      {/* Controller Selection */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Select Controller</InputLabel>
              <Select
                value={selectedController}
                label="Select Controller"
                onChange={(e) => setSelectedController(e.target.value)}
              >
                {controllers.map((controller) => (
                  <MenuItem key={controller.id} value={controller.id}>
                    {controller.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {selectedControllerData && (
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="textSecondary">
                {selectedControllerData.description}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {selectedController && (
        <>
          {/* Summary Statistics */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {attainmentData.length > 0 && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Mean Overall Attainment
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{ color: getAttainmentColor(attainmentData.reduce((sum, d) => sum + d.overall, 0) / attainmentData.length) }}
                      >
                        {(attainmentData.reduce((sum, d) => sum + d.overall, 0) / attainmentData.length).toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Min Overall Attainment
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{ color: getAttainmentColor(Math.min(...attainmentData.map(d => d.overall))) }}
                      >
                        {Math.min(...attainmentData.map(d => d.overall)).toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Max Overall Attainment
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{ color: getAttainmentColor(Math.max(...attainmentData.map(d => d.overall))) }}
                      >
                        {Math.max(...attainmentData.map(d => d.overall)).toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Data Points
                      </Typography>
                      <Typography variant="h4">
                        {attainmentData.length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>

          {/* Attainment Chart */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Attainment Components Over Time
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={attainmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis domain={[0, 1]} />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: any) => [value.toFixed(3), '']}
                />
                <Legend />
                <Line type="monotone" dataKey="usefulness" stroke="#8884d8" name="Usefulness" />
                <Line type="monotone" dataKey="criticality" stroke="#82ca9d" name="Criticality" />
                <Line type="monotone" dataKey="reliability" stroke="#ffc658" name="Reliability" />
                <Line type="monotone" dataKey="acceptance" stroke="#ff7300" name="Acceptance" />
                <Line type="monotone" dataKey="value" stroke="#00ff00" name="Value" />
                <Line type="monotone" dataKey="uptime" stroke="#0000ff" name="Uptime" />
                <Line type="monotone" dataKey="overall" stroke="#ff0000" name="Overall" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>

          {/* Component Breakdown */}
          <Grid container spacing={3} sx={{ mt: 3 }}>
            {attainmentData.length > 0 && (
              <>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Component Averages
                    </Typography>
                    <Grid container spacing={2}>
                      {[
                        { key: 'usefulness', label: 'Usefulness' },
                        { key: 'criticality', label: 'Criticality' },
                        { key: 'reliability', label: 'Reliability' },
                        { key: 'acceptance', label: 'Acceptance' },
                        { key: 'value', label: 'Value' },
                        { key: 'uptime', label: 'Uptime' }
                      ].map((component) => {
                        const avg = attainmentData.reduce((sum, d) => sum + (d as any)[component.key], 0) / attainmentData.length;
                        return (
                          <Grid item xs={6} key={component.key}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2">{component.label}:</Typography>
                              <Typography
                                variant="body2"
                                sx={{ color: getAttainmentColor(avg) }}
                              >
                                {avg.toFixed(3)}
                              </Typography>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Performance Summary
                    </Typography>
                    <Typography variant="body2" paragraph>
                      This APC controller shows {attainmentData.length > 0 ? 
                        (attainmentData.reduce((sum, d) => sum + d.overall, 0) / attainmentData.length > 0.9 ? 'excellent' :
                         attainmentData.reduce((sum, d) => sum + d.overall, 0) / attainmentData.length > 0.8 ? 'good' : 'poor') 
                        : 'unknown'} overall attainment performance.
                    </Typography>
                    <Typography variant="body2">
                      The controller has been active for the last {attainmentData.length} hours with consistent performance metrics.
                    </Typography>
                  </Paper>
                </Grid>
              </>
            )}
          </Grid>
        </>
      )}
    </Box>
  );
}
