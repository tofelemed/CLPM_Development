#!/usr/bin/env python3
"""Run script for the data streaming service with your credentials."""

import os
import sys
import asyncio

# Set environment variables
os.environ["INFLUXDB_URL"] = "http://localhost:8086/"
os.environ["INFLUXDB_TOKEN"] = "o6cjAfkS_jFCvEePxDyz33zMQaJgbbSz_oqkSPzMTbROImhLlwDHwh8la4VMkMyNJsHWrVYs_JEHpWZGtFeaDw=="
os.environ["INFLUXDB_ORG"] = "clpm"
os.environ["INFLUXDB_BUCKET"] = "clpm_data"
os.environ["INFLUXDB_MEASUREMENT"] = "control_loops"
os.environ["STREAM_INTERVAL"] = "1.0"
os.environ["LOG_LEVEL"] = "INFO"

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from data_streaming_service.app import DataStreamingService


async def main():
    """Run the data streaming service."""
    print("Starting CLPM Data Streaming Service...")
    print("Press Ctrl+C to stop")
    
    service = DataStreamingService()
    await service.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nService stopped by user")
    except Exception as e:
        print(f"Service failed: {e}")
        sys.exit(1)
