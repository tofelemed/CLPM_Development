#!/usr/bin/env python3
"""Test script for the data streaming service."""

import os
import sys
import asyncio
from datetime import datetime
from dotenv import load_dotenv

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from data_streaming_service.influx_client import InfluxDBStreamingClient
from data_streaming_service.data_generator import ControlLoopDataGenerator


async def test_connection():
    """Test InfluxDB connection."""
    print("Testing InfluxDB connection...")
    
    try:
        # Override URL for local testing
        import os
        os.environ["INFLUXDB_URL"] = "http://localhost:8086/"
        client = InfluxDBStreamingClient()
        print("[OK] Successfully connected to InfluxDB")
        
        # Test write
        generator = ControlLoopDataGenerator()
        test_data = generator.generate_loop_data("TEST_LOOP")
        
        success = client.write_data_points(test_data)
        if success:
            print("[OK] Successfully wrote test data")
        else:
            print("[FAIL] Failed to write test data")
        
        client.close()
        return success
        
    except Exception as e:
        print(f"[FAIL] Connection failed: {e}")
        return False


async def test_data_generation():
    """Test data generation."""
    print("\nTesting data generation...")
    
    generator = ControlLoopDataGenerator()
    
    # Test single loop
    loop_data = generator.generate_loop_data("TIC208030")
    print(f"[OK] Generated {len(loop_data)} data points for single loop")
    
    # Test multiple loops
    all_data = generator.generate_multiple_loops()
    print(f"[OK] Generated {len(all_data)} data points for {len(generator.get_available_loops())} loops")
    
    # Test trending data
    trending_data = generator.generate_trending_data("TIC208030", datetime.utcnow(), duration_minutes=1, interval_seconds=1)
    print(f"[OK] Generated {len(trending_data)} trending data points")
    
    # Print sample data
    print("\nSample data point:")
    print(loop_data[0])
    
    return True


async def test_streaming_demo():
    """Demo the streaming functionality."""
    print("\nDemo: Streaming data for 10 seconds...")
    
    # Override URL for local testing
    import os
    os.environ["INFLUXDB_URL"] = "http://localhost:8086/"
    client = InfluxDBStreamingClient()
    generator = ControlLoopDataGenerator()
    
    start_time = datetime.utcnow()
    count = 0
    
    try:
        while (datetime.utcnow() - start_time).total_seconds() < 10:
            data_points = generator.generate_multiple_loops()
            success = client.write_data_points(data_points)
            
            if success:
                count += 1
                print(f"Stream #{count}: Wrote {len(data_points)} data points")
            else:
                print(f"Stream #{count}: Failed to write data")
            
            await asyncio.sleep(1)  # 1 second interval
        
        print(f"\n[OK] Demo completed: {count} successful streams")
        
    except Exception as e:
        print(f"[FAIL] Demo failed: {e}")
    finally:
        client.close()


async def main():
    """Run all tests."""
    print("CLPM Data Streaming Service - Test Suite")
    print("=" * 50)
    
    # Load environment variables
    load_dotenv()
    
    # Check if environment variables are set
    required_vars = ['INFLUXDB_URL', 'INFLUXDB_TOKEN', 'INFLUXDB_ORG', 'INFLUXDB_BUCKET']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"[FAIL] Missing environment variables: {', '.join(missing_vars)}")
        print("Please copy env.example to .env and configure your settings")
        return
    
    # Run tests
    connection_ok = await test_connection()
    data_gen_ok = await test_data_generation()
    
    if connection_ok and data_gen_ok:
        print("\n[OK] All tests passed!")
        
        # Ask user if they want to run demo
        try:
            response = input("\nRun streaming demo? (y/n): ").lower().strip()
            if response == 'y':
                await test_streaming_demo()
        except KeyboardInterrupt:
            print("\nDemo cancelled by user")
    else:
        print("\n[FAIL] Some tests failed. Please check your configuration.")


if __name__ == "__main__":
    asyncio.run(main())
