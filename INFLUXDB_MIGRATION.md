# CLPM InfluxDB Migration

This document describes the migration from OPC UA + TimescaleDB to InfluxDB architecture.

## Overview

The CLPM system has been migrated from:
- **OPC UA Client + Ingestion Service** → **InfluxDB API**
- **Raw Samples Storage** → **Direct InfluxDB Queries**
- **RabbitMQ for Real-time** → **InfluxDB Polling**

## Architecture Changes

### Before (OPC UA Architecture)
```
OPC UA Server → OPC UA Client → Ingestion → Raw Samples (TimescaleDB) → Aggregation → KPI Worker → API Gateway → Frontend
```

### After (InfluxDB Architecture)
```
InfluxDB API → Aggregation (InfluxDB Client) → Aggregated Data (PostgreSQL) → KPI Worker → API Gateway → Frontend
```

## Services Modified

### 1. Removed Services
- Data collection services - Integrated with InfluxDB API calls
- `backend/ingestion/` - No longer needed as we don't store raw samples

### 2. Modified Services

#### Aggregation Service (`backend/aggregation/`)
- **Added**: InfluxDB client integration
- **Removed**: RabbitMQ dependency
- **New Behavior**: 
  - Polls InfluxDB every 30 seconds for new data
  - Performs aggregation in memory
  - Stores only aggregated results in PostgreSQL
  - Performs historical aggregation on startup

#### KPI Worker (`backend/kpi-worker/`)
- **Added**: InfluxDB client integration
- **Removed**: RabbitMQ dependency
- **New Behavior**:
  - Queries InfluxDB directly for analysis data
  - Falls back to PostgreSQL aggregated data if available
  - Calculates KPIs from InfluxDB data

#### API Gateway (`backend/api-gateway/`)
- **Added**: InfluxDB service for data queries
- **New Endpoints**:
  - `/data/raw` - Query raw data from InfluxDB
  - `/data/aggregated` - Query aggregated data (PostgreSQL + InfluxDB fallback)
  - `/data/realtime` - Get real-time data from InfluxDB
  - `/data/range` - Get data range from both sources

## Database Changes

### Tables Removed
- `raw_samples` - No longer needed as we query InfluxDB directly

### Tables Kept
- `loops` - Loop configuration
- `loop_config` - Loop settings
- `agg_1m` - 1-minute aggregated data
- `agg_1h` - 1-hour aggregated data (if exists)
- `kpi_results` - KPI calculation results
- `diagnostic_results` - Diagnostic analysis results
- `apc_attainment` - APC performance data

## Configuration

### Environment Variables

#### Database Configuration
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=clpm
POSTGRES_USER=clpm
POSTGRES_PASSWORD=clpm_pwd
DATABASE_URL=postgresql://clpm:clpm_pwd@localhost:5432/clpm
```

#### Cache Configuration
```env
REDIS_URL=redis://localhost:6379/0
```

#### Auth Configuration (Keycloak)
```env
OIDC_ISSUER=http://localhost:8081/realms/clpm
OIDC_AUDIENCE=clpm-api
OIDC_JWKS_URI=http://localhost:8081/realms/clpm/protocol/openid-connect/certs
```

#### Diagnostics Service
```env
DIAG_SERVICE_URL=http://localhost:8050
```

#### API Configuration
```env
API_PORT=8080
```

#### InfluxDB Configuration
```env
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=clpm-admin-token
INFLUXDB_ORG=clpm
INFLUXDB_BUCKET=clpm
INFLUXDB_MEASUREMENT=control_loops
```

#### KPI Configuration
```env
KPI_WINDOW_MIN=15
KPI_CRON_SCHEDULE=*/15 * * * *
KPI_MAX_CONCURRENCY=5
```

#### Service Configuration
```env
LOG_LEVEL=info
NODE_ENV=production
POLLING_INTERVAL=30000
```

## Data Flow

### 1. Data Acquisition
- Aggregation service polls InfluxDB every 30 seconds
- Queries recent data for all active loops
- Performs time-window aggregation (1-minute buckets)

### 2. Data Storage
- Aggregated data stored in PostgreSQL `agg_1m` table
- Raw data remains in InfluxDB (not stored in PostgreSQL)
- KPI results stored in PostgreSQL `kpi_results` table

### 3. Data Retrieval
- **Real-time data**: Direct InfluxDB queries
- **Historical data**: PostgreSQL aggregated data + InfluxDB fallback
- **KPI data**: PostgreSQL stored results

## API Endpoints

### New Data Endpoints

#### Raw Data
```
GET /data/raw?loopId={id}&start={start}&end={end}&fields={fields}
```
- Queries InfluxDB directly for raw data
- Supports field filtering and limits

#### Aggregated Data
```
GET /data/aggregated?loopId={id}&start={start}&end={end}&interval={interval}
```
- Queries PostgreSQL aggregated data first
- Falls back to InfluxDB aggregation if no PostgreSQL data

#### Real-time Data
```
GET /data/realtime?loopId={id}&fields={fields}
```
- Gets most recent data point from InfluxDB
- Returns current values for specified fields

#### Data Range
```
GET /data/range?loopId={id}
```
- Returns available data range from both sources
- Uses broader range between InfluxDB and PostgreSQL

## Docker Deployment

### Quick Start

#### Production Deployment
```bash
# Start all services
./docker-start.sh

# Or manually
docker-compose up -d
```

#### Development Deployment
```bash
# Start development environment
./docker-start-dev.sh

# Or manually
docker-compose -f docker-compose.dev.yml up -d
```

### Docker Services

#### Core Services
- **PostgreSQL**: Database for configuration and aggregated data
- **Redis**: Cache for API responses and session data
- **Keycloak**: Authentication and authorization service
- **InfluxDB**: Time-series database for raw data
- **Aggregation Service**: Polls InfluxDB and aggregates data
- **KPI Worker**: Calculates KPIs from InfluxDB data
- **API Gateway**: REST API for frontend and external clients
- **Frontend**: React application with nginx
- **Diagnostics Service**: Python service for loop diagnostics

#### Development Tools
- **pgAdmin**: Database management interface
- **Chronograf**: InfluxDB management interface

### Access URLs

#### Production
- Frontend: http://localhost:80
- API Gateway: http://localhost:8080
- InfluxDB: http://localhost:8086
- Keycloak: http://localhost:8081
- Redis: localhost:6379
- Diagnostics: http://localhost:8050

#### Development
- Frontend: http://localhost:5173
- API Gateway: http://localhost:8080
- InfluxDB: http://localhost:8086
- Keycloak: http://localhost:8081
- Redis: localhost:6379
- Diagnostics: http://localhost:8050
- pgAdmin: http://localhost:5050 (admin@clpm.com / admin123)
- Chronograf: http://localhost:8888

### Docker Compose Files

#### Production (`docker-compose.yml`)
- Optimized for production deployment
- Multi-stage builds for smaller images
- Health checks and restart policies
- Resource limits and scaling

#### Development (`docker-compose.dev.yml`)
- Source code mounting for hot reload
- Development tools included
- Debug logging enabled
- Additional management interfaces

#### Production Override (`docker-compose.prod.yml`)
- Production-specific configurations
- Resource limits and scaling
- Environment variable overrides
- High availability settings

### Environment Configuration

#### Docker Environment File (`env.docker`)
```env
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=clpm
POSTGRES_USER=clpm
POSTGRES_PASSWORD=clpm_pwd
DATABASE_URL=postgresql://clpm:clpm_pwd@localhost:5432/clpm

# Cache Configuration
REDIS_URL=redis://localhost:6379/0

# Auth Configuration (Keycloak dev)
OIDC_ISSUER=http://localhost:8081/realms/clpm
OIDC_AUDIENCE=clpm-api
OIDC_JWKS_URI=http://localhost:8081/realms/clpm/protocol/openid-connect/certs

# Diagnostics Service
DIAG_SERVICE_URL=http://localhost:8050

# API Configuration
API_PORT=8080

# InfluxDB Configuration
INFLUXDB_PASSWORD=adminpassword
INFLUXDB_TOKEN=clpm-admin-token
INFLUXDB_ORG=clpm
INFLUXDB_BUCKET=clpm
INFLUXDB_MEASUREMENT=control_loops

# Service Configuration
LOG_LEVEL=info
NODE_ENV=production

# KPI Configuration
KPI_WINDOW_MIN=15
KPI_CRON_SCHEDULE=*/15 * * * *
KPI_MAX_CONCURRENCY=5

# Polling Configuration
POLLING_INTERVAL=30000
```

### Docker Commands

#### Basic Operations
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild services
docker-compose build --no-cache

# View service status
docker-compose ps
```

#### Development Operations
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View development logs
docker-compose -f docker-compose.dev.yml logs -f

# Rebuild development services
docker-compose -f docker-compose.dev.yml build --no-cache
```

#### Production Operations
```bash
# Start with production overrides
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api-gateway=3

# View production logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

## Benefits

### Advantages
1. **No raw data storage** - Reduces database size and complexity
2. **Real-time access** - Direct InfluxDB queries for current data
3. **Scalability** - InfluxDB handles time-series data efficiently
4. **Simplified architecture** - Fewer moving parts
5. **Cost reduction** - Less storage and processing overhead
6. **Dockerized deployment** - Easy deployment and scaling
7. **Complete authentication** - Keycloak integration for security
8. **Caching support** - Redis for performance optimization

### Considerations
1. **Network dependency** - Requires reliable InfluxDB connectivity
2. **Query performance** - Complex queries may be slower
3. **Data consistency** - Need to handle InfluxDB availability issues
4. **Migration complexity** - Requires careful data mapping

## Migration Steps

### 1. Setup InfluxDB
- Install and configure InfluxDB
- Create organization, bucket, and measurement
- Generate API token

### 2. Update Environment Variables
- Add InfluxDB configuration to all services
- Remove OPC UA and RabbitMQ variables

### 3. Install Dependencies
```bash
cd backend/aggregation && npm install
cd backend/kpi-worker && npm install
cd backend/api-gateway && npm install
```

### 4. Docker Deployment
```bash
# Production
./docker-start.sh

# Development
./docker-start-dev.sh
```

### 5. Verify Data Flow
- Check aggregation service logs for InfluxDB polling
- Verify KPI calculations are working
- Test API endpoints for data retrieval

## Troubleshooting

### Common Issues

1. **InfluxDB Connection Failures**
   - Verify InfluxDB URL and token
   - Check organization and bucket names
   - Ensure InfluxDB is running and accessible

2. **No Data Available**
   - Check if InfluxDB has data for configured loops
   - Verify loop_id tags in InfluxDB match database loop IDs
   - Check measurement name configuration

3. **Performance Issues**
   - Optimize InfluxDB queries with proper time ranges
   - Consider using InfluxDB aggregation functions
   - Monitor query execution times

4. **Docker Issues**
   - Check Docker and docker-compose versions
   - Verify port availability
   - Check container logs for errors

5. **Authentication Issues**
   - Verify Keycloak is running and accessible
   - Check OIDC configuration
   - Ensure realm and client are properly configured

### Debug Mode
Enable debug logging in services:
```javascript
const log = pino({ 
  level: 'debug',
  prettyPrint: true 
});
```

### Docker Debugging
```bash
# Check container status
docker-compose ps

# View service logs
docker-compose logs <service-name>

# Access container shell
docker-compose exec <service-name> sh

# Check resource usage
docker stats
```

## Future Enhancements

1. **Caching Layer** - Add Redis caching for frequently accessed data
2. **Query Optimization** - Implement query result caching and optimization
3. **Data Validation** - Add data quality checks and validation
4. **Monitoring** - Add InfluxDB performance monitoring
5. **Backup Strategy** - Implement InfluxDB backup and recovery procedures
6. **Kubernetes Deployment** - Add Kubernetes manifests for orchestration
7. **CI/CD Pipeline** - Automated testing and deployment
8. **Monitoring Stack** - Prometheus, Grafana, and alerting
