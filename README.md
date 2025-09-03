# CLPM - Control Loop Performance Monitor

A comprehensive system for monitoring and analyzing control loop performance in industrial processes using OPC UA integration, real-time data collection, and advanced analytics.

## 🚀 Features

### Core Functionality
- **Real-time Data Acquisition**: OPC UA client for industrial data collection
- **Control Loop Monitoring**: Comprehensive monitoring of PV, OP, SP, and mode signals
- **KPI Calculation**: Automated calculation of performance indicators
- **Diagnostic Analysis**: Advanced oscillation and stiction detection
- **Data Aggregation**: Time-series data processing and storage
- **Reporting & Analytics**: Historical analysis and trend identification

### Admin Configuration System
- **OPC UA Connection Management**: Configure and manage OPC UA server connections
- **Loop Configuration**: Set up control loops with OPC UA tag mapping
- **Tag Browser**: Visual OPC UA address space browser for tag selection
- **KPI Thresholds**: Configure performance thresholds and alarm limits
- **Security Settings**: Manage authentication and access control
- **System Configuration**: Database and service configuration

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OPC UA       │    │   Ingestion     │    │   Aggregation   │    │   KPI Worker    │
│   Server/DCS   │───►│   Service       │───►│   Service       │───►│   Service       │
│                 │    │                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OPC UA       │    │   Raw Samples   │    │   Aggregated    │    │   KPI Results   │
│   API Server   │    │   (TimescaleDB) │    │   Data (1m/1h) │    │   (PostgreSQL)  │
│                 │    │                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend     │    │   API Gateway   │    │   Diagnostics   │    │   Monitoring    │
│   (React)      │◄──►│   (NestJS)      │◄──►│   Service      │◄──►│   & Alerts      │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Technology Stack

### Backend Services
- **Ingestion Service**: Node.js with OPC UA client
- **Aggregation Service**: Node.js with TimescaleDB
- **KPI Worker**: Node.js with cron scheduling
- **API Gateway**: NestJS with JWT authentication
- **OPC UA Server**: Mock server for development/testing

### Database
- **TimescaleDB**: Time-series data storage (PostgreSQL extension)
- **PostgreSQL**: Relational data and configuration storage

### Frontend
- **React**: Modern UI framework with TypeScript
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Router**: Client-side routing

### Message Queue
- **RabbitMQ**: Inter-service communication

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ with TimescaleDB extension
- RabbitMQ 3.8+
- Docker and Docker Compose (optional)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd clpm-app-latest
npm install
```

### 2. Environment Configuration

Create `.env` files for each service:

**Backend Services**:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clpm
DB_USER=postgres
DB_PASSWORD=password

# RabbitMQ
RABBITMQ_URL=amqp://localhost
RABBITMQ_EXCHANGE=clpm

# OPC UA
OPCUA_ENDPOINT=opc.tcp://localhost:4840
OPCUA_SECURITY_POLICY=Basic256Sha256
OPCUA_SECURITY_MODE=SignAndEncrypt
```

**Frontend**:
```env
REACT_APP_API_BASE=http://localhost:3000
REACT_APP_OPCUA_API_BASE=http://localhost:3001
```

### 3. Database Setup

```bash
# Install TimescaleDB
sudo apt-get install timescaledb-postgresql-14

# Create database
createdb clpm

# Run migrations
psql -U postgres -d clpm -f db/migrations/V1__init_tables.sql

# Seed sample data (optional)
psql -U postgres -d clpm -f db/seed-data.sql
```

### 4. Start Services

```bash
# Start infrastructure
docker-compose up -d postgres rabbitmq

# Start backend services
cd backend/ingestion && npm start &
cd backend/aggregation && npm start &
cd backend/kpi-worker && npm start &
cd backend/api-gateway && npm run start:dev &
cd backend/mock-opcua-server && npm run start:both &

# Start frontend
cd frontend && npm start
```

## 🔧 Configuration

### Admin Access

The configuration system is only accessible to users with `admin` role. Admin users can:

1. **OPC UA Settings** (`/config/opcua`)
   - Create and manage OPC UA server connections
   - Configure security policies and authentication
   - Test connections and monitor status
   - Manage certificates and trust lists

2. **Loop Configuration** (`/config/loops`)
   - Create and edit control loops
   - Map OPC UA tags to loop parameters
   - Configure KPI thresholds and alarm limits
   - Set importance levels and sampling intervals

3. **Tag Browser** (`/config/tags`)
   - Browse OPC UA address space
   - Search for specific tags
   - View node properties and data types
   - Select tags for loop configuration

4. **System Settings** (`/config/system`)
   - Database configuration
   - Service parameters
   - Logging and monitoring settings

### OPC UA Configuration

#### Security Policies
- **None**: No security (testing only)
- **Basic128Rsa15**: Basic 128-bit RSA 1.5
- **Basic256**: Basic 256-bit
- **Basic256Sha256**: Basic 256-bit with SHA256 (recommended)
- **Aes128Sha256RsaOaep**: AES128 with SHA256 and RSA OAEP
- **Aes256Sha256RsaPss**: AES256 with SHA256 and RSA PSS

#### Security Modes
- **None**: No security
- **Sign**: Message signing only
- **SignAndEncrypt**: Message signing and encryption (recommended)

#### Connection Parameters
- **Session Timeout**: 60,000ms (default)
- **Publishing Interval**: 1,000ms (default)
- **Lifetime Count**: 100 (default)
- **Keep Alive Count**: 10 (default)
- **Max Notifications**: 1,000 per publish

### Loop Configuration

#### Required Tags
- **PV (Process Variable)**: Current process value
- **OP (Output)**: Controller output signal
- **SP (Setpoint)**: Target value
- **Mode**: Control mode (AUTO/MANUAL)

#### Optional Tags
- **Valve**: Valve position for valve control loops

#### KPI Thresholds
- **Service Factor**: 0.8 - 0.95 (default)
- **Saturation**: 0.2 (default)
- **RPI (Relative Performance Index)**: 0.7 - 0.9 (default)
- **Oscillation Limit**: 0.3 (default)

## 📊 Data Flow

### 1. Data Acquisition
- OPC UA client connects to industrial systems
- Real-time data collection at configurable intervals
- Data quality monitoring and validation

### 2. Data Processing
- Raw data storage in TimescaleDB
- Time-window aggregation (1-minute, 1-hour)
- KPI calculation every 15 minutes (configurable)

### 3. Data Presentation
- Real-time dashboards
- Historical trend analysis
- Performance reports and alerts

## 🔒 Security

### Authentication
- JWT-based authentication
- Role-based access control (viewer, engineer, admin)
- Secure password storage with bcrypt

### OPC UA Security
- Certificate-based authentication
- Message signing and encryption
- Trust list management
- Revocation list support

### Network Security
- HTTPS for web interface
- Secure OPC UA communication
- Firewall configuration recommendations

## 📈 Monitoring & Alerts

### System Health
- Service status monitoring
- Database connection health
- OPC UA connection status
- Message queue monitoring

### Performance Metrics
- Data processing rates
- KPI calculation performance
- Database query performance
- Memory and CPU usage

### Alerting
- KPI threshold violations
- Connection failures
- Data quality issues
- System resource alerts

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Manual Testing
1. Start mock OPC UA server
2. Configure OPC UA connection
3. Create test loops
4. Verify data flow and KPI calculation

## 🚀 Deployment

### Production Considerations
- Use production OPC UA servers
- Configure proper security policies
- Set up monitoring and alerting
- Implement backup and recovery
- Use load balancers for high availability

### Docker Deployment
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment
```bash
kubectl apply -f deploy/helm/charts/clpm/
```

## 🐛 Troubleshooting

### Common Issues

1. **OPC UA Connection Failures**
   - Verify server endpoint URL
   - Check security policy compatibility
   - Verify authentication credentials
   - Check firewall settings

2. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check connection credentials
   - Ensure TimescaleDB extension is enabled

3. **Frontend Issues**
   - Check API endpoint configuration
   - Verify authentication tokens
   - Check browser console for errors

### Debug Mode
Enable debug logging in services:
```javascript
const log = pino({ 
  level: 'debug',
  prettyPrint: true 
});
```

### Logs
- **Ingestion Service**: OPC UA connection and data processing
- **Aggregation Service**: Data aggregation and storage
- **KPI Worker**: KPI calculation and scheduling
- **API Gateway**: Request handling and authentication

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
1. Check the troubleshooting section
2. Review the logs
3. Check GitHub issues
4. Contact the development team

## 🔮 Roadmap

### Upcoming Features
- Advanced analytics and machine learning
- Real-time alerts and notifications
- Mobile application
- Advanced reporting and dashboards
- Integration with external systems
- Performance optimization and scaling

### Long-term Goals
- Cloud-native deployment
- Multi-tenant architecture
- Advanced AI/ML capabilities
- Industry-specific templates
- API ecosystem and plugins#   C L P M _ D e v e l o p m e n t 
 
 #   C L P M _ D e v e l o p m e n t 
 
 #   C L P M _ D e v e l o p m e n t 
 
 









Change your pgAdmin connection settings to:
Host name/address: clpm-postgres-dev (not clpm-db or localhost)
Port: 5432
Maintenance database: clpm
Username: clpm
Password: clpm123
