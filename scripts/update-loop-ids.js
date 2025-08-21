const { InfluxDB, Point } = require('@influxdata/influxdb-client')

// Configuration
const url = 'http://72.255.34.69:8086/'
const token = '4eYvsu8wZCJ6tKuE2sxvFHkvYFwSMVK0011hEEiojvejzpSaij86vYQomN_12au6eK-2MZ6Knr-Sax201y70w=='
const org = 'some_org'
const bucket = 'some_data'

// Loop ID mapping
const loopIdMapping = {
  'loop_001': '00000000-0000-0000-0000-000000000001',
  'loop_002': '00000000-0000-0000-0000-000000000002',
  'loop_003': '00000000-0000-0000-0000-000000000003',
  'loop_004': '00000000-0000-0000-0000-000000000004',
  'loop_005': '00000000-0000-0000-0000-000000000005'
}

async function updateLoopIds() {
  try {
    console.log('🔄 Updating loop IDs in InfluxDB...')
    
    // Create InfluxDB client
    const client = new InfluxDB({ url, token })
    const queryApi = client.getQueryApi(org)
    const writeApi = client.getWriteApi(org, bucket, 'ms')
    
    // For each loop ID mapping
    for (const [oldId, newId] of Object.entries(loopIdMapping)) {
      console.log(`📝 Updating ${oldId} -> ${newId}`)
      
      // Query data with old loop ID
      const query = `
        from(bucket: "${bucket}")
          |> range(start: -24h)
          |> filter(fn: (r) => r._measurement == "control_loops")
          |> filter(fn: (r) => r.loop_id == "${oldId}")
      `
      
      const results = []
      await queryApi.queryRaw(query, {
        next: (row, tableMeta) => {
          const o = tableMeta.toObject(row)
          results.push(o)
        },
        error: (error) => {
          console.error('Query error:', error)
          throw error
        },
        complete: () => {
          console.log(`   Found ${results.length} data points`)
        }
      })
      
      if (results.length > 0) {
        // Create new points with updated loop ID
        const newPoints = results.map(row => {
          const point = new Point('control_loops')
            .tag('loop_id', newId)
            .tag('loop_name', row.loop_name)
            .tag('unit', row.unit)
            .timestamp(new Date(row._time))
          
          // Add fields
          if (row._field === 'pv') point.floatField('pv', row._value)
          if (row._field === 'sp') point.floatField('sp', row._value)
          if (row._field === 'op') point.floatField('op', row._value)
          if (row._field === 'mode') point.stringField('mode', row._value)
          if (row._field === 'valve_position') point.floatField('valve_position', row._value)
          
          return point
        })
        
        // Write new points
        await writeApi.writePoints(newPoints)
        console.log(`   ✅ Written ${newPoints.length} updated points`)
      }
    }
    
    // Flush and close
    await writeApi.flush()
    await writeApi.close()
    
    console.log('🎉 Loop ID update completed!')
    
  } catch (error) {
    console.error('❌ Error updating loop IDs:', error)
    throw error
  }
}

// Run the update
if (require.main === module) {
  updateLoopIds()
    .then(() => {
      console.log('✅ Loop ID update completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Loop ID update failed:', error)
      process.exit(1)
    })
}

module.exports = { updateLoopIds }
