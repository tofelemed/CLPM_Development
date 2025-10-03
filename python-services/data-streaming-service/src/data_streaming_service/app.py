"""Main application for CLPM data streaming service."""

import os
import sys
import time
import signal
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

from .influx_client import InfluxDBStreamingClient
from .data_generator import ControlLoopDataGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('data_streaming_service.log')
    ]
)

logger = logging.getLogger(__name__)


class DataStreamingService:
    """Main service for streaming real-time data to InfluxDB."""
    
    def __init__(self):
        """Initialize the streaming service."""
        self.influx_client: Optional[InfluxDBStreamingClient] = None
        self.data_generator = ControlLoopDataGenerator()
        self.running = False
        self.stream_interval = float(os.getenv("STREAM_INTERVAL", "1.0"))  # seconds
        
        # Load environment variables
        load_dotenv()
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.running = False
    
    async def initialize(self):
        """Initialize the service components."""
        try:
            logger.info("Initializing data streaming service...")
            
            # Initialize InfluxDB client
            self.influx_client = InfluxDBStreamingClient()
            
            # Test connection
            test_data = self.data_generator.generate_loop_data("TEST_LOOP")
            success = self.influx_client.write_data_points(test_data)
            
            if success:
                logger.info("Successfully connected to InfluxDB")
            else:
                logger.error("Failed to connect to InfluxDB")
                return False
            
            # Clean up test data
            logger.info("InfluxDB connection test completed")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize service: {e}")
            return False
    
    async def stream_data(self):
        """Main data streaming loop."""
        logger.info("Starting data streaming...")
        logger.info(f"Stream interval: {self.stream_interval} seconds")
        logger.info(f"Available loops: {self.data_generator.get_available_loops()}")
        
        self.running = True
        stream_count = 0
        
        try:
            while self.running:
                start_time = time.time()
                
                # Generate data for all loops
                current_time = datetime.utcnow()
                data_points = self.data_generator.generate_multiple_loops(current_time)
                
                # Write to InfluxDB
                if self.influx_client:
                    success = self.influx_client.write_data_points(data_points)
                    
                    if success:
                        stream_count += 1
                        logger.info(f"Stream #{stream_count}: Wrote {len(data_points)} data points "
                                  f"for {len(self.data_generator.get_available_loops())} loops")
                    else:
                        logger.error(f"Failed to write data points in stream #{stream_count}")
                
                # Calculate sleep time to maintain consistent interval
                elapsed_time = time.time() - start_time
                sleep_time = max(0, self.stream_interval - elapsed_time)
                
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                else:
                    logger.warning(f"Stream cycle took {elapsed_time:.2f}s, "
                                 f"longer than interval {self.stream_interval}s")
                
        except Exception as e:
            logger.error(f"Error in streaming loop: {e}")
        finally:
            logger.info("Data streaming stopped")
    
    async def stream_trending_data(self, duration_minutes: int = 5):
        """Stream trending data for demonstration purposes."""
        logger.info(f"Starting trending data stream for {duration_minutes} minutes...")
        
        start_time = datetime.utcnow()
        end_time = start_time + timedelta(minutes=duration_minutes)
        
        try:
            while datetime.utcnow() < end_time and self.running:
                current_time = datetime.utcnow()
                
                # Generate trending data for first loop
                loop_id = self.data_generator.get_available_loops()[0]
                trending_data = self.data_generator.generate_trending_data(
                    loop_id, current_time, duration_minutes=1, interval_seconds=1
                )
                
                # Write to InfluxDB
                if self.influx_client:
                    success = self.influx_client.write_data_points(trending_data)
                    
                    if success:
                        logger.info(f"Wrote trending data for {loop_id}: {len(trending_data)} points")
                    else:
                        logger.error(f"Failed to write trending data for {loop_id}")
                
                await asyncio.sleep(60)  # Wait 1 minute between trend generations
                
        except Exception as e:
            logger.error(f"Error in trending data stream: {e}")
    
    async def run(self):
        """Run the main service loop."""
        logger.info("Starting CLPM Data Streaming Service...")
        
        # Initialize service
        if not await self.initialize():
            logger.error("Failed to initialize service, exiting...")
            return
        
        try:
            # Start data streaming
            await self.stream_data()
            
        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt")
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
        finally:
            await self.shutdown()
    
    async def shutdown(self):
        """Shutdown the service gracefully."""
        logger.info("Shutting down data streaming service...")
        
        self.running = False
        
        if self.influx_client:
            self.influx_client.close()
        
        logger.info("Service shutdown complete")


def main():
    """Main entry point for the application."""
    service = DataStreamingService()
    
    try:
        # Run the service
        asyncio.run(service.run())
    except Exception as e:
        logger.error(f"Failed to start service: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
