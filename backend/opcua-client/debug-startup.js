import pino from 'pino';

console.log('=== DEBUG STARTUP ===');
console.log('Node version:', process.version);
console.log('Current working directory:', process.cwd());

try {
    console.log('Creating logger...');
    const logger = pino({ level: 'debug' });
    
    console.log('Importing modules from dist...');
    const { validateEnvironment } = await import('./dist/utils/validation.js');
    
    console.log('Validating environment...');
    const envValidation = validateEnvironment();
    console.log('Environment validation result:', envValidation);
    
    if (!envValidation.valid) {
        console.error('Environment validation failed:', envValidation.errors);
        process.exit(1);
    }
    
    console.log('Importing client config...');
    const { createClientConfig } = await import('./dist/index.js');
    
    console.log('Creating config...');
    const config = createClientConfig();
    console.log('Config created successfully');
    
    console.log('Importing OPCUAClient...');
    const { OPCUAClient } = await import('./dist/OPCUAClient.js');
    
    console.log('Creating client instance...');
    const client = new OPCUAClient(logger, config);
    
    console.log('Client created successfully!');
    
    console.log('Testing server creation...');
    const { createServerConfig } = await import('./dist/api/server.js');
    const serverConfig = createServerConfig();
    console.log('Server config:', serverConfig);
    
    console.log('=== SUCCESS: All imports and basic setup completed ===');
    
} catch (error) {
    console.error('=== ERROR DURING STARTUP ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    process.exit(1);
}