const { InfluxDB, Point } = require('@influxdata/influxdb-client')

// Configuration
const url = 'https://us-east-1-1.aws.cloud2.influxdata.com'
const token = 'sN_1BDk1vutUQA4_ECchcKEFrwDLnhuoaK8v6gbjDFUZ2S5KoxaB9hI09Hqz8VSStTunNu06QS-Y1d8z9GyfGw=='
const org = '64a5a03c6b52fde2'
const bucket = 'clpm'

// Sample control loop data
const loops = [
  { id: 'loop_001', name: 'Temperature Control Loop 1', unit: '°C' },
  { id: 'loop_002', name: 'Pressure Control Loop 1', unit: 'PSI' },
  { id: 'loop_003', name: 'Flow Control Loop 1', unit: 'GPM' },
  { id: 'loop_004', name: 'Level Control Loop 1', unit: '%' },
  { id: 'loop_005', name: 'Temperature Control Loop 2', unit: '°C' }
]

// Generate sample data for the last 24 hours
function generateSampleData() {
  const data = []
  const now = new Date()
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
  
  loops.forEach(loop => {
    let currentTime = new Date(startTime)
    
    while (currentTime <= now) {
      // Generate realistic control loop data
      const baseValue = getBaseValue(loop.id)
      const noise = (Math.random() - 0.5) * 2 // ±1 unit noise
      const trend = Math.sin(currentTime.getTime() / (1000 * 60 * 60)) * 0.5 // Hourly trend
      
      const pv = baseValue + noise + trend
      const sp = baseValue + Math.sin(currentTime.getTime() / (1000 * 60 * 30)) * 0.3 // Setpoint varies
      const op = Math.max(0, Math.min(100, 50 + (sp - pv) * 10)) // Output based on error
      const mode = Math.random() > 0.1 ? 'AUTO' : 'MANUAL' // 90% auto, 10% manual
      const valve_position = mode === 'AUTO' ? op : (Math.random() * 100)
      
      // Create data point
      const point = new Point('control_loops')
        .tag('loop_id', loop.id)
        .tag('loop_name', loop.name)
        .tag('unit', loop.unit)
        .floatField('pv', pv)
        .floatField('sp', sp)
        .floatField('op', op)
        .stringField('mode', mode)
        .floatField('valve_position', valve_position)
        .timestamp(currentTime)
      
      data.push(point)
      
      // Move to next sample (every 30 seconds)
      currentTime = new Date(currentTime.getTime() + 30 * 1000)
    }
  })
  
  return data
}

// Get base value for different loop types
function getBaseValue(loopId) {
  switch (loopId) {
    case 'loop_001':
    case 'loop_005':
      return 75 // Temperature loops around 75°C
    case 'loop_002':
      return 150 // Pressure loops around 150 PSI
    case 'loop_003':
      return 25 // Flow loops around 25 GPM
    case 'loop_004':
      return 60 // Level loops around 60%
    default:
      return 50
  }
}

// Load data into InfluxDB
async function loadData() {
  let writeApi = null
  
  try {
    console.log('🚀 Starting data load to InfluxDB...')
    console.log(`📊 URL: ${url}`)
    console.log(`🏢 Org: ${org}`)
    console.log(`🪣 Bucket: ${bucket}`)
    console.log(`🔄 Loops: ${loops.length}`)
    
    // Create InfluxDB client
    const client = new InfluxDB({ url, token })
    
    // Get write API
    writeApi = client.getWriteApi(org, bucket, 'ms')
    
    // Generate sample data
    console.log('📈 Generating sample data...')
    const data = generateSampleData()
    console.log(`📊 Generated ${data.length} data points`)
    
    // Write data in batches
    const batchSize = 1000
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      await writeApi.writePoints(batch)
      console.log(`✅ Written batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)}`)
    }
    
    // Flush any remaining data
    await writeApi.flush()
    
    console.log('🎉 Data load completed successfully!')
    console.log(`📊 Total data points written: ${data.length}`)
    
    // Show data summary
    console.log('\n📋 Data Summary:')
    loops.forEach(loop => {
      const loopData = data.filter(point => point.tags.loop_id === loop.id)
      console.log(`   ${loop.name}: ${loopData.length} points`)
    })
    
  } catch (error) {
    console.error('❌ Error loading data:', error)
    throw error
  } finally {
    // Close the write API
    if (writeApi) {
      try {
        await writeApi.close()
      } catch (error) {
        console.log('⚠️  Warning: Could not close write API:', error.message)
      }
    }
  }
}

// Run the data load
if (require.main === module) {
  loadData()
    .then(() => {
      console.log('✅ Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Script failed:', error)
      process.exit(1)
    })
}

module.exports = { loadData, generateSampleData }
