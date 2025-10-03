import 'dotenv/config';
import { InfluxDB } from '@influxdata/influxdb-client';

async function testDirectFluxQuery() {
  console.log('Testing Direct Flux Query...');
  
  const client = new InfluxDB({ 
    url: process.env.INFLUXDB_URL || 'http://influxdb:8086/',
    token: process.env.INFLUXDB_TOKEN || 'o6cjAfkS_jFCvEePxDyz33zMQaJgbbSz_oqkSPzMTbROImhLlwDHwh8la4VMkMyNJsHWrVYs_JEHpWZGtFeaDw=='
  });
  
  const queryApi = client.getQueryApi(process.env.INFLUXDB_ORG || 'clpm');
  
  try {
    // Test 1: Simple query to see if any data exists
    console.log('Test 1: Checking if any data exists in bucket...');
    const simpleQuery = `from(bucket: "clpm_data") |> range(start: -1h) |> limit(n: 5)`;
    const simpleRows = await queryApi.collectRows(simpleQuery);
    console.log('Simple query result:', simpleRows.length, 'rows');
    
    if (simpleRows.length > 0) {
      console.log('Sample row:', JSON.stringify(simpleRows[0], null, 2));
    }
    
    // Test 2: Query for TIC208030 specifically
    console.log('\nTest 2: Querying TIC208030 data...');
    const ticQuery = `
      from(bucket: "clpm_data")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "control_loops")
        |> filter(fn: (r) => r.loop_id == "TIC208030")
        |> limit(n: 5)
    `;
    const ticRows = await queryApi.collectRows(ticQuery);
    console.log('TIC208030 query result:', ticRows.length, 'rows');
    
    if (ticRows.length > 0) {
      console.log('Sample TIC208030 row:', JSON.stringify(ticRows[0], null, 2));
    }
    
    // Test 3: Query with pivot (like aggregation service does)
    console.log('\nTest 3: Querying with pivot...');
    const pivotQuery = `
      from(bucket: "clpm_data")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "control_loops")
        |> filter(fn: (r) => r.loop_id == "TIC208030")
        |> filter(fn: (r) => r._field == "pv" or r._field == "op" or r._field == "sp")
        |> pivot(rowKey:["_time", "Mode"], columnKey: ["_field"], valueColumn: "_value")
        |> limit(n: 3)
    `;
    const pivotRows = await queryApi.collectRows(pivotQuery);
    console.log('Pivot query result:', pivotRows.length, 'rows');
    
    if (pivotRows.length > 0) {
      console.log('Sample pivot row:', JSON.stringify(pivotRows[0], null, 2));
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDirectFluxQuery();
