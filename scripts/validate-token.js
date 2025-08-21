const { InfluxDB } = require('@influxdata/influxdb-client')

// Configuration
const url = 'http://72.255.34.69:8086/'
const token = '4eYvsu8wZCJ6tKuE2sxvFHkvYFwSMVK0011hEEiojvejzpSaij86vYQomN_12au6eK-2MZ6Knr-Sax201y70w=='
const org = 'some_org'
const bucket = 'clpm'

async function validateToken() {
  try {
    console.log('🔍 Validating InfluxDB token...')
    console.log(`📊 URL: ${url}`)
    console.log(`🏢 Org: ${org}`)
    console.log(`🪣 Bucket: ${bucket}`)
    console.log(`🔑 Token: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`)
    
    // Create InfluxDB client
    const client = new InfluxDB({ url, token })
    
    // Test 1: Check if we can query any bucket
    console.log('\n📡 Test 1: Checking basic query access...')
    const queryApi = client.getQueryApi(org)
    
    try {
      // Try to list buckets first
      const bucketsQuery = `buckets()`
      const buckets = []
      
      await queryApi.queryRaw(bucketsQuery, {
        next: (row, tableMeta) => {
          const o = tableMeta.toObject(row)
          buckets.push(o)
        },
        error: (error) => {
          throw error
        },
        complete: () => {
          console.log('✅ Basic query access successful')
        }
      })
      
      console.log(`📋 Available buckets: ${buckets.length}`)
      buckets.forEach(bucket => {
        console.log(`   - ${bucket.name}`)
      })
      
    } catch (error) {
      console.log('❌ Basic query access failed:', error.message)
      throw error
    }
    
    // Test 2: Check if we can query the specific bucket
    console.log('\n📡 Test 2: Checking bucket access...')
    try {
      const bucketQuery = `from(bucket: "${bucket}")
        |> range(start: -1h)
        |> limit(n: 1)`
      
      const results = []
      await queryApi.queryRaw(bucketQuery, {
        next: (row, tableMeta) => {
          const o = tableMeta.toObject(row)
          results.push(o)
        },
        error: (error) => {
          throw error
        },
        complete: () => {
          console.log('✅ Bucket query access successful')
        }
      })
      
      console.log(`📊 Found ${results.length} data points in bucket`)
      
    } catch (error) {
      console.log('❌ Bucket query access failed:', error.message)
      if (error.message.includes('not found')) {
        console.log('💡 The bucket might not exist. You may need to create it first.')
      }
      throw error
    }
    
    // Test 3: Check write permissions
    console.log('\n📝 Test 3: Checking write permissions...')
    try {
      const writeApi = client.getWriteApi(org, bucket, 'ms')
      
      const { Point } = require('@influxdata/influxdb-client')
      const testPoint = new Point('token_validation_test')
        .tag('test', 'validation')
        .stringField('status', 'success')
        .timestamp(new Date())
      
      await writeApi.writePoint(testPoint)
      await writeApi.flush()
      await writeApi.close()
      
      console.log('✅ Write access successful')
      
    } catch (error) {
      console.log('❌ Write access failed:', error.message)
      throw error
    }
    
    console.log('\n🎉 Token validation completed successfully!')
    console.log('✅ Your token has read and write permissions')
    
  } catch (error) {
    console.error('\n❌ Token validation failed:', error.message)
    
    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      console.log('\n💡 Troubleshooting steps:')
      console.log('1. Check if the token is correct and not expired')
      console.log('2. Verify the token has the right permissions:')
      console.log('   - Read access to buckets')
      console.log('   - Write access to buckets')
      console.log('3. Ensure the organization ID is correct')
      console.log('4. Check if the bucket exists in your organization')
      console.log('\n🔗 You can check your token at: http://72.255.34.69:8086/orgs/some_org/tokens')
    }
    
    throw error
  }
}

// Run the validation
if (require.main === module) {
  validateToken()
    .then(() => {
      console.log('\n✅ Token validation completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Token validation failed:', error)
      process.exit(1)
    })
}

module.exports = { validateToken }
