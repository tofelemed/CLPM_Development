#!/bin/bash

# CLPM Docker Development Startup Script
# This script starts the CLPM system in development mode with InfluxDB architecture

set -e

echo "🚀 Starting CLPM Development Environment with InfluxDB Architecture..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it first."
    exit 1
fi

# Function to check if services are healthy
check_health() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose.dev.yml ps $service | grep -q "healthy"; then
            echo "✅ $service is healthy!"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - $service not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to display service status
show_status() {
    echo ""
    echo "📊 Development Service Status:"
    docker-compose -f docker-compose.dev.yml ps
    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend (Dev): http://localhost:5173"
    echo "   API Gateway (Dev): http://localhost:8080"
    echo "   InfluxDB: http://localhost:8086"
    echo "   Keycloak: http://localhost:8081"
    echo "   Redis: localhost:6379"
    echo "   Diagnostics: http://localhost:8050"
    echo "   pgAdmin: http://localhost:5050 (admin@clpm.com / admin123)"
    echo "   Chronograf: http://localhost:8888"
    echo ""
    echo "🔧 Development Features:"
    echo "   - Hot reload enabled for all services"
    echo "   - Source code mounted for live editing"
    echo "   - Debug logging enabled"
    echo "   - Development tools included"
    echo ""
}

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    echo "🛑 Received interrupt signal. Stopping development services..."
    docker-compose -f docker-compose.dev.yml down
    echo "✅ Development services stopped."
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start development services
echo "🔧 Starting development services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for core services to be healthy
echo ""
echo "⏳ Waiting for core services to be ready..."

# Wait for PostgreSQL
if ! check_health postgres; then
    echo "❌ PostgreSQL failed to start properly"
    docker-compose -f docker-compose.dev.yml logs postgres
    exit 1
fi

# Wait for InfluxDB
if ! check_health influxdb; then
    echo "❌ InfluxDB failed to start properly"
    docker-compose -f docker-compose.dev.yml logs influxdb
    exit 1
fi

echo ""
echo "✅ Core services are ready!"

# Show status
show_status

# Keep the script running and show logs
echo "📋 Showing development logs (Ctrl+C to stop)..."
echo ""
docker-compose -f docker-compose.dev.yml logs -f
