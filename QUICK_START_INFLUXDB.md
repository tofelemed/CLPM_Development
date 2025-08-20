# Quick Start: Loading Data into InfluxDB Cloud

This guide will help you quickly load data into your InfluxDB Cloud instance for the CLPM system.

## Prerequisites

- Node.js installed (version 16 or higher)
- Access to your InfluxDB Cloud instance
- Your API token ready

## Step 1: Install Dependencies

```bash
cd scripts
npm install
```

## Step 2: Test Connection

First, test your connection to InfluxDB Cloud:

```bash
npm run test-connection
```

This will verify:
- ✅ Your API token is valid
- ✅ Your organization exists
- ✅ Your bucket is accessible
- ✅ You can read and write data

## Step 3: Load Sample Data

Load sample control loop data for testing:

```bash
npm run load-sample
```

This will:
- Generate 24 hours of realistic control loop data
- Create 5 different control loops (temperature, pressure, flow, level)
- Write data every 30 seconds
- Generate approximately 14,400 data points

## Step 4: Verify Data

You can verify the data was loaded by:

1. **Using the InfluxDB Cloud UI**:
   - Go to https://us-east-1-1.aws.cloud2.influxdata.com
   - Navigate to your `clpm` bucket
   - Query: `from(bucket: "clpm") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "control_loops")`

2. **Using the CLI**:
   ```bash
   # Query recent data
   from(bucket: "clpm")
     |> range(start: -1h)
     |> filter(fn: (r) => r._measurement == "control_loops")
     |> limit(n: 10)
   ```

## Step 5: Start Your CLPM System

Now that you have data in InfluxDB, start your CLPM system:

### Development Mode
```bash
# Windows
docker-start-dev.bat

# Linux/Mac
./docker-start-dev.sh
```

### Production Mode
```bash
# Windows
docker-start.bat

# Linux/Mac
./docker-start.sh
```

## Data Structure

Your data will be structured as follows:

### Control Loops Data
- **Measurement**: `control_loops`
- **Tags**: `loop_id`, `loop_name`, `unit`
- **Fields**: `pv`, `sp`, `op`, `mode`, `valve_position`

### Sample Loops Created
1. **Temperature Control Loop 1** (loop_001) - Base: 75°C
2. **Pressure Control Loop 1** (loop_002) - Base: 150 PSI
3. **Flow Control Loop 1** (loop_003) - Base: 25 GPM
4. **Level Control Loop 1** (loop_004) - Base: 60%
5. **Temperature Control Loop 2** (loop_005) - Base: 75°C

## Access Your System

Once everything is running:

- **Frontend**: http://localhost:80 (or http://localhost:5173 for dev)
- **API Gateway**: http://localhost:8080
- **Keycloak**: http://localhost:8081
- **pgAdmin**: http://localhost:5050 (admin@clpm.com / admin123)

## Troubleshooting

### Connection Issues
```bash
# Check if your token is valid
npm run test-connection
```

### Data Loading Issues
```bash
# Check the logs
docker-compose logs aggregation
docker-compose logs kpi-worker
```

### No Data Appearing
1. Verify data was loaded: `npm run test-connection`
2. Check aggregation service logs
3. Verify loop IDs match between InfluxDB and PostgreSQL

## Next Steps

1. **Load Historical Data**: If you have existing PostgreSQL data, run:
   ```bash
   npm run load-historical
   ```

2. **Customize Data**: Modify the scripts to load your own control loop data

3. **Monitor Performance**: Use the InfluxDB Cloud UI to monitor data ingestion rates

4. **Scale Up**: Add more loops or increase data frequency as needed

## Configuration Details

Your InfluxDB Cloud configuration:
- **URL**: https://us-east-1-1.aws.cloud2.influxdata.com
- **Organization**: 64a5a03c6b52fde2
- **Bucket**: clpm
- **Measurement**: control_loops

All services are configured to use this InfluxDB Cloud instance automatically.
