# CLPM Data Flow Implementation Guide

This document describes the complete implementation of the conceptual data flow for the Control Loop Performance Monitor (CLPM) application.

## Architecture Overview

The CLPM data flow follows a microservices architecture with the following components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OPC UA       │    │   Ingestion     │    │   Aggregation   │    │   KPI Worker    │
│   Server/DCS   │───►│   Service       │───►│   Service       │───►│   Service       │
│                 │    │                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │                       │
                                ▼                       ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
                       │   Raw Samples   │    │   Aggregated    │    │   KPI Results   │
                       │   (TimescaleDB) │    │   Data (1m/1h) │    │   (PostgreSQL)  │
                       └─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │                       │
                                ▼                       ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
                       │   API Gateway   │    │   Frontend UI   │    │   Diagnostics   │
                       │   (NestJS)      │    │   (React)       │    │   Service      │
                       └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Data Flow Components

### 1. Real-time Data Acquisition

**Service**: `backend/ingestion/`
**Purpose**: Connects to OPC UA servers and acquires real-time data from control loops

**Key Features**:
- Dynamic loop configuration management
- Real-time OPC UA subscriptions
- Automatic reconnection and error handling
- Database storage of raw samples
- RabbitMQ publishing for downstream processing

**Configuration**:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clpm
DB_USER=postgres
DB_PASSWORD=password
OPCUA_ENDPOINT=opc.tcp://localhost:4840
RABBITMQ_URL=amqp://localhost
RABBITMQ_EXCHANGE=clpm
```

**Data Flow**:
1. Service starts and loads active loops from database
2. Establishes OPC UA connections for each loop
3. Subscribes to PV, OP, SP, Mode, and Valve tags
4. Receives real-time updates and stores in `raw_samples` table
5. Publishes samples to RabbitMQ for aggregation processing

### 2. Raw Data Storage

**Database**: TimescaleDB (PostgreSQL extension)
**Table**: `raw_samples`

**Schema**:
```sql
CREATE TABLE raw_samples (
  ts TIMESTAMPTZ NOT NULL,
  loop_id UUID NOT NULL REFERENCES loops(id),
  pv DOUBLE PRECISION,
  op DOUBLE PRECISION,
  sp DOUBLE PRECISION,
  mode VARCHAR(16),
  valve_position DOUBLE PRECISION,
  quality_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TimescaleDB hypertable with 7-day chunks
SELECT create_hypertable('raw_samples', 'ts', 
  if_not_exists => TRUE, 
  chunk_time_interval => INTERVAL '7 days'
);

-- Indexes for performance
CREATE INDEX idx_raw_samples_loop_ts ON raw_samples (loop_id, ts DESC);
CREATE INDEX idx_raw_samples_ts ON raw_samples (ts DESC);
```

**Features**:
- Time-series optimized storage
- Automatic data partitioning
- Efficient range queries
- Quality code tracking

### 3. Aggregation and Summarization

**Service**: `backend/aggregation/`
**Purpose**: Processes raw samples into time-window aggregates for improved query performance

**Aggregation Intervals**:
- 1-minute aggregates (`agg_1m`)
- 1-hour aggregates (`agg_1h`)

**Data Flow**:
1. Consumes raw samples from RabbitMQ
2. Buffers data in memory by loop and time interval
3. Calculates aggregates (min, max, avg, count)
4. Flushes completed buckets to database
5. Periodic cleanup of old buffers

**Aggregation Logic**:
```javascript
// Calculate aggregates for each bucket
const pv_avg = pv_values.reduce((a, b) => a + b, 0) / pv_values.length;
const pv_min = Math.min(...pv_values);
const pv_max = Math.max(...pv_values);
const op_avg = op_values.reduce((a, b) => a + b, 0) / op_values.length;
const sp_avg = sp_values.reduce((a, b) => a + b, 0) / sp_values.length;
```

### 4. KPI Computation

**Service**: `backend/kpi-worker/`
**Purpose**: Calculates performance metrics for control loops on a scheduled basis

**KPI Metrics**:
- **Service Factor**: Fraction of samples in AUTO/CASCADE mode
- **Effective Service Factor**: Service factor × (1 - saturation)
- **Saturation Percentage**: Fraction of OP samples near min/max
- **Output Travel**: Sum of absolute OP differences
- **Performance Index (PI)**: 1 - (error variance / actual variance)
- **Relative Performance Index (RPI)**: PI × service factor
- **Oscillation Index**: First-lag autocorrelation of PV
- **Stiction Severity**: Maximum cross-correlation between OP and PV

**Calculation Schedule**:
- Default: Every 15 minutes
- Configurable via `KPI_CRON_SCHEDULE` environment variable
- Analysis window: Configurable (default 24 hours)

**Data Flow**:
1. Scheduled execution via cron
2. Retrieves loop configurations and data
3. Calculates KPIs using statistical methods
4. Stores results in `kpi_results` table
5. Handles errors gracefully with logging

### 5. API and UI Integration

**Service**: `backend/api-gateway/`
**Endpoints**: Enhanced KPI retrieval with time range support

**API Endpoints**:
```typescript
// Get KPI history with time range filtering
GET /loops/:id/kpis?start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z&limit=100

// Get latest KPI for specific time window
GET /loops/:id/kpis/latest?window=24h

// Get KPI summary with statistics
GET /loops/:id/kpis/summary?start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z
```

**Response Format**:
```json
{
  "loop_id": "uuid",
  "count": 96,
  "results": [...],
  "time_range": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-02T00:00:00Z"
  }
}
```

## Implementation Details

### Environment Configuration

Create `.env` files in each service directory:

**Ingestion Service**:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clpm
DB_USER=postgres
DB_PASSWORD=password
OPCUA_ENDPOINT=opc.tcp://localhost:4840
RABBITMQ_URL=amqp://localhost
RABBITMQ_EXCHANGE=clpm
```

**Aggregation Service**:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clpm
DB_USER=postgres
DB_PASSWORD=password
RABBITMQ_URL=amqp://localhost
RABBITMQ_EXCHANGE=clpm
```

**KPI Worker**:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clpm
DB_USER=postgres
DB_PASSWORD=password
KPI_WINDOW_MIN=1440
KPI_CRON_SCHEDULE=*/15 * * * *
KPI_MAX_CONCURRENCY=5
RABBITMQ_URL=amqp://localhost
RABBITMQ_EXCHANGE=clpm
```

### Database Setup

1. **Install TimescaleDB**:
```bash
# Ubuntu/Debian
sudo apt-get install timescaledb-postgresql-14

# Enable extension
echo "shared_preload_libraries = 'timescaledb'" | sudo tee -a /etc/postgresql/14/main/postgresql.conf
sudo systemctl restart postgresql
```

2. **Create Database and Tables**:
```bash
psql -U postgres -d clpm -f db/migrations/V1__init_tables.sql
```

3. **Verify Hypertables**:
```sql
SELECT * FROM timescaledb_information.hypertables;
```

### Service Deployment

**Docker Compose**:
```yaml
version: '3.8'
services:
  ingestion:
    build: ./backend/ingestion
    environment:
      - DB_HOST=postgres
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on:
      - postgres
      - rabbitmq

  aggregation:
    build: ./backend/aggregation
    environment:
      - DB_HOST=postgres
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on:
      - postgres
      - rabbitmq

  kpi-worker:
    build: ./backend/kpi-worker
    environment:
      - DB_HOST=postgres
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on:
      - postgres
      - rabbitmq

  postgres:
    image: timescale/timescaledb:latest-pg14
    environment:
      - POSTGRES_DB=clpm
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  rabbitmq:
    image: rabbitmq:3-management
    environment:
      - RABBITMQ_DEFAULT_USER=guest
      - RABBITMQ_DEFAULT_PASS=guest
    ports:
      - "5672:5672"
      - "15672:15672"

volumes:
  postgres_data:
```

**Manual Deployment**:
```bash
# Start services
cd backend/ingestion && npm start &
cd backend/aggregation && npm start &
cd backend/kpi-worker && npm start &
```

### Monitoring and Health Checks

**Health Endpoints**:
- Ingestion: `/health` (if implemented)
- Aggregation: Built-in logging
- KPI Worker: Built-in logging
- API Gateway: `/health`

**Logging**:
All services use structured logging with Pino:
```javascript
const log = pino({ name: 'service-name' });
log.info({ loopId, metric: 'kpi_calculation' }, 'KPI calculation started');
```

**Metrics**:
- Database connection status
- RabbitMQ message processing rates
- KPI calculation success/failure rates
- Data processing latency

### Error Handling and Resilience

**Connection Failures**:
- Automatic reconnection with exponential backoff
- Graceful degradation when services are unavailable
- Message queuing and retry mechanisms

**Data Quality**:
- Quality code tracking from OPC UA
- Validation of incoming data
- Handling of missing or invalid values

**Service Recovery**:
- Graceful shutdown handling
- Resource cleanup on restart
- State recovery from database

## Testing and Validation

### Unit Tests

```bash
# Run tests for each service
cd backend/ingestion && npm test
cd backend/aggregation && npm test
cd backend/kpi-worker && npm test
```

### Integration Tests

```bash
# Test complete data flow
cd backend/mock-opcua-server && npm run test:integration
```

### Performance Testing

```bash
# Load test with synthetic data
node test/performance/load-test.js
```

## Troubleshooting

### Common Issues

1. **Database Connection Failures**:
   - Verify PostgreSQL/TimescaleDB is running
   - Check connection credentials
   - Ensure database exists and is accessible

2. **RabbitMQ Connection Issues**:
   - Verify RabbitMQ service is running
   - Check connection URL and credentials
   - Ensure exchanges and queues are created

3. **OPC UA Connection Problems**:
   - Verify OPC UA server endpoint
   - Check security policies and authentication
   - Ensure network connectivity

4. **KPI Calculation Failures**:
   - Check data availability in specified time windows
   - Verify loop configurations exist
   - Review calculation logic and error logs

### Debug Mode

Enable debug logging:
```javascript
const log = pino({ 
  level: 'debug',
  prettyPrint: true 
});
```

### Data Validation

Verify data flow:
```sql
-- Check raw samples
SELECT COUNT(*), MIN(ts), MAX(ts) FROM raw_samples WHERE loop_id = 'uuid';

-- Check aggregated data
SELECT COUNT(*), MIN(bucket), MAX(bucket) FROM agg_1m WHERE loop_id = 'uuid';

-- Check KPI results
SELECT COUNT(*), MIN(timestamp), MAX(timestamp) FROM kpi_results WHERE loop_id = 'uuid';
```

## Performance Optimization

### Database Optimization

1. **Indexing Strategy**:
   - Primary indexes on (loop_id, timestamp)
   - Secondary indexes for common query patterns
   - Partial indexes for active loops

2. **Partitioning**:
   - TimescaleDB hypertables with appropriate chunk sizes
   - Automatic data retention policies
   - Efficient time-range queries

### Caching Strategy

1. **Application Level**:
   - In-memory buffers for aggregation
   - Connection pooling for database access
   - Result caching for frequently accessed KPIs

2. **Database Level**:
   - Query result caching
   - Prepared statement reuse
   - Connection pooling

### Scaling Considerations

1. **Horizontal Scaling**:
   - Multiple ingestion service instances
   - Load balancing for OPC UA connections
   - Distributed aggregation processing

2. **Vertical Scaling**:
   - Increased memory for aggregation buffers
   - Higher concurrency for KPI calculations
   - Optimized database query plans

## Security Considerations

1. **Authentication**:
   - JWT-based API authentication
   - Role-based access control
   - Secure OPC UA connections

2. **Data Protection**:
   - Encrypted data transmission
   - Secure credential storage
   - Audit logging for data access

3. **Network Security**:
   - Firewall configuration for OPC UA ports
   - VPN access for remote connections
   - Network segmentation for different service tiers

## Future Enhancements

1. **Advanced Analytics**:
   - Machine learning for anomaly detection
   - Predictive maintenance algorithms
   - Advanced oscillation analysis

2. **Real-time Alerts**:
   - Configurable alert thresholds
   - Multiple notification channels
   - Escalation procedures

3. **Data Export**:
   - Standard format exports (CSV, JSON)
   - Integration with external systems
   - Automated reporting

4. **Performance Monitoring**:
   - Service-level metrics
   - End-to-end latency tracking
   - Resource utilization monitoring

## Conclusion

This implementation provides a robust, scalable foundation for the CLPM data flow. The microservices architecture ensures loose coupling and independent scaling, while the TimescaleDB backend provides efficient time-series data storage and querying capabilities.

The system is designed to handle real-time data acquisition, efficient aggregation, and comprehensive KPI calculation, providing engineers with the insights needed to optimize control loop performance.

For production deployment, ensure proper monitoring, alerting, and backup procedures are in place, and consider implementing additional security measures based on your organization's requirements.
