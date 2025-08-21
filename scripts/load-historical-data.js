const { InfluxDB, Point } = require('@influxdata/influxdb-client')
const { Client } = require('pg')

// InfluxDB Configuration
const influxUrl = 'http://72.255.34.69:8086/'
const influxToken = '4eYvsu8wZCJ6tKuE2sxvFHkvYFwSMVK0011hEEiojvejzpSaij86vYQomN_12au6eK-2MZ6Knr-Sax201y70w=='
const influxOrg = 'some_org'
const influxBucket = 'some_data'

// PostgreSQL Configuration
const pgConfig = {
  host: 'localhost',
  port: 5432,
  database: 'clpm',
  user: 'clpm',
  password: 'clpm_pwd'
}

// Create clients
const influxClient = new InfluxDB({ url: influxUrl, token: influxToken })
const pgClient = new Client(pgConfig)

// Load historical data from PostgreSQL to InfluxDB
async function loadHistoricalData() {
  try {
    console.log('🚀 Starting historical data migration...')
    
    // Connect to PostgreSQL
    console.log('📊 Connecting to PostgreSQL...')
    await pgClient.connect()
    console.log('✅ PostgreSQL connected')
    
    // Get loops from database
    console.log('🔄 Fetching loops from database...')
    const loopsResult = await pgClient.query('SELECT id, name, description FROM loops WHERE active = true')
    const loops = loopsResult.rows
    console.log(`✅ Found ${loops.length} active loops`)
    
    // Get write API
    const writeApi = influxClient.getWriteApi(influxOrg, influxBucket, 'ms')
    
    let totalPoints = 0
    
    // Process each loop
    for (const loop of loops) {
      console.log(`📈 Processing loop: ${loop.name} (ID: ${loop.id})`)
      
      // Get raw samples for this loop (if they exist)
      try {
        const samplesResult = await pgClient.query(
          'SELECT ts, pv, op, sp, mode, valve_position, quality_code FROM raw_samples WHERE loop_id = $1 ORDER BY ts',
          [loop.id]
        )
        
        if (samplesResult.rows.length > 0) {
          console.log(`   📊 Found ${samplesResult.rows.length} raw samples`)
          
          // Convert to InfluxDB points
          const points = samplesResult.rows.map(row => {
            return new Point('control_loops')
              .tag('loop_id', loop.id)
              .tag('loop_name', loop.name)
              .floatField('pv', row.pv)
              .floatField('op', row.op)
              .floatField('sp', row.sp)
              .stringField('mode', row.mode || 'AUTO')
              .floatField('valve_position', row.valve_position)
              .intField('quality_code', row.quality_code)
              .timestamp(new Date(row.ts))
          })
          
          // Write in batches
          const batchSize = 1000
          for (let i = 0; i < points.length; i += batchSize) {
            const batch = points.slice(i, i + batchSize)
            await writeApi.writePoints(batch)
            console.log(`   ✅ Written batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(points.length / batchSize)}`)
          }
          
          totalPoints += points.length
        } else {
          console.log(`   ⚠️  No raw samples found for loop ${loop.id}`)
        }
        
        // Get aggregated data for this loop
        const aggResult = await pgClient.query(
          'SELECT bucket, pv_avg, op_avg, sp_avg, pv_count FROM agg_1m WHERE loop_id = $1 ORDER BY bucket',
          [loop.id]
        )
        
        if (aggResult.rows.length > 0) {
          console.log(`   📊 Found ${aggResult.rows.length} aggregated records`)
          
          // Convert to InfluxDB points
          const aggPoints = aggResult.rows.map(row => {
            return new Point('control_loops_agg')
              .tag('loop_id', loop.id)
              .tag('loop_name', loop.name)
              .tag('aggregation', '1m')
              .floatField('pv_avg', row.pv_avg)
              .floatField('op_avg', row.op_avg)
              .floatField('sp_avg', row.sp_avg)
              .intField('pv_count', row.pv_count)
              .timestamp(new Date(row.bucket))
          })
          
          // Write aggregated data
          const batchSize = 1000
          for (let i = 0; i < aggPoints.length; i += batchSize) {
            const batch = aggPoints.slice(i, i + batchSize)
            await writeApi.writePoints(batch)
            console.log(`   ✅ Written aggregated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(aggPoints.length / batchSize)}`)
          }
          
          totalPoints += aggPoints.length
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing loop ${loop.id}:`, error.message)
      }
    }
    
    // Flush any remaining data
    await writeApi.flush()
    await writeApi.close()
    
    console.log('🎉 Historical data migration completed!')
    console.log(`📊 Total data points written: ${totalPoints}`)
    
  } catch (error) {
    console.error('❌ Error during historical data migration:', error)
    throw error
  } finally {
    // Close connections
    if (pgClient) {
      await pgClient.end()
    }
    influxClient.close()
  }
}

// Run the migration
if (require.main === module) {
  loadHistoricalData()
    .then(() => {
      console.log('✅ Historical data migration completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Historical data migration failed:', error)
      process.exit(1)
    })
}

module.exports = { loadHistoricalData }
