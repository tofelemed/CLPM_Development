# CLPM Services Startup Script
Write-Host "Starting CLPM Services..." -ForegroundColor Green

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    }
    catch {
        return $false
    }
}

# Function to wait for a service to be ready
function Wait-ForService {
    param([int]$Port, [string]$ServiceName)
    Write-Host "Waiting for $ServiceName on port $Port..." -ForegroundColor Yellow
    $attempts = 0
    while (-not (Test-Port -Port $Port) -and $attempts -lt 30) {
        Start-Sleep -Seconds 2
        $attempts++
        Write-Host "Attempt $attempts/30" -ForegroundColor Gray
    }
    if (Test-Port -Port $Port) {
        Write-Host "$ServiceName is ready!" -ForegroundColor Green
    } else {
        Write-Host "$ServiceName failed to start" -ForegroundColor Red
    }
}

# Start infrastructure services with Docker
Write-Host "Starting infrastructure services..." -ForegroundColor Cyan
docker-compose up -d db mq redis keycloak

# Wait for database to be ready
Wait-ForService -Port 5432 -ServiceName "PostgreSQL Database"

# Wait for RabbitMQ to be ready
Wait-ForService -Port 5672 -ServiceName "RabbitMQ"

# Wait for Redis to be ready
Wait-ForService -Port 6379 -ServiceName "Redis"

# Wait for Keycloak to be ready
Wait-ForService -Port 8081 -ServiceName "Keycloak"

# Start backend services
Write-Host "Starting backend services..." -ForegroundColor Cyan

# API Gateway
Write-Host "Starting API Gateway..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/api-gateway; npm install; npm run start:dev"

# Wait for API Gateway
Start-Sleep -Seconds 10
Wait-ForService -Port 8080 -ServiceName "API Gateway"

# Ingestion Service
Write-Host "Starting Ingestion Service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/ingestion; npm install; npm start"

# Aggregation Service
Write-Host "Starting Aggregation Service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/aggregation; npm install; npm start"

# KPI Worker
Write-Host "Starting KPI Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/kpi-worker; npm install; npm start"

# OPC UA Client
Write-Host "Starting OPC UA Client..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend/opcua-client; npm install; `$env:PORT=4842; npm run dev"

# Diagnostics Service
Write-Host "Starting Diagnostics Service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd python-services/diagnostics_service; pip install -e .; python -m diagnostics_service.app"

# Wait for OPC UA Client
Start-Sleep -Seconds 5
Wait-ForService -Port 4842 -ServiceName "OPC UA Client"

# Wait for diagnostics service
Start-Sleep -Seconds 5
Wait-ForService -Port 8050 -ServiceName "Diagnostics Service"

# Start Frontend
Write-Host "Starting Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm install; npm run dev"

# Wait for frontend
Start-Sleep -Seconds 10
Wait-ForService -Port 5173 -ServiceName "Frontend"

Write-Host "All services started!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "API Gateway: http://localhost:8080" -ForegroundColor Cyan
Write-Host "OPC UA Client: http://localhost:4842" -ForegroundColor Cyan
Write-Host "Keycloak: http://localhost:8081" -ForegroundColor Cyan
Write-Host "RabbitMQ Management: http://localhost:15672" -ForegroundColor Cyan
