@echo off
REM CLPM Docker Startup Script for Windows
REM This script starts the CLPM system with InfluxDB Cloud architecture

echo 🚀 Starting CLPM with InfluxDB Cloud Architecture...

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

echo 🔧 Starting services...
docker-compose up -d

if %errorlevel% neq 0 (
    echo ❌ Failed to start services
    pause
    exit /b 1
)

echo.
echo ⏳ Waiting for services to be ready...
timeout /t 30 /nobreak >nul

echo.
echo 📊 Service Status:
docker-compose ps

echo.
echo 🌐 Access URLs:
echo    Frontend: http://localhost:80
echo    API Gateway: http://localhost:8080
echo    InfluxDB: http://localhost:8086 (admin / admin123)
echo    Keycloak: http://localhost:8081
echo    Redis: localhost:6379
echo    Diagnostics: http://localhost:8050
echo    pgAdmin: http://localhost:5050 (admin@clpm.com / admin123)
echo.
echo 📋 To view logs, run: docker-compose logs -f
echo 📋 To stop services, run: docker-compose down
echo.
echo ✅ Services started successfully!
pause
