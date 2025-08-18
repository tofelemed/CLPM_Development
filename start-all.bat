@echo off
echo Starting CLPM Services...

REM Start infrastructure services
echo Starting infrastructure services...
docker-compose up -d db mq redis keycloak

REM Wait for services to be ready
echo Waiting for services to be ready...
timeout /t 10 /nobreak > nul

REM Start backend services in separate windows
echo Starting backend services...

start "API Gateway" cmd /k "cd backend\api-gateway && npm install && npm run start:dev"
timeout /t 5 /nobreak > nul

start "Ingestion Service" cmd /k "cd backend\ingestion && npm install && npm start"
timeout /t 2 /nobreak > nul

start "Aggregation Service" cmd /k "cd backend\aggregation && npm install && npm start"
timeout /t 2 /nobreak > nul

start "KPI Worker" cmd /k "cd backend\kpi-worker && npm install && npm start"
timeout /t 2 /nobreak > nul

start "OPC UA Client" cmd /k "cd backend\opcua-client && npm install && set PORT=4842 && npm run dev"
timeout /t 2 /nobreak > nul

start "Diagnostics Service" cmd /k "cd python-services\diagnostics_service && pip install -e . && python -m diagnostics_service.app"
timeout /t 5 /nobreak > nul

REM Start frontend
echo Starting frontend...
start "Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo All services started!
echo Frontend: http://localhost:5173
echo API Gateway: http://localhost:8080
echo OPC UA Client: http://localhost:4842
echo Keycloak: http://localhost:8081
echo RabbitMQ Management: http://localhost:15672

pause
