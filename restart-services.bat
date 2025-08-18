@echo off
echo Restarting CLPM Services...

REM Stop all services
echo Stopping all services...
docker-compose down --remove-orphans

REM Wait a moment
timeout /t 3 /nobreak > nul

REM Rebuild and start all services
echo Rebuilding and starting all services...
docker-compose up -d --build

REM Wait for services to start
echo Waiting for services to start...
timeout /t 10 /nobreak > nul

REM Show service status
echo Checking service status...
docker-compose ps

echo.
echo Service URLs:
echo Frontend: http://localhost:5173
echo API Gateway: http://localhost:8080
echo OPC UA Client: http://localhost:4840
echo Keycloak: http://localhost:8081
echo RabbitMQ Management: http://localhost:15672
echo Diagnostics Service: http://localhost:8050

echo.
echo All services restarted!
pause
