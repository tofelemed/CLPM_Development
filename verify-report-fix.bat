@echo off
echo ========================================
echo PDF Report Fix - Verification Script
echo ========================================
echo.

echo Step 1: Rebuilding backend...
cd backend\api-gateway
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo ✓ Build successful
echo.

echo Step 2: Restarting service...
cd ..\..
docker-compose restart api-gateway
if %errorlevel% neq 0 (
    echo ERROR: Restart failed!
    pause
    exit /b 1
)
echo ✓ Service restarted
echo.

echo Step 3: Waiting for service to be ready...
timeout /t 10 /nobreak
echo.

echo Step 4: Running debug script...
cd backend\api-gateway
node debug-report-data.js
echo.

echo ========================================
echo.
echo Next steps:
echo 1. Check the debug output above
echo 2. Go to http://localhost:3000/reports
echo 3. Generate a PDF report
echo 4. Verify numbers show (not NaN%%)
echo.
echo ========================================
pause

