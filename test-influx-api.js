const axios = require('axios');

async function testDiagnostics() {
  try {
    console.log('Testing diagnostics endpoint...');

    const response = await axios.post(
      'http://localhost:8080/api/v1/loops/TIC208030/diagnostics/run',
      {},
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('Success! Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
  }
}

testDiagnostics();
