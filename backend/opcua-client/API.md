# CLPM OPC UA Client REST API

This document describes the REST API endpoints for the CLPM OPC UA Client.

## Base URL

```
http://localhost:3002/api/v1
```

## Authentication

The API supports two authentication methods:

### API Key Authentication
Include the API key in the request header:
```
X-API-Key: your-api-key-here
```

### JWT Authentication
Include the JWT token in the Authorization header:
```
Authorization: Bearer your-jwt-token-here
```

## Health Endpoints

### GET /health
Basic health check (no authentication required)

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "CLPM OPC UA Client"
}
```

### GET /api/v1/health
Simple health status

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "connections": 2,
  "totalConnections": 3
}
```

### GET /api/v1/health/detailed
Detailed health information

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "connections": {
    "total": 3,
    "connected": 2,
    "disconnected": 1,
    "errors": 0
  },
  "data": {
    "samplesProcessed": 15432,
    "lastSampleTime": "2024-01-01T12:00:00.000Z",
    "batchesPublished": 154,
    "publishErrors": 0
  },
  "memory": {
    "used": 52428800,
    "total": 134217728,
    "percentage": 39.1
  }
}
```

## Server Configuration

### GET /api/v1/servers
List all configured OPC UA servers

**Response:**
```json
[
  {
    "id": "server-1",
    "name": "Production Server 1",
    "endpointUrl": "opc.tcp://server1:4840",
    "securityPolicy": "Basic256Sha256",
    "securityMode": "SignAndEncrypt",
    "userAuthMethod": "username",
    "enabled": true,
    "samplingInterval": 200,
    "maxSessionSubscriptions": 1000
  }
]
```

### GET /api/v1/servers/:serverId
Get specific server configuration

### POST /api/v1/servers
Create new server configuration

**Request Body:**
```json
{
  "id": "new-server",
  "name": "New OPC UA Server",
  "endpointUrl": "opc.tcp://newserver:4840",
  "securityPolicy": "None",
  "securityMode": "None",
  "userAuthMethod": "anonymous",
  "enabled": true,
  "samplingInterval": 200
}
```

### PUT /api/v1/servers/:serverId
Update server configuration

### DELETE /api/v1/servers/:serverId
Delete server configuration

## Loop Subscriptions

### GET /api/v1/loops
List all loop subscriptions

**Query Parameters:**
- `serverId` (optional): Filter by server ID

**Response:**
```json
[
  {
    "loopId": "LOOP-001",
    "serverId": "server-1",
    "enabled": true,
    "tags": {
      "pv": {
        "nodeId": "ns=2;s=Process.PV",
        "samplingInterval": 200,
        "queueSize": 10
      },
      "op": {
        "nodeId": "ns=2;s=Process.OP",
        "samplingInterval": 200,
        "queueSize": 10
      }
    },
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T11:00:00.000Z"
  }
]
```

### GET /api/v1/loops/:loopId
Get specific loop subscription

### POST /api/v1/loops
Create new loop subscription

**Request Body:**
```json
{
  "loopId": "LOOP-002",
  "serverId": "server-1",
  "enabled": true,
  "tags": {
    "pv": {
      "nodeId": "ns=2;s=Tank.Level",
      "samplingInterval": 500,
      "queueSize": 10,
      "deadbandAbsolute": 0.1
    }
  }
}
```

### PUT /api/v1/loops/:loopId
Update loop subscription

### DELETE /api/v1/loops/:loopId
Delete loop subscription

## Address Space Browsing

### GET /api/v1/browse/:serverId
Browse OPC UA address space

**Query Parameters:**
- `nodeId` (optional): Starting node ID (default: "RootFolder")
- `maxResults` (optional): Maximum results (default: 1000)

**Response:**
```json
[
  {
    "nodeId": "ns=2;s=Process",
    "browseName": "Process",
    "displayName": "Process Data",
    "nodeClass": "Object",
    "hasChildren": true,
    "dataType": "Object"
  }
]
```

### GET /api/v1/search/:serverId
Search for nodes in address space

**Query Parameters:**
- `q`: Search term (required)
- `maxResults` (optional): Maximum results (default: 100)

### GET /api/v1/nodes/:serverId/:nodeId
Get detailed node information

**Response:**
```json
{
  "node": {
    "nodeId": "ns=2;s=Process.PV",
    "browseName": "PV",
    "displayName": "Process Value",
    "nodeClass": "Variable",
    "dataType": "Double",
    "accessLevel": 1,
    "userAccessLevel": 1
  },
  "value": 75.42,
  "timestamp": "2024-01-01T12:00:00.000Z",
  "quality": 0
}
```

### POST /api/v1/nodes/:serverId/validate
Validate if a node exists and is readable

**Request Body:**
```json
{
  "nodeId": "ns=2;s=Process.PV"
}
```

**Response:**
```json
{
  "exists": true,
  "readable": true,
  "dataType": "Double"
}
```

### POST /api/v1/nodes/:serverId/read
Read values from multiple nodes

**Request Body:**
```json
{
  "nodeIds": [
    "ns=2;s=Process.PV",
    "ns=2;s=Process.OP",
    "ns=2;s=Process.SP"
  ]
}
```

## Certificate Management

### GET /api/v1/certificates/trusted
List trusted certificates

**Response:**
```json
[
  {
    "thumbprint": "abc123...",
    "subject": "CN=Server1,O=Company",
    "issuer": "CN=CA,O=Company",
    "validFrom": "2024-01-01T00:00:00.000Z",
    "validTo": "2025-01-01T00:00:00.000Z",
    "status": "trusted"
  }
]
```

### GET /api/v1/certificates/rejected
List rejected certificates

### POST /api/v1/certificates/:thumbprint/trust
Trust a rejected certificate

### POST /api/v1/certificates/:thumbprint/revoke
Revoke a trusted certificate

## Data Management

### POST /api/v1/data/flush
Force flush all pending data batches

**Response:**
```json
{
  "success": true
}
```

## Monitoring

### GET /api/v1/connections
Get connection status for all servers

**Response:**
```json
[
  {
    "serverId": "server-1",
    "status": "connected",
    "endpoint": "opc.tcp://server1:4840",
    "lastConnected": "2024-01-01T10:00:00.000Z",
    "activeSessions": 1,
    "monitoredItems": 5,
    "connectionQuality": "good"
  }
]
```

### GET /api/v1/status
Get overall system status

**Response:**
```json
{
  "health": {
    "status": "healthy",
    "uptime": 3600,
    "memory": {
      "used": 52428800,
      "total": 134217728,
      "percentage": 39.1
    }
  },
  "connections": {
    "total": 3,
    "connected": 2,
    "disconnected": 1,
    "errors": 0
  },
  "data": {
    "samplesProcessed": 15432,
    "batchesPublished": 154,
    "publishErrors": 0
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### GET /api/v1/metrics
Get detailed metrics (JSON format)

### GET /metrics
Get Prometheus-formatted metrics

## Error Responses

All endpoints return appropriate HTTP status codes and error messages:

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "message": "Server ID is required and must be a string"
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "message": "Provide valid API key or JWT token"
}
```

### 404 Not Found
```json
{
  "error": "Server not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "requestId": "12345"
}
```

## Rate Limiting

The API implements rate limiting:
- Default: 100 requests per 15-minute window per IP
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Reset timestamp

## CORS

Cross-Origin Resource Sharing (CORS) is enabled by default. Configure allowed origins via the `CORS_ORIGINS` environment variable.

## Request/Response Headers

### Common Request Headers
- `Content-Type: application/json`
- `X-Request-ID`: Optional request identifier for tracing
- `X-API-Key`: API key for authentication
- `Authorization: Bearer <token>`: JWT token for authentication

### Common Response Headers
- `Content-Type: application/json`
- `X-Request-ID`: Request identifier (if provided)
- `X-Response-Time`: Response time in milliseconds