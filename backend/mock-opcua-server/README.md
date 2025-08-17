# CLPM OPC UA Integration

This directory contains the OPC UA client and server implementation for the Control Loop Performance Monitor (CLPM) application. The implementation provides comprehensive OPC UA connectivity with support for both OPC UA and OPC DA (via gateway) protocols.

## Features

### OPC UA Client Features
- **Connection Management**: Support for multiple OPC UA server connections
- **Security**: Full support for OPC UA security policies and authentication
- **Subscriptions**: Real-time data monitoring with configurable sampling intervals
- **Browsing**: Hierarchical address space browsing and node search
- **Reconnection**: Automatic reconnection with exponential backoff
- **Data Quality**: Comprehensive data quality monitoring and reporting

### Frontend Integration
- **Tag Browser**: Visual OPC UA address space browser
- **Connection Manager**: OPC UA connection management interface
- **Loop Configuration**: Direct loop configuration via OPC UA tag selection
- **Real-time Monitoring**: Live data display with quality indicators

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLPM Frontend │    │  OPC UA API     │    │  OPC UA Server  │
│                 │    │  (Express.js)   │    │  (DCS/PLC)      │
│ - Tag Browser   │◄──►│ - Connection    │◄──►│ - Address Space │
│ - Loop Config   │    │   Management    │    │ - Data Points   │
│ - Real-time UI  │    │ - Browsing      │    │ - Security      │
└─────────────────┘    │ - Monitoring    │    └─────────────────┘
                       └─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd backend/mock-opcua-server
npm install
```

### 2. Start the Mock OPC UA Server

```bash
# Start mock server only
npm start

# Start API server only
npm run start:api

# Start both mock server and API server
npm run start:both
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend/mock-opcua-server` directory:

```env
# OPC UA API Server Configuration
OPCUA_API_PORT=3001

# OPC UA Client Configuration
OPCUA_ENDPOINTS=opc.tcp://localhost:4840
OPCUA_SECURITY_POLICY=Basic256Sha256
OPCUA_SECURITY_MODE=SignAndEncrypt
OPCUA_SAMPLING_INTERVAL=200
OPCUA_PUBLISHING_INTERVAL=1000
OPCUA_MAX_RETRY=10

# Certificate Paths (for production)
OPCUA_CERT_PATH=./certs/client-cert.pem
OPCUA_PRIVATE_KEY_PATH=./certs/client-key.pem
```

### 4. Frontend Configuration

Add the OPC UA API base URL to your frontend environment:

```env
REACT_APP_OPCUA_API_BASE=http://localhost:3001
```

## API Endpoints

### Connection Management

#### Get All Connections
```http
GET /connections
```

#### Create Connection
```http
POST /connections
Content-Type: application/json

{
  "endpointUrl": "opc.tcp://localhost:4840",
  "username": "user",
  "password": "pass",
  "securityMode": "SignAndEncrypt",
  "securityPolicy": "Basic256Sha256"
}
```

#### Delete Connection
```http
DELETE /connections/{connectionId}
```

### Address Space Browsing

#### Browse Address Space
```http
GET /connections/{connectionId}/browse?nodeId=RootFolder&maxResults=1000
```

#### Search Nodes
```http
GET /connections/{connectionId}/search?q=Temperature&maxResults=100
```

### Data Monitoring

#### Add Monitored Item
```http
POST /connections/{connectionId}/monitor
Content-Type: application/json

{
  "nodeId": "ns=2;s=Temperature.PV",
  "samplingInterval": 200,
  "queueSize": 100
}
```

#### Remove Monitored Item
```http
DELETE /connections/{connectionId}/monitor/{nodeId}
```

### Loop Configuration

#### Create Loop
```http
POST /loops
Content-Type: application/json

{
  "name": "Temperature Control Loop",
  "description": "Reactor temperature control",
  "connectionId": "connection-id",
  "pvTag": "ns=2;s=Temperature.PV",
  "opTag": "ns=2;s=Temperature.OP",
  "spTag": "ns=2;s=Temperature.SP",
  "modeTag": "ns=2;s=Temperature.MODE",
  "valveTag": "ns=2;s=Temperature.VALVE",
  "samplingInterval": 200
}
```

## Frontend Components

### OPCUATagBrowser

A comprehensive tag browser component that allows users to:

- Browse OPC UA address space hierarchically
- Search for specific tags
- Select tags for loop configuration
- View node properties and data types

```tsx
import OPCUATagBrowser from '../components/OPCUATagBrowser';

<OPCUATagBrowser
  open={browserOpen}
  onClose={() => setBrowserOpen(false)}
  onTagSelect={(tag) => handleTagSelect(tag)}
  selectedTag={selectedTag}
  title="Select OPC UA Tag"
/>
```

### OPCUAConnectionManager

A connection management component that provides:

- OPC UA connection creation and management
- Security policy configuration
- Connection status monitoring
- Authentication setup

```tsx
import OPCUAConnectionManager from '../components/OPCUAConnectionManager';

<OPCUAConnectionManager
  open={managerOpen}
  onClose={() => setManagerOpen(false)}
/>
```

## Security Configuration

### OPC UA Security Policies

The implementation supports all standard OPC UA security policies:

- **None**: No security (testing only)
- **Basic128Rsa15**: Basic 128-bit RSA 1.5
- **Basic256**: Basic 256-bit
- **Basic256Sha256**: Basic 256-bit with SHA256 (recommended)
- **Aes128Sha256RsaOaep**: AES128 with SHA256 and RSA OAEP
- **Aes256Sha256RsaPss**: AES256 with SHA256 and RSA PSS

### Security Modes

- **None**: No security
- **Sign**: Message signing only
- **SignAndEncrypt**: Message signing and encryption (recommended)

### Certificate Management

For production deployments, configure client certificates:

```bash
# Generate client certificate
openssl req -new -x509 -keyout client-key.pem -out client-cert.pem -days 365 -nodes

# Configure certificate paths in environment
OPCUA_CERT_PATH=./certs/client-cert.pem
OPCUA_PRIVATE_KEY_PATH=./certs/client-key.pem
```

## Production Deployment

### High Availability

Deploy multiple instances for redundancy:

```yaml
# docker-compose.yml
version: '3.8'
services:
  opcua-api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - OPCUA_API_PORT=3001
      - OPCUA_ENDPOINTS=opc.tcp://dcs1:4840,opc.tcp://dcs2:4840
    restart: unless-stopped
    deploy:
      replicas: 2
```

### Monitoring

The OPC UA client exposes metrics for monitoring:

- Connection status
- Monitored items count
- Reconnection attempts
- Data quality statistics

### Firewall Configuration

Configure firewall rules for OPC UA communication:

```bash
# OPC UA ports
iptables -A INPUT -p tcp --dport 4840 -j ACCEPT

# DCOM ports (for OPC DA gateway)
iptables -A INPUT -p tcp --dport 135 -j ACCEPT
iptables -A INPUT -p tcp --dport 49152:65535 -j ACCEPT
```

## Troubleshooting

### Common Issues

#### Connection Failed
- Verify OPC UA server endpoint URL
- Check firewall settings
- Ensure security policy compatibility
- Verify authentication credentials

#### Browsing Issues
- Check node ID format
- Verify user permissions
- Ensure server supports browsing

#### Data Quality Issues
- Monitor network connectivity
- Check server data source status
- Verify sampling interval settings

### Logging

Enable detailed logging for troubleshooting:

```javascript
// In opcua-client.js
const log = pino({ 
  level: 'debug',
  prettyPrint: true 
});
```

### Performance Tuning

#### Sampling Intervals
- **Control Loops**: 100-500ms
- **Process Variables**: 1-5 seconds
- **Alarms**: 1-10 seconds

#### Subscription Limits
- **Per Session**: 200-500 monitored items
- **Per Server**: 1000-2000 monitored items
- **Queue Size**: 100-1000 samples

## Integration with CLPM

### Loop Configuration Workflow

1. **Create OPC UA Connection**
   - Configure server endpoint
   - Set security parameters
   - Test connection

2. **Browse Address Space**
   - Navigate to control loop tags
   - Identify PV, OP, SP, Mode tags
   - Verify data types and access

3. **Configure Loop**
   - Select tags for loop configuration
   - Set sampling intervals
   - Configure KPI thresholds

4. **Monitor Performance**
   - Real-time data display
   - KPI calculation
   - Diagnostic analysis

### Data Flow

```
OPC UA Server → OPC UA Client → API Server → Frontend → Database
     ↓              ↓              ↓           ↓         ↓
  Raw Data    →  Processed   →  REST API  →  UI      →  Storage
                Data Points     Endpoints   Display
```

## Development

### Adding New Features

1. **Extend OPC UA Client**
   - Add new methods to `OPCUAClientManager`
   - Implement error handling
   - Add logging

2. **Update API Endpoints**
   - Add new routes to `opcua-api.js`
   - Implement validation
   - Add error handling

3. **Enhance Frontend**
   - Create new components
   - Update existing components
   - Add new UI features

### Testing

#### Unit Tests
```bash
npm test
```

#### Integration Tests
```bash
npm run test:integration
```

#### Manual Testing
1. Start mock OPC UA server
2. Start API server
3. Test frontend components
4. Verify data flow

## License

This implementation is part of the CLPM application and follows the same licensing terms.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs
3. Verify configuration
4. Contact the development team
