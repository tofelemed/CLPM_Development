import 'dotenv/config';
import { InfluxDBClient } from './src/influxClient.js';

async function testAggregationInfluxDB() {
  console.log('Testing Aggregation Service InfluxDB Connection...');
  
  const client = new InfluxDBClient({
    url: process.env.INFLUXDB_URL || 'http://influxdb:8086/',
    token: process.env.INFLUXDB_TOKEN || 'o6cjAfkS_jFCvEePxDyz33zMQaJgbbSz_oqkSPzMTbROImhLlwDHwh8la4VMkMyNJsHWrVYs_JEHpWZGtFeaDw==',
    org: process.env.INFLUXDB_ORG || 'clpm',
    bucket: process.env.INFLUXDB_BUCKET || 'clpm_data',
    measurement: process.env.INFLUXDB_MEASUREMENT || 'control_loops'
  });

  try {
    // Test connection
    const connected = await client.testConnection();
    console.log('Connection test:', connected);

    // Test data retrieval for TIC208030 with wider time range
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    console.log('Testing data retrieval for TIC208030...');
    console.log('Time range:', startTime.toISOString(), 'to', endTime.toISOString());
    
    const data = await client.queryData('TIC208030', startTime.toISOString(), endTime.toISOString());
    console.log('Data points retrieved:', data.length);
    
    if (data.length > 0) {
      console.log('Sample data:', JSON.stringify(data.slice(0, 3), null, 2));
    } else {
      console.log('No data found - this matches the aggregation service issue');
    }
    
    await client.close();
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAggregationInfluxDB();
