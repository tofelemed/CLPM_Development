const fs = require('fs')
const path = require('path')

// Function to update token in a file
function updateTokenInFile(filePath, oldToken, newToken) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    const oldContent = content
    
    // Replace the token
    content = content.replace(new RegExp(oldToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newToken)
    
    if (content !== oldContent) {
      fs.writeFileSync(filePath, content, 'utf8')
      console.log(`✅ Updated: ${filePath}`)
      return true
    } else {
      console.log(`⚠️  No changes: ${filePath}`)
      return false
    }
  } catch (error) {
    console.log(`❌ Error updating ${filePath}:`, error.message)
    return false
  }
}

// Main function
function updateToken(newToken) {
  if (!newToken) {
    console.log('❌ Please provide a new token')
    console.log('Usage: node update-token.js <new-token>')
    return
  }
  
  const oldToken = 'sN_1BDk1vutUQA4_ECchcKEFrwDLnhuoaK8v6gbjDFUZ2S5KoxaB9hI09Hqz8VSStTunNu06QS-Y1d8z9GyfGw=='
  
  console.log('🔄 Updating InfluxDB token in all configuration files...')
  console.log(`🔑 Old token: ${oldToken.substring(0, 10)}...${oldToken.substring(oldToken.length - 10)}`)
  console.log(`🔑 New token: ${newToken.substring(0, 10)}...${newToken.substring(newToken.length - 10)}`)
  console.log()
  
  const files = [
    'load-influxdb-data.js',
    'test-connection.js',
    'validate-token.js',
    'load-historical-data.js',
    '../docker-compose.yml',
    '../docker-compose.dev.yml',
    '../env.docker'
  ]
  
  let updatedCount = 0
  
  files.forEach(file => {
    const filePath = path.join(__dirname, file)
    if (fs.existsSync(filePath)) {
      if (updateTokenInFile(filePath, oldToken, newToken)) {
        updatedCount++
      }
    } else {
      console.log(`⚠️  File not found: ${filePath}`)
    }
  })
  
  console.log()
  console.log(`🎉 Updated ${updatedCount} files successfully!`)
  console.log()
  console.log('📋 Next steps:')
  console.log('1. Test the new token: npm run validate-token')
  console.log('2. Load sample data: npm run load-sample')
  console.log('3. Start your system: docker-start.bat')
}

// Get token from command line arguments
const newToken = process.argv[2]

if (require.main === module) {
  updateToken(newToken)
}

module.exports = { updateToken }
