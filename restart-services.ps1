# CLPM Services Restart Script
Write-Host "Restarting CLPM Services..." -ForegroundColor Green

# Function to check if Docker is running
function Test-Docker {
    try {
        docker version | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to check service health
function Test-ServiceHealth {
    param([string]$ServiceName, [int]$Port, [int]$Timeout = 60)
    Write-Host "Checking $ServiceName health..." -ForegroundColor Yellow
    $attempts = 0
    while ($attempts -lt $Timeout) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "$ServiceName is healthy!" -ForegroundColor Green
                return $true
            }
        }
        catch {
            # Continue trying
        }
        Start-Sleep -Seconds 2
        $attempts++
        Write-Host "Attempt $attempts/$Timeout" -ForegroundColor Gray
    }
    Write-Host "$ServiceName health check failed" -ForegroundColor Red
    return $false
}

# Check if Docker is running
if (-not (Test-Docker)) {
    Write-Host "Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Stop all services
Write-Host "Stopping all services..." -ForegroundColor Cyan
docker-compose down --remove-orphans

# Wait a moment
Start-Sleep -Seconds 3

# Rebuild and start all services
Write-Host "Rebuilding and starting all services..." -ForegroundColor Cyan
docker-compose up -d --build

# Wait for services to start
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service status
Write-Host "Checking service status..." -ForegroundColor Cyan
docker-compose ps

# Health checks for key services
Write-Host "Performing health checks..." -ForegroundColor Cyan

# Check database
try {
    docker-compose exec -T db pg_isready -U clpm -d clpm | Out-Null
    Write-Host "Database is ready!" -ForegroundColor Green
}
catch {
    Write-Host "Database health check failed" -ForegroundColor Red
}

# Check RabbitMQ
try {
    docker-compose exec -T mq rabbitmqctl status | Out-Null
    Write-Host "RabbitMQ is ready!" -ForegroundColor Green
}
catch {
    Write-Host "RabbitMQ health check failed" -ForegroundColor Red
}

# Check Redis
try {
    docker-compose exec -T redis redis-cli ping | Out-Null
    Write-Host "Redis is ready!" -ForegroundColor Green
}
catch {
    Write-Host "Redis health check failed" -ForegroundColor Red
}

# Check API Gateway
Test-ServiceHealth -ServiceName "API Gateway" -Port 8080

# Check OPC UA Client
Test-ServiceHealth -ServiceName "OPC UA Client" -Port 4840

# Check Diagnostics Service
Test-ServiceHealth -ServiceName "Diagnostics Service" -Port 8050

# Check Frontend
Test-ServiceHealth -ServiceName "Frontend" -Port 5173

Write-Host "`nService URLs:" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "API Gateway: http://localhost:8080" -ForegroundColor Cyan
Write-Host "OPC UA Client: http://localhost:4840" -ForegroundColor Cyan
Write-Host "Keycloak: http://localhost:8081" -ForegroundColor Cyan
Write-Host "RabbitMQ Management: http://localhost:15672" -ForegroundColor Cyan
Write-Host "Diagnostics Service: http://localhost:8050" -ForegroundColor Cyan

Write-Host "`nAll services restarted!" -ForegroundColor Green
