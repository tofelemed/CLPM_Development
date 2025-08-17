import 'dotenv/config';
import pino from 'pino';
import { cfg } from './config.js';
import { createChannel } from './rabbit.js';
import { runOPCUA } from './opc/uaClient.js';
import { DatabaseService } from './database.js';

const log = pino();
const db = new DatabaseService();

// Dynamic loop configuration management
let activeLoops = new Map();
let opcuaConnections = new Map();

// Initialize loops from configuration
async function initializeLoops() {
  try {
    const loops = await db.getActiveLoops();
    for (const loop of loops) {
      await addLoopToMonitoring(loop);
    }
    log.info({ count: loops.length }, 'Initialized loops from database');
  } catch (error) {
    log.error({ error: error.message }, 'Failed to initialize loops from database');
  }
}

// Add a new loop to monitoring
async function addLoopToMonitoring(loop) {
  try {
    const nodes = [
      { loopId: loop.id, signal: 'pv', nodeId: loop.pv_tag },
      { loopId: loop.id, signal: 'op', nodeId: loop.op_tag },
      { loopId: loop.id, signal: 'sp', nodeId: loop.sp_tag },
      { loopId: loop.id, signal: 'mode', nodeId: loop.mode_tag },
      ...(loop.valve_tag ? [{ loopId: loop.id, signal: 'valve_position', nodeId: loop.valve_tag }] : [])
    ];

    const connection = await runOPCUA(cfg.opcEndpoint, nodes, handleDataUpdate);
    opcuaConnections.set(loop.id, connection);
    activeLoops.set(loop.id, { ...loop, nodes });
    
    log.info({ loopId: loop.id, name: loop.name }, 'Added loop to monitoring');
  } catch (error) {
    log.error({ loopId: loop.id, error: error.message }, 'Failed to add loop to monitoring');
  }
}

// Remove a loop from monitoring
async function removeLoopFromMonitoring(loopId) {
  try {
    const connection = opcuaConnections.get(loopId);
    if (connection) {
      await connection.cleanup();
      opcuaConnections.delete(loopId);
    }
    activeLoops.delete(loopId);
    log.info({ loopId }, 'Removed loop from monitoring');
  } catch (error) {
    log.error({ loopId, error: error.message }, 'Failed to remove loop from monitoring');
  }
}

// Handle data updates from OPC UA
async function handleDataUpdate(loopId, signal, dataValue) {
  try {
    const timestamp = new Date(dataValue.serverTimestamp || Date.now());
    const value = dataValue.value?.value;
    const quality = dataValue.statusCode?.value || 192; // Good quality default

    // Store raw sample in database
    const sample = {
      ts: timestamp,
      loop_id: loopId,
      pv: signal === 'pv' ? value : undefined,
      op: signal === 'op' ? value : undefined,
      sp: signal === 'sp' ? value : undefined,
      mode: signal === 'mode' ? value : undefined,
      valve_position: signal === 'valve_position' ? value : undefined,
      quality_code: quality
    };

    await db.insertRawSample(sample);

    // Publish to RabbitMQ for real-time processing
    const routingKey = `loop.${loopId}`;
    const channel = await createChannel(cfg.rabbitUrl, cfg.exchange);
    channel.publish(cfg.exchange, routingKey, Buffer.from(JSON.stringify(sample)), { 
      contentType: 'application/json', 
      persistent: true 
    });

    log.debug({ loopId, signal, value, quality }, 'Data update processed');
  } catch (error) {
    log.error({ loopId, signal, error: error.message }, 'Failed to process data update');
  }
}

// Configuration update handler
async function handleConfigurationUpdate(update) {
  try {
    if (update.type === 'loop_added') {
      await addLoopToMonitoring(update.loop);
    } else if (update.type === 'loop_updated') {
      await removeLoopFromMonitoring(update.loop.id);
      await addLoopToMonitoring(update.loop);
    } else if (update.type === 'loop_removed') {
      await removeLoopFromMonitoring(update.loop.id);
    }
    
    log.info({ updateType: update.type, loopId: update.loop?.id }, 'Configuration updated');
  } catch (error) {
    log.error({ updateType: update.type, error: error.message }, 'Failed to handle configuration update');
  }
}

// Main execution
(async () => {
  try {
    // Initialize database connection
    await db.connect();
    
    // Initialize loops from database
    await initializeLoops();
    
    // Set up configuration change listener (e.g., from RabbitMQ or database triggers)
    // This would listen for loop configuration changes and call handleConfigurationUpdate
    
    log.info('Ingestion service started successfully');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      log.info('Shutting down ingestion service...');
      for (const [loopId, connection] of opcuaConnections) {
        await removeLoopFromMonitoring(loopId);
      }
      await db.disconnect();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      log.info('Shutting down ingestion service...');
      for (const [loopId, connection] of opcuaConnections) {
        await removeLoopFromMonitoring(loopId);
      }
      await db.disconnect();
      process.exit(0);
    });
    
  } catch (err) {
    log.error(err, 'Ingestion service fatal error');
    process.exit(1);
  }
})().catch(err => {
  log.error(err, 'Ingestion service startup failed');
  process.exit(1);
});
