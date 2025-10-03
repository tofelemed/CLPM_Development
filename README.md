# CLPM - Control Loop Performance Monitor

A comprehensive system for monitoring and analyzing control loop performance in industrial processes using real-time data collection and advanced analytics.

## 🚀 Features

### Core Functionality
- **Control Loop Monitoring**: Comprehensive monitoring of PV, OP, SP, and mode signals
- **KPI Calculation**: Automated calculation of performance indicators
- **Diagnostic Analysis**: Advanced oscillation and stiction detection
- **Data Aggregation**: Time-series data processing and storage
- **Reporting & Analytics**: Historical analysis and trend identification

### Admin Configuration System
- **Loop Configuration**: Set up control loops with tag mapping
- **KPI Thresholds**: Configure performance thresholds and alarm limits
- **Security Settings**: Manage authentication and access control
- **System Configuration**: Database and service configuration

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Data Sources │    │   Aggregation   │    │   KPI Worker    │    │   API Gateway   │
│   (External)   │───►│   Service       │───►│   Service       │───►│   (NestJS)      │
│                 │    │                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Raw Samples  │    │   Aggregated    │    │   KPI Results   │    │   Frontend      │
│   (InfluxDB)   │    │   Data (1m/1h) │    │   (PostgreSQL)  │    │   (React)       │
│                 │    │                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Diagnostics  │    │   Monitoring    │    │   Reporting     │    │   Analytics     │
│   Service      │    │   & Alerts      │    │   & Dashboards  │    │   & Insights    │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Technology Stack

### Backend Services
- **Aggregation Service**: Node.js with InfluxDB integration
- **KPI Worker**: Node.js with cron scheduling
- **API Gateway**: NestJS with JWT authentication
- **Diagnostics Service**: Python-based analysis

### Database
- **InfluxDB**: Time-series data storage
- **PostgreSQL**: Relational data and configuration storage

### Frontend
- **React**: Modern UI framework with TypeScript
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **React Router**: Client-side routing

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ with TimescaleDB extension
- InfluxDB 2.7+
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

# InfluxDB
INFLUXDB_URL=http://localhost:8086/
INFLUXDB_TOKEN=your-token
INFLUXDB_ORG=clpm
INFLUXDB_BUCKET=clpm_data

```

**Frontend**:
```env
VITE_API_BASE=http://localhost:8080/api/v1
VITE_OIDC_ISSUER=http://localhost:8081/realms/clpm
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
docker-compose up -d

# Or use startup scripts
start-all.bat  # Windows
./start-services.ps1  # PowerShell
```

## 🔧 Configuration

### Admin Access

The configuration system is only accessible to users with `admin` role. Admin users can:

1. **Loop Configuration** (`/config/loops`)
   - Create and edit control loops
   - Configure loop parameters and tags
   - Configure KPI thresholds and alarm limits
   - Set importance levels and sampling intervals

2. **System Settings** (`/config/system`)
   - Database configuration
   - Service parameters
   - Logging and monitoring settings


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
- External data sources connect to the system
- Real-time data collection at configurable intervals
- Data quality monitoring and validation

### 2. Data Processing
- Raw data storage in InfluxDB
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

### Network Security
- HTTPS for web interface
- Secure communication protocols
- Firewall configuration recommendations

## 📈 Monitoring & Alerts

### System Health
- Service status monitoring
- Database connection health
- External data source status
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
1. Configure external data sources
2. Create test loops
3. Verify data flow and KPI calculation

## 🚀 Deployment

### Production Considerations
- Configure production data sources
- Set up monitoring and alerting
- Implement backup and recovery
- Use load balancers for high availability

### Docker Deployment
```bash
docker-compose up -d
```

### Kubernetes Deployment
```bash
kubectl apply -f deploy/helm/charts/clpm/
```

## 🐛 Troubleshooting

### Common Issues

1. **Data Source Connection Failures**
   - Verify data source endpoint URLs
   - Check network connectivity
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
- API ecosystem and plugins

## 🔗 Service URLs

After starting the system, you can access:

- **Frontend**: http://localhost:80
- **API Gateway**: http://localhost:8080
- **InfluxDB**: http://localhost:8086 (admin / admin123)
- **pgAdmin**: http://localhost:5050 (admin@clpm.com / admin123)
- **Diagnostics**: http://localhost:8050
    python -m uvicorn diagnostics_service.app:app --host 0.0.0.0 --port 8050 --reload
- **Keycloak**: http://localhost:8081

## 🗄️ Database Configuration

Change your pgAdmin connection settings to:
- **Host**: clpm-postgres (or localhost)
- **Port**: 5432
- **Database**: clpm
- **Username**: clpm
- **Password**: clpm_pwd




PostgreSQL Server Details:
Field	Value
Host/Server	postgres (within Docker network) or localhost (from host machine)
Port	5432
Database	clpm
Username	clpm
Password	clpm_pwd
pgAdmin Access:
Field	Value
URL	http://localhost:5050
Email	admin@clpm.com
Password	admin123