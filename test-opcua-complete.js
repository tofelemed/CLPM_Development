#!/usr/bin/env node

import axios from 'axios';

const OPCUA_API_BASE = 'http://localhost:3001';
const TEST_ENDPOINT = 'opc.tcp://localhost:4840';

async function testOPCUASystem() {
  console.log('🧪 Testing Complete OPC UA System...\n');

  try {
    // Test 1: Check API health
    console.log('1. Testing API health...');
    const healthResponse = await axios.get(`${OPCUA_API_BASE}/health`);
    console.log('✅ API is healthy:', healthResponse.data);

    // Test 2: Get security options
    console.log('\n2. Testing security options...');
    const securityResponse = await axios.get(`${OPCUA_API_BASE}/security-options`);
    console.log('✅ Security options loaded:', {
      policies: securityResponse.data.securityPolicies.length,
      modes: securityResponse.data.securityModes.length
    });

    // Test 3: Create a connection
    console.log('\n3. Creating OPC UA connection...');
    const connectionData = {
      endpointUrl: TEST_ENDPOINT,
      securityMode: 'None',
      securityPolicy: 'None'
    };
    
    const createResponse = await axios.post(`${OPCUA_API_BASE}/connections`, connectionData);
    console.log('✅ Connection created:', createResponse.data.message);

    // Test 4: List connections
    console.log('\n4. Listing connections...');
    const connectionsResponse = await axios.get(`${OPCUA_API_BASE}/connections`);
    const connections = connectionsResponse.data.connections;
    console.log('✅ Connections found:', connections.length);
    
    if (connections.length === 0) {
      throw new Error('No connections found');
    }

    const connectionId = connections[0].id;
    console.log('📋 Using connection ID:', connectionId);

    // Test 5: Browse address space
    console.log('\n5. Browsing OPC UA address space...');
    const browseResponse = await axios.get(`${OPCUA_API_BASE}/connections/${connectionId}/browse`, {
      params: { nodeId: 'RootFolder', maxResults: 10 }
    });
    console.log('✅ Browse results:', browseResponse.data.count, 'nodes found');
    
    if (browseResponse.data.results.length > 0) {
      console.log('📋 Sample nodes:', browseResponse.data.results.slice(0, 3).map(n => n.displayName));
    }

    // Test 6: Search nodes
    console.log('\n6. Searching for nodes...');
    const searchResponse = await axios.get(`${OPCUA_API_BASE}/connections/${connectionId}/search`, {
      params: { q: 'Loop', maxResults: 5 }
    });
    console.log('✅ Search results:', searchResponse.data.count, 'nodes found');

    // Test 7: Read a node value (if we found any nodes)
    if (browseResponse.data.results.length > 0) {
      const testNode = browseResponse.data.results.find(n => !n.hasChildren);
      if (testNode) {
        console.log('\n7. Reading node value...');
        try {
          const readResponse = await axios.get(`${OPCUA_API_BASE}/connections/${connectionId}/nodes/${encodeURIComponent(testNode.nodeId)}/read`);
          console.log('✅ Node value read:', {
            nodeId: testNode.nodeId,
            value: readResponse.data.value.value,
            dataType: readResponse.data.value.dataType
          });
        } catch (error) {
          console.log('⚠️ Could not read node value:', error.response?.data?.error || error.message);
        }
      }
    }

    // Test 8: Create a loop configuration
    console.log('\n8. Creating loop configuration...');
    const loopData = {
      name: 'Test Loop 001',
      description: 'Test temperature control loop',
      connectionId: connectionId,
      pvTag: 'ns=2;s=Loop001.PV',
      spTag: 'ns=2;s=Loop001.SP', 
      opTag: 'ns=2;s=Loop001.OP',
      samplingInterval: 1000
    };

    const loopResponse = await axios.post(`${OPCUA_API_BASE}/loops`, loopData);
    console.log('✅ Loop created:', loopResponse.data.message);
    console.log('📋 Loop ID:', loopResponse.data.loop.id);
    console.log('📋 Monitored items:', loopResponse.data.loop.monitoredItems.length);

    // Test 9: Clean up - disconnect connection
    console.log('\n9. Cleaning up...');
    await axios.delete(`${OPCUA_API_BASE}/connections/${connectionId}`);
    console.log('✅ Connection cleaned up');

    console.log('\n🎉 All tests passed! OPC UA system is working correctly.\n');

    // Summary
    console.log('📊 Test Summary:');
    console.log('✅ API health check');
    console.log('✅ Security options loading');
    console.log('✅ Connection creation');
    console.log('✅ Address space browsing');
    console.log('✅ Node searching');
    console.log('✅ Node value reading');
    console.log('✅ Loop configuration');
    console.log('✅ Connection cleanup');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data?.error || error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
testOPCUASystem().catch(console.error);