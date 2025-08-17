import axios from 'axios';
import pino from 'pino';

const log = pino({ name: 'opcua-test' });
const API_BASE = 'http://localhost:3001';

async function testOPCUAIntegration() {
  log.info('Starting OPC UA integration test...');

  try {
    // Test 1: Health Check
    log.info('Test 1: Health Check');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    log.info('Health check passed:', healthResponse.data);

    // Test 2: Get Security Options
    log.info('Test 2: Get Security Options');
    const securityResponse = await axios.get(`${API_BASE}/security-options`);
    log.info('Security options:', {
      policies: securityResponse.data.securityPolicies.length,
      modes: securityResponse.data.securityModes.length
    });

    // Test 3: Create Connection to Mock Serverl
    log.info('Test 3: Create OPC UA Connection');
    const connectionResponse = await axios.post(`${API_BASE}/connections`, {
      endpointUrl: 'opc.tcp://localhost:4840',
      securityMode: 'None',
      securityPolicy: 'None'
    });
    
    const connectionId = connectionResponse.data.connection.id;
    log.info('Connection created:', connectionId);

    // Wait for connection to establish
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Browse Address Space
    log.info('Test 4: Browse Address Space');
    const browseResponse = await axios.get(`${API_BASE}/connections/${connectionId}/browse`, {
      params: { nodeId: 'RootFolder', maxResults: 100 }
    });
    
    log.info('Browse results:', {
      count: browseResponse.data.count,
      nodes: browseResponse.data.results.map(n => n.displayName)
    });

    // Test 5: Search for Specific Nodes
    log.info('Test 5: Search Nodes');
    const searchResponse = await axios.get(`${API_BASE}/connections/${connectionId}/search`, {
      params: { q: 'Loop', maxResults: 50 }
    });
    
    log.info('Search results:', {
      count: searchResponse.data.count,
      nodes: searchResponse.data.results.map(n => n.displayName)
    });

    // Test 6: Read Node Values
    log.info('Test 6: Read Node Values');
    if (browseResponse.data.results.length > 0) {
      const testNode = browseResponse.data.results[0];
      const readResponse = await axios.get(`${API_BASE}/connections/${connectionId}/nodes/${encodeURIComponent(testNode.nodeId)}/read`);
      
      log.info('Node value read:', {
        nodeId: testNode.nodeId,
        value: readResponse.data.value
      });
    }

    // Test 7: Add Monitored Item
    log.info('Test 7: Add Monitored Item');
    if (browseResponse.data.results.length > 0) {
      const testNode = browseResponse.data.results[0];
      const monitorResponse = await axios.post(`${API_BASE}/connections/${connectionId}/monitor`, {
        nodeId: testNode.nodeId,
        samplingInterval: 1000,
        queueSize: 100
      });
      
      log.info('Monitored item added:', monitorResponse.data.itemId);

      // Wait a bit for data to come in
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test 8: Remove Monitored Item
      log.info('Test 8: Remove Monitored Item');
      await axios.delete(`${API_BASE}/connections/${connectionId}/monitor/${encodeURIComponent(testNode.nodeId)}`);
      log.info('Monitored item removed');
    }

    // Test 9: Create Loop Configuration
    log.info('Test 9: Create Loop Configuration');
    const loopResponse = await axios.post(`${API_BASE}/loops`, {
      name: 'Test Temperature Loop',
      description: 'Test loop for OPC UA integration',
      connectionId: connectionId,
      pvTag: 'ns=2;s=Loop001.PV',
      opTag: 'ns=2;s=Loop001.OP',
      spTag: 'ns=2;s=Loop001.SP',
      modeTag: 'ns=2;s=Loop001.Mode',
      samplingInterval: 200
    });
    
    log.info('Loop created:', loopResponse.data.loop.id);

    // Test 10: Get Connection Status
    log.info('Test 10: Get Connection Status');
    const statusResponse = await axios.get(`${API_BASE}/connections/${connectionId}`);
    log.info('Connection status:', statusResponse.data.connection);

    // Test 11: Cleanup - Delete Connection
    log.info('Test 11: Cleanup - Delete Connection');
    await axios.delete(`${API_BASE}/connections/${connectionId}`);
    log.info('Connection deleted');

    log.info('✅ All OPC UA integration tests passed!');

  } catch (error) {
    log.error('❌ OPC UA integration test failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    process.exit(1);
  }
}

// Run the test
testOPCUAIntegration().catch(error => {
  log.error('Test execution failed:', error);
  process.exit(1);
});
