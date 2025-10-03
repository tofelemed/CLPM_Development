# CLPM Data Streaming Service

A Python service that streams real-time control loop data to InfluxDB, generating realistic data based on patterns from historical CSV data.

## Features

- Real-time data streaming to InfluxDB
- Realistic control loop data generation (PV, OP, SP values)
- Multiple loop simulation with configurable parameters
- Trending data generation with realistic control behavior
- Configurable streaming intervals
- Graceful shutdown handling
- Docker containerization support

## Configuration

Copy `env.example` to `.env` and configure your InfluxDB settings:

```bash
cp env.example .env
```

### Environment Variables

- `INFLUXDB_URL`: InfluxDB server URL
- `INFLUXDB_TOKEN`: InfluxDB authentication token
- `INFLUXDB_ORG`: InfluxDB organization
- `INFLUXDB_BUCKET`: InfluxDB bucket name
- `INFLUXDB_MEASUREMENT`: Measurement name for data points
- `STREAM_INTERVAL`: Data streaming interval in seconds (default: 1.0)
- `LOG_LEVEL`: Logging level (default: INFO)

## Installation

### Local Development

1. Install dependencies:
```bash
pip install -e .
```

2. Configure environment variables:
```bash
cp env.example .env
# Edit .env with your InfluxDB credentials
```

3. Run the service:
```bash
python -m data_streaming_service.app
```

### Docker

1. Build the image:
```bash
docker build -t clpm-data-streaming .
```

2. Run the container:
```bash
docker run --env-file .env clpm-data-streaming
```

## Data Format

The service generates data points with the following structure:

```json
{
  "_time": "2025-01-10T10:05:00Z",
  "loop_id": "TIC208030",
  "_field": "PV",
  "_value": 405.2694502,
  "Mode": "AUT",
  "_measurement": "control_loops"
}
```

### Fields Generated

- **PV (Process Variable)**: Current process value
- **OP (Output)**: Controller output value  
- **SP (Set Point)**: Target set point value

### Supported Loops

By default, the service generates data for:
- TIC208030
- TIC208031  
- TIC208032
- TIC208033
- TIC208034

## Usage

### Basic Streaming

The service continuously generates and streams data to InfluxDB at the configured interval.

### Trending Data

For demonstration purposes, the service can generate trending data that simulates realistic control loop behavior with sine wave patterns and control responses.

### Custom Loops

You can add custom loops with specific base values:

```python
from data_streaming_service.data_generator import ControlLoopDataGenerator

generator = ControlLoopDataGenerator()
generator.add_custom_loop("CUSTOM_LOOP", base_pv=400.0, base_sp=400.5, base_op=60.0)
```

## Monitoring

The service logs all activities including:
- Connection status to InfluxDB
- Data points written per stream cycle
- Errors and warnings
- Service startup and shutdown events

Logs are written to both console and `data_streaming_service.log` file.

## Integration with CLPM

This service is designed to work with the CLPM system:

1. Uses the same InfluxDB configuration as other CLPM services
2. Generates data in the same format as the historical CSV data
3. Can be integrated into the Docker Compose setup
4. Follows the same logging and configuration patterns

## Troubleshooting

### Connection Issues

- Verify InfluxDB credentials in `.env` file
- Check network connectivity to InfluxDB server
- Ensure InfluxDB bucket exists and has write permissions

### Data Issues

- Check InfluxDB measurement name matches configuration
- Verify data format matches expected schema
- Monitor logs for write failures

### Performance

- Adjust `STREAM_INTERVAL` based on system performance
- Monitor InfluxDB write performance
- Consider batch writing for high-frequency data
