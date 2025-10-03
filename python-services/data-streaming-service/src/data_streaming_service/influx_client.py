"""InfluxDB client for data streaming service."""

import os
import logging
from typing import Dict, List, Any
from datetime import datetime
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

logger = logging.getLogger(__name__)


class InfluxDBStreamingClient:
    """InfluxDB client for streaming real-time data."""
    
    def __init__(self):
        """Initialize InfluxDB client with environment variables."""
        self.url = os.getenv("INFLUXDB_URL", "http://influxdb:8086/")
        self.token = os.getenv("INFLUXDB_TOKEN")
        self.org = os.getenv("INFLUXDB_ORG", "clpm")
        self.bucket = os.getenv("INFLUXDB_BUCKET", "clpm_data")
        self.measurement = os.getenv("INFLUXDB_MEASUREMENT", "control_loops")
        
        if not self.token:
            raise ValueError("INFLUXDB_TOKEN environment variable is required")
        
        self.client = InfluxDBClient(
            url=self.url,
            token=self.token,
            org=self.org
        )
        
        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        
        logger.info(f"Connected to InfluxDB at {self.url}")
        logger.info(f"Organization: {self.org}, Bucket: {self.bucket}")
    
    def write_data_points(self, data_points: List[Dict[str, Any]]) -> bool:
        """
        Write data points to InfluxDB.
        
        Args:
            data_points: List of dictionaries containing data to write
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Group data points by timestamp and loop_id to combine fields
            grouped_data = {}
            
            for data_point in data_points:
                timestamp = data_point.get("_time", datetime.utcnow())
                if isinstance(timestamp, str):
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                
                loop_id = data_point.get("loop_id")
                mode = data_point.get("Mode", "AUT")
                field_name = data_point.get("_field", "value").lower()
                field_value = data_point.get("_value", 0.0)
                
                # Create a key for grouping
                key = (timestamp, loop_id, mode)
                
                if key not in grouped_data:
                    grouped_data[key] = {
                        "timestamp": timestamp,
                        "loop_id": loop_id,
                        "mode": mode,
                        "fields": {}
                    }
                
                grouped_data[key]["fields"][field_name] = field_value
            
            # Create points from grouped data
            points = []
            for key, data in grouped_data.items():
                point = Point(self.measurement)
                point.time(data["timestamp"])
                
                # Add tags
                point.tag("loop_id", data["loop_id"])
                point.tag("Mode", data["mode"])
                
                # Add all fields
                for field_name, field_value in data["fields"].items():
                    point.field(field_name, field_value)
                
                points.append(point)
            
            # Write to InfluxDB
            self.write_api.write(bucket=self.bucket, record=points)
            logger.debug(f"Successfully wrote {len(points)} data points to InfluxDB")
            return True
            
        except Exception as e:
            logger.error(f"Failed to write data points to InfluxDB: {e}")
            return False
    
    def write_single_point(self, loop_id: str, field: str, value: float, 
                          mode: str = "AUT", timestamp: datetime = None) -> bool:
        """
        Write a single data point to InfluxDB.
        
        Args:
            loop_id: Loop identifier
            field: Field name (PV, OP, SP)
            value: Field value
            mode: Control mode (default: AUT)
            timestamp: Timestamp (default: current time)
            
        Returns:
            bool: True if successful, False otherwise
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        data_point = {
            "_time": timestamp,
            "loop_id": loop_id,
            "_field": field,
            "_value": value,
            "Mode": mode,
            "_measurement": self.measurement
        }
        
        return self.write_data_points([data_point])
    
    def close(self):
        """Close the InfluxDB client connection."""
        if self.client:
            self.client.close()
            logger.info("InfluxDB client connection closed")
