# CLPM Utility Scripts

This directory contains utility scripts for the CLPM (Control Loop Performance Monitor) system.

## Installation

```bash
cd scripts
npm install
```

## Available Scripts

### Test Connection

Test the connection to your InfluxDB instance:

```bash
npm run test-connection
```

This script will:
- Test the connection to InfluxDB
- Verify your API token and permissions
- Check if the bucket exists
- Test both read and write operations

## Configuration

The scripts are configured to use your local InfluxDB instance:

- **URL**: `http://localhost:8086/`
- **Organization**: `clpm`
- **Bucket**: `clpm_data`
- **API Token**: Configured in the script