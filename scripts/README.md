# CLPM InfluxDB Data Loading Scripts

This directory contains scripts for loading data into InfluxDB for the CLPM (Control Loop Performance Monitor) system.

## Configuration

The scripts are configured to use your InfluxDB Cloud instance:

- **URL**: `https://us-east-1-1.aws.cloud2.influxdata.com`
- **Organization**: `64a5a03c6b52fde2`
- **Bucket**: `clpm`
- **API Token**: `sN_1BDk1vutUQA4_ECchcKEFrwDLnhuoaK8v6gbjDFUZ2S5KoxaB9hI09Hqz8VSStTunNu06QS-Y1d8z9GyfGw==`

## Installation

```bash
cd scripts
npm install
```

## Available Scripts

### 1. Test Connection

Test the connection to your InfluxDB instance:

```bash
npm run test-connection
```

This script will:
- Test the connection to InfluxDB
- Verify your API token and permissions
- Check if the bucket exists
- Test both read and write operations

### 2. Load Sample Data

Load sample control loop data for testing:

```bash
npm run load-sample
```

This script will:
- Generate 24 hours of realistic control loop data
- Create 5 different control loops (temperature, pressure, flow, level)
- Write data every 30 seconds
- Generate approximately 14,400 data points

### 3. Load Historical Data

Migrate existing data from PostgreSQL to InfluxDB:

```bash
npm run load-historical
```

This script will:
- Connect to your PostgreSQL database
- Read existing loops from the `loops` table
- Migrate raw samples from `raw_samples` table
- Migrate aggregated data from `agg_1m` table
- Convert PostgreSQL data to InfluxDB format

## Data Structure

### Control Loops Data (`control_loops` measurement)

**Tags:**
- `loop_id`: Unique identifier for the control loop
- `loop_name`: Human-readable name of the loop
- `unit`: Unit of measurement (°C, PSI, GPM, %, etc.)

**Fields:**
- `pv`: Process Variable (current value)
- `sp`: Set Point (target value)
- `op`: Output (control signal)
- `mode`: Control mode (AUTO/MANUAL)
- `valve_position`: Valve position (0-100%)
- `quality_code`: Data quality indicator

### Aggregated Data (`control_loops_agg` measurement)

**Tags:**
- `loop_id`: Unique identifier for the control loop
- `loop_name`: Human-readable name of the loop
- `aggregation`: Aggregation period (1m, 1h, etc.)

**Fields:**
- `pv_avg`: Average Process Variable
- `op_avg`: Average Output
- `sp_avg`: Average Set Point
- `pv_count`: Number of samples in aggregation

## Sample Data Generation

The sample data generator creates realistic control loop behavior:

- **Temperature Loops**: Base value around 75°C with ±1°C noise
- **Pressure Loops**: Base value around 150 PSI with ±1 PSI noise
- **Flow Loops**: Base value around 25 GPM with ±1 GPM noise
- **Level Loops**: Base value around 60% with ±1% noise

Features:
- Realistic noise and trends
- Setpoint variations
- Control mode changes (90% AUTO, 10% MANUAL)
- Proper control loop dynamics

## Usage Examples

### Load Data for Development

```bash
# Test connection first
npm run test-connection

# Load sample data for testing
npm run load-sample
```

### Migrate Production Data

```bash
# Ensure PostgreSQL is running and accessible
# Update PostgreSQL connection in load-historical-data.js if needed

# Migrate historical data
npm run load-historical
```

### Custom Data Loading

You can modify the scripts to load your own data:

```javascript
const { loadData } = require('./load-influxdb-data.js')

// Custom data points
const customData = [
  {
    loop_id: 'custom_loop_001',
    loop_name: 'My Custom Loop',
    pv: 100.5,
    sp: 100.0,
    op: 50.0,
    mode: 'AUTO',
    timestamp: new Date()
  }
]

// Load custom data
loadData(customData)
```

## Troubleshooting

### Connection Issues

1. **Unauthorized Error**: Check your API token
2. **Not Found Error**: Verify organization ID and bucket name
3. **Network Error**: Check internet connection and URL

### Data Loading Issues

1. **Rate Limiting**: Reduce batch size or add delays
2. **Memory Issues**: Process data in smaller chunks
3. **Duplicate Data**: Check for existing data before loading

### PostgreSQL Migration Issues

1. **Connection Failed**: Verify PostgreSQL credentials
2. **Table Not Found**: Ensure tables exist in your database
3. **Permission Denied**: Check database user permissions

## Environment Variables

You can override the default configuration using environment variables:

```bash
export INFLUXDB_URL="https://us-east-1-1.aws.cloud2.influxdata.com"
export INFLUXDB_TOKEN="your-token-here"
export INFLUXDB_ORG="your-org-id"
export INFLUXDB_BUCKET="your-bucket-name"
```

## Data Validation

After loading data, you can validate it using the InfluxDB UI or CLI:

```bash
# Query recent data
from(bucket: "clpm")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "control_loops")
  |> limit(n: 10)
```

## Performance Tips

1. **Batch Size**: Use batch sizes of 1000-5000 points for optimal performance
2. **Parallel Processing**: Process multiple loops in parallel for large datasets
3. **Error Handling**: Implement retry logic for failed writes
4. **Monitoring**: Monitor write rates and adjust accordingly

## Security Notes

- Keep your API token secure and never commit it to version control
- Use environment variables for sensitive configuration
- Regularly rotate your API tokens
- Monitor API usage and set up alerts for unusual activity
