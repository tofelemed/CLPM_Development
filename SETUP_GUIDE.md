# CLPM Setup Guide

## Quick Start

### Option 1: Using Startup Scripts (Recommended)

**Windows Command Prompt:**
```bash
start-all.bat
```

**Windows PowerShell:**
```powershell
.\start-services.ps1
```

### Option 2: Using Docker Compose
```bash
docker-compose up -d
```

## Environment Variables for Local Development

If you're running services locally (not in Docker), create these environment files:

### Backend API Gateway (`backend/api-gateway/.env.local`)
```bash
DATABASE_URL=postgresql://clpm:clpm_pwd@localhost:5432/clpm
RABBITMQ_URL=amqp://guest:guest@localhost:5672
REDIS_URL=redis://localhost:6379/0
DIAG_SERVICE_URL=http://localhost:8050
API_PORT=8080
OPCUA_API_BASE=http://localhost:4842
```

### OPC UA Client (`backend/opcua-client/.env.local`)
```bash
NODE_ENV=development
PORT=4842
METRICS_PORT=3001
APPLICATION_NAME=CLPM OPC UA Client
APPLICATION_URI=urn:clpm:opcua:client
CERTIFICATE_DIR=./certificates
AUTO_TRUST_UNKNOWN_CERTS=true
DEFAULT_SAMPLING_INTERVAL=200
CORS_ORIGINS=*
```

### Frontend (`frontend/.env.local`)
```bash
VITE_API_BASE=http://localhost:8080/api/v1
VITE_OPCUA_API_BASE=/opcua-direct
VITE_OIDC_ISSUER=http://localhost:8081/realms/clpm
```

## Service URLs

After starting all services, you can access:

- **Frontend**: http://localhost:5173
- **API Gateway**: http://localhost:8080
- **OPC UA Client**: http://localhost:4842
- **Keycloak**: http://localhost:8081
- **RabbitMQ Management**: http://localhost:15672

## Troubleshooting

### Connection Refused Errors

If you see `ERR_CONNECTION_REFUSED` errors:

1. **Check if services are running:**
   - API Gateway should be on port 8080
   - OPC UA Client should be on port 4842
   - Database should be on port 5432

2. **Check service logs:**
   - Look at the terminal windows opened by the startup scripts
   - Check for any startup errors or port conflicts

3. **Verify ports are free:**
   ```bash
   netstat -an | findstr :8080
   netstat -an | findstr :4842
   ```

### OPC UA Client Issues

If OPC UA operations fail:

1. **Verify OPC UA Client is running on port 4842**
2. **Check the browser console for specific error messages**
3. **Test the OPC UA Client API directly:**
   ```bash
   curl http://localhost:4842/health
   ```

### Database Connection Issues

If you see database connection errors:

1. **Make sure PostgreSQL container is running:**
   ```bash
   docker ps | grep clpm-db
   ```

2. **Check database logs:**
   ```bash
   docker logs clpm-db
   ```

## Manual Service Startup

If the scripts don't work, you can start services manually:

### 1. Start Infrastructure
```bash
docker-compose up -d db mq redis keycloak
```

### 2. Start API Gateway
```bash
cd backend/api-gateway
npm install
npm run start:dev
```

### 3. Start OPC UA Client
```bash
cd backend/opcua-client
npm install
set PORT=4842  # Windows
export PORT=4842  # Linux/Mac
npm run dev
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

## Port Configuration Summary

| Service | Local Port | Docker Port | Purpose |
|---------|------------|-------------|---------|
| Frontend | 5173 | 5173 | React development server |
| API Gateway | 8080 | 8080 | NestJS backend API |
| OPC UA Client | 4842 | 4840→4842 | OPC UA operations |
| PostgreSQL | 5432 | 5432 | Database |
| RabbitMQ | 5672 | 5672 | Message queue |
| RabbitMQ Management | 15672 | 15672 | Web interface |
| Redis | 6379 | 6379 | Cache |
| Keycloak | 8081 | 8080→8081 | Authentication |
| Diagnostics | 8050 | 8050 | Python diagnostics service |
