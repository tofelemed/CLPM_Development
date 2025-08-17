# Test script for CLPM Diagnostics Service
$uri = "http://localhost:8050/diagnostics/run"

$body = @{
    loop_id = "test-loop"
    series = @{
        ts = @(1640995200, 1640995260, 1640995320)
        pv = @(100.5, 101.2, 100.8)
        op = @(50.0, 52.0, 51.0)
    }
} | ConvertTo-Json -Depth 3

$headers = @{
    "Content-Type" = "application/json"
}

try {
    Write-Host "Testing Diagnostics Service..." -ForegroundColor Green
    Write-Host "Request Body:" -ForegroundColor Yellow
    Write-Host $body -ForegroundColor Gray
    
    $response = Invoke-WebRequest -Uri $uri -Method POST -Body $body -Headers $headers
    
    Write-Host "Response Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response Body:" -ForegroundColor Yellow
    Write-Host $response.Content -ForegroundColor Gray
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "Response: $($_.Exception.Response.Content)" -ForegroundColor Red
    }
}
