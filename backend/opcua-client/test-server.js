import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3002;

app.use(cors({
  origin: ['http://localhost:5174', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Test OPC UA Server'
  });
});

// Basic servers endpoint
app.get('/api/v1/servers', (req, res) => {
  res.json([]);
});

app.post('/api/v1/servers', (req, res) => {
  console.log('Received server creation request:', req.body);
  res.status(201).json({
    id: 'test-server-' + Date.now(),
    ...req.body
  });
});

app.get('*', (req, res) => {
  console.log('Unmatched request:', req.method, req.path);
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server listening on port ${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/health`);
  console.log(`Servers endpoint: http://localhost:${PORT}/api/v1/servers`);
});