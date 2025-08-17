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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Link
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = (import.meta as any).env.VITE_API_BASE || 'http://localhost:8080/api/v1';

interface OscillationCluster {
  id: string;
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

export default function OscillationClusters() {
  const [clusters, setClusters] = useState<OscillationCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState('24h');
  const navigate = useNavigate();

  useEffect(() => {
    fetchClusters();
  }, [timeWindow]);

  const fetchClusters = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data for demo
      const mockClusters: OscillationCluster[] = [
        {
          id: 'cluster-1',
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
          id: 'cluster-2',
          period: 12.8,
          loops: ['loop-1'],
          rootCauseLoop: 'loop-1',
          severity: 'medium',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          affectedLoops: [
            { id: 'loop-1', name: 'Temperature Control Loop', classification: 'oscillating' }
          ]
        },
        {
          id: 'cluster-3',
          period: 8.5,
          loops: ['loop-4', 'loop-5'],
          rootCauseLoop: 'loop-4',
          severity: 'low',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          affectedLoops: [
            { id: 'loop-4', name: 'Level Control Loop', classification: 'oscillating' },
            { id: 'loop-5', name: 'pH Control Loop', classification: 'oscillating' }
          ]
        }
      ];
      
      setClusters(mockClusters);
    } catch (err: any) {
      console.error('Error fetching clusters:', err);
      setError(err.response?.data?.message || 'Failed to fetch oscillation clusters');
    } finally {
      setLoading(false);
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

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'normal': return 'success';
      case 'oscillating': return 'warning';
      case 'stiction': return 'error';
      case 'deadband': return 'info';
      default: return 'default';
    }
  };

  // Generate histogram data for oscillation periods
  const periodHistogram = clusters.reduce((acc, cluster) => {
    const periodRange = Math.floor(cluster.period / 2) * 2;
    const key = `${periodRange}-${periodRange + 2}s`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const histogramData = Object.entries(periodHistogram).map(([range, count]) => ({
    range,
    count
  }));

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Oscillation Clusters & Root-Cause Analysis
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error} (Showing sample data)
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Time Window</InputLabel>
              <Select
                value={timeWindow}
                label="Time Window"
                onChange={(e) => setTimeWindow(e.target.value)}
              >
                <MenuItem value="1h">Last hour</MenuItem>
                <MenuItem value="6h">Last 6 hours</MenuItem>
                <MenuItem value="24h">Last 24 hours</MenuItem>
                <MenuItem value="7d">Last 7 days</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={8}>
            <Typography variant="body2" color="textSecondary">
              Showing {clusters.length} oscillation clusters detected in the selected time window
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Clusters Table */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Current Oscillation Clusters
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Period (s)</TableCell>
                    <TableCell>Affected Loops</TableCell>
                    <TableCell>Root Cause</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Detected</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clusters.map((cluster) => (
                    <TableRow key={cluster.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {cluster.period.toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          {cluster.affectedLoops.map((loop) => (
                            <Chip
                              key={loop.id}
                              label={loop.name}
                              size="small"
                              color={getClassificationColor(loop.classification) as any}
                              sx={{ mr: 0.5, mb: 0.5 }}
                              onClick={() => navigate(`/loops/${loop.id}`)}
                              style={{ cursor: 'pointer' }}
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => {
                            const rootLoop = cluster.affectedLoops.find(l => l.id === cluster.rootCauseLoop);
                            if (rootLoop) {
                              navigate(`/loops/${cluster.rootCauseLoop}`);
                            }
                          }}
                          sx={{ textDecoration: 'none' }}
                        >
                          {cluster.affectedLoops.find(l => l.id === cluster.rootCauseLoop)?.name || cluster.rootCauseLoop}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={cluster.severity}
                          color={getSeverityColor(cluster.severity) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(cluster.timestamp).toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Period Distribution */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Oscillation Period Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={histogramData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Summary Statistics */}
      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Clusters
              </Typography>
              <Typography variant="h4">
                {clusters.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                High Severity
              </Typography>
              <Typography variant="h4" color="error.main">
                {clusters.filter(c => c.severity === 'high').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Affected Loops
              </Typography>
              <Typography variant="h4">
                {new Set(clusters.flatMap(c => c.loops)).size}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg Period
              </Typography>
              <Typography variant="h4">
                {clusters.length > 0 ? 
                  (clusters.reduce((sum, c) => sum + c.period, 0) / clusters.length).toFixed(1) : '0'}s
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Analysis Summary */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Analysis Summary
        </Typography>
        <Typography variant="body2" paragraph>
          {clusters.length > 0 ? (
            <>
              {clusters.length} oscillation cluster{clusters.length > 1 ? 's' : ''} {clusters.length > 1 ? 'have been' : 'has been'} detected 
              in the last {timeWindow}. The most common oscillation period is around{' '}
              {histogramData.length > 0 ? 
                histogramData.reduce((max, item) => item.count > max.count ? item : max).range : 'unknown'}.
              {clusters.filter(c => c.severity === 'high').length > 0 && (
                <> {clusters.filter(c => c.severity === 'high').length} high-severity cluster{clusters.filter(c => c.severity === 'high').length > 1 ? 's' : ''} require immediate attention.</>
              )}
            </>
          ) : (
            'No oscillation clusters detected in the selected time window.'
          )}
        </Typography>
        <Typography variant="body2">
          Root-cause analysis identifies the primary loop responsible for each oscillation pattern, 
          helping engineers focus their troubleshooting efforts on the most critical issues.
        </Typography>
      </Paper>
    </Box>
  );
}
