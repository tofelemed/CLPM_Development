import { OPCUAClient, AttributeIds, TimestampsToReturn } from 'node-opcua';
import pino from 'pino';
const log = pino();

export async function runOPCUA(endpointUrl, nodes, onData) {
  const client = OPCUAClient.create({ endpointMustExist: false });
  let session = null;
  let subscription = null;
  const monitoredItems = [];

  try {
    await client.connect(endpointUrl);
    log.info({ endpointUrl }, 'OPC UA connected');

    session = await client.createSession({
      requestedSessionTimeout: 60000
    });

    subscription = await session.createSubscription2({
      requestedPublishingInterval: 1000,
      requestedLifetimeCount: 100,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 1000,
      publishingEnabled: true,
      priority: 10
    });

    // Set up monitored items
    for (const n of nodes) {
      const itemToMonitor = { nodeId: n.nodeId, attributeId: AttributeIds.Value };
      const parameters = { 
        samplingInterval: n.samplingInterval || 200, 
        queueSize: 100, 
        discardOldest: true 
      };
      
      const mi = await subscription.monitor(itemToMonitor, parameters, TimestampsToReturn.Both);
      mi.on('changed', (dataValue) => {
        onData(n.loopId, n.signal, dataValue);
      });
      monitoredItems.push(mi);
    }

    // Return connection object with cleanup method
    return {
      client,
      session,
      subscription,
      monitoredItems,
      async cleanup() {
        try {
          log.info('Cleaning up OPC UA connection');
          
          // Terminate monitored items
          for (const mi of monitoredItems) {
            try {
              await mi.terminate();
            } catch (error) {
              log.warn({ error: error.message }, 'Failed to terminate monitored item');
            }
          }
          
          // Close subscription
          if (subscription) {
            try {
              await subscription.terminate();
            } catch (error) {
              log.warn({ error: error.message }, 'Failed to terminate subscription');
            }
          }
          
          // Close session
          if (session) {
            try {
              await session.close();
            } catch (error) {
              log.warn({ error: error.message }, 'Failed to close session');
            }
          }
          
          // Disconnect client
          if (client) {
            try {
              await client.disconnect();
            } catch (error) {
              log.warn({ error: error.message }, 'Failed to disconnect client');
            }
          }
          
          log.info('OPC UA connection cleanup completed');
        } catch (error) {
          log.error({ error: error.message }, 'Error during OPC UA cleanup');
        }
      }
    };

  } catch (error) {
    log.error({ endpointUrl, error: error.message }, 'Failed to establish OPC UA connection');
    
    // Cleanup on error
    if (subscription) {
      try {
        await subscription.terminate();
      } catch (cleanupError) {
        log.warn({ error: cleanupError.message }, 'Failed to cleanup subscription on error');
      }
    }
    
    if (session) {
      try {
        await session.close();
      } catch (cleanupError) {
        log.warn({ error: cleanupError.message }, 'Failed to cleanup session on error');
      }
    }
    
    if (client) {
      try {
        await client.disconnect();
      } catch (cleanupError) {
        log.warn({ error: cleanupError.message }, 'Failed to cleanup client on error');
      }
    }
    
    throw error;
  }
}
