const { InfluxDB } = require('@influxdata/influxdb-client')

// Configuration
const url = 'https://us-east-1-1.aws.cloud2.influxdata.com'
const token = 'sN_1BDk1vutUQA4_ECchcKEFrwDLnhuoaK8v6gbjDFUZ2S5KoxaB9hI09Hqz8VSStTunNu06QS-Y1d8z9GyfGw=='
const org = '64a5a03c6b52fde2'
const bucket = 'clpm'

// Test connection
async function testConnection() {
  let client = null
  let writeApi = null
  
  try {
    console.log('🔍 Testing InfluxDB connection...')
    console.log(`📊 URL: ${url}`)
    console.log(`🏢 Org: ${org}`)
    console.log(`🪣 Bucket: ${bucket}`)
    console.log(`🔑 Token: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`)
    
    // Create InfluxDB client
    client = new InfluxDB({ url, token })
    
    // Get query API
    const queryApi = client.getQueryApi(org)
    
    // Test query to check if bucket exists and has data
    const query = `from(bucket: "${bucket}")
      |> range(start: -1h)
      |> limit(n: 1)`
    
    console.log('📡 Executing test query...')
    
    const results = []
    await queryApi.queryRaw(query, {
      next: (row, tableMeta) => {
        const o = tableMeta.toObject(row)
        results.push(o)
      },
      error: (error) => {
        console.error('❌ Query error:', error)
        throw error
      },
      complete: () => {
        console.log('✅ Query completed successfully')
      }
    })
    
    if (results.length > 0) {
      console.log('✅ Connection successful! Found data in bucket.')
      console.log('📊 Sample data point:', results[0])
    } else {
      console.log('⚠️  Connection successful, but no data found in bucket.')
      console.log('💡 You can run the data loading script to populate the bucket.')
    }
    
    // Test write API
    console.log('📝 Testing write API...')
    writeApi = client.getWriteApi(org, bucket, 'ms')
    
    // Create a test point
    const { Point } = require('@influxdata/influxdb-client')
    const testPoint = new Point('connection_test')
      .tag('test', 'connection')
      .stringField('status', 'success')
      .timestamp(new Date())
    
    await writeApi.writePoint(testPoint)
    await writeApi.flush()
    
    console.log('✅ Write API test successful!')
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message)
    
    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      console.log('💡 Check your API token and permissions')
      console.log('   - Verify the token is correct and not expired')
      console.log('   - Check if the token has read/write permissions for the bucket')
      console.log('   - Ensure the organization ID is correct')
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      console.log('💡 Check your organization ID and bucket name')
      console.log('   - Verify the organization ID exists')
      console.log('   - Check if the bucket exists in your organization')
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      console.log('💡 Check your internet connection and URL')
      console.log('   - Verify the InfluxDB URL is correct')
      console.log('   - Check your internet connection')
    } else {
      console.log('💡 Unknown error - check the error message above')
    }
    
    throw error
  } finally {
    // Close connections properly
    if (writeApi) {
      try {
        await writeApi.close()
      } catch (error) {
        console.log('⚠️  Warning: Could not close write API:', error.message)
      }
    }
    
    // Note: InfluxDB client doesn't have a close method in this version
    // The client will be garbage collected automatically
  }
}

// Run the test
if (require.main === module) {
  testConnection()
    .then(() => {
      console.log('✅ Connection test completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Connection test failed:', error)
      process.exit(1)
    })
}

module.exports = { testConnection }
