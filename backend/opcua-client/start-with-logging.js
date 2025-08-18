import { readFileSync } from 'fs';
import pino from 'pino';

console.log('=== DETAILED STARTUP LOGGING ===');

// Set environment variables from .env file
try {
    const envContent = readFileSync('.env', 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && !key.startsWith('#')) {
            const value = valueParts.join('=').trim();
            envVars[key.trim()] = value;
            process.env[key.trim()] = value;
        }
    });
    console.log('Environment variables loaded:', Object.keys(envVars));
} catch (error) {
    console.log('No .env file found, using system environment');
}

const logger = pino({
    level: 'debug',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'hostname,pid'
        }
    }
});

try {
    logger.info('Starting CLPM OPC UA Client with detailed logging...');

    // Import main function
    const { main } = await import('./dist/index.js');
    
    // Keep process alive
    process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        logger.info('Received SIGINT, shutting down gracefully...');
        process.exit(0);
    });

    // Start the main application
    logger.info('Calling main function...');
    await main();
    
    logger.info('Main function completed successfully');
    
    // Keep process running
    setInterval(() => {
        logger.debug('Heartbeat - process still alive');
    }, 30000);

} catch (error) {
    console.error('Failed to start:', error);
    logger.fatal({ error: error.message, stack: error.stack }, 'Startup failed');
    process.exit(1);
}