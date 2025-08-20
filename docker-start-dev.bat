@echo off
REM CLPM Docker Development Startup Script for Windows
REM This script starts the CLPM system in development mode with InfluxDB architecture

echo 🚀 Starting CLPM Development Environment with InfluxDB Architecture...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ docker-compose is not installed. Please install it first.
    pause
    exit /b 1
)

echo 🔧 Starting development services...
docker-compose -f docker-compose.dev.yml up -d

if %errorlevel% neq 0 (
    echo ❌ Failed to start development services
    pause
    exit /b 1
)

echo.
echo ⏳ Waiting for services to be ready...
timeout /t 30 /nobreak >nul

echo.
echo 📊 Development Service Status:
docker-compose -f docker-compose.dev.yml ps

echo.
echo 🌐 Access URLs:
echo    Frontend (Dev): http://localhost:5173
echo    API Gateway (Dev): http://localhost:8080
echo    InfluxDB: http://localhost:8086
echo    Keycloak: http://localhost:8081
echo    Redis: localhost:6379
echo    Diagnostics: http://localhost:8050
echo    pgAdmin: http://localhost:5050 (admin@clpm.com / admin123)
echo    Chronograf: http://localhost:8888
echo.
echo 🔧 Development Features:
echo    - Hot reload enabled for all services
echo    - Source code mounted for live editing
echo    - Debug logging enabled
echo    - Development tools included
echo.
echo 📋 To view logs, run: docker-compose -f docker-compose.dev.yml logs -f
echo 📋 To stop services, run: docker-compose -f docker-compose.dev.yml down
echo.
echo ✅ Development services started successfully!
pause
