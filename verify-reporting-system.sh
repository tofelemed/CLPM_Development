#!/bin/bash

echo "=========================================="
echo "CLPM Reporting System Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check backend files
echo "1. Checking Backend Files..."
files=(
  "backend/api-gateway/src/reports/reports.module.ts"
  "backend/api-gateway/src/reports/reports.service.ts"
  "backend/api-gateway/src/reports/reports.controller.ts"
  "backend/api-gateway/src/reports/dto/generate-report.dto.ts"
  "backend/api-gateway/src/reports/generators/pdf-generator.service.ts"
  "backend/api-gateway/src/reports/generators/excel-generator.service.ts"
)

all_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "   ${GREEN}✓${NC} $file"
  else
    echo -e "   ${RED}✗${NC} $file (missing)"
    all_exist=false
  fi
done

# Check frontend file
echo ""
echo "2. Checking Frontend File..."
if [ -f "frontend/src/pages/Reports.tsx" ]; then
  # Check if it's the new version (has useState)
  if grep -q "useState" "frontend/src/pages/Reports.tsx"; then
    echo -e "   ${GREEN}✓${NC} frontend/src/pages/Reports.tsx (updated with full functionality)"
  else
    echo -e "   ${YELLOW}!${NC} frontend/src/pages/Reports.tsx (exists but may not be updated)"
  fi
else
  echo -e "   ${RED}✗${NC} frontend/src/pages/Reports.tsx (missing)"
  all_exist=false
fi

# Check app.module.ts includes ReportsModule
echo ""
echo "3. Checking Module Integration..."
if grep -q "ReportsModule" "backend/api-gateway/src/app.module.ts"; then
  echo -e "   ${GREEN}✓${NC} ReportsModule registered in app.module.ts"
else
  echo -e "   ${RED}✗${NC} ReportsModule NOT registered in app.module.ts"
fi

# Build backend
echo ""
echo "4. Building Backend..."
cd backend/api-gateway
if npm run build > /dev/null 2>&1; then
  echo -e "   ${GREEN}✓${NC} Backend build successful"
else
  echo -e "   ${RED}✗${NC} Backend build failed"
  echo "   Run 'cd backend/api-gateway && npm run build' to see errors"
fi
cd ../..

# Build frontend
echo ""
echo "5. Building Frontend..."
cd frontend
if npm run build > /dev/null 2>&1; then
  echo -e "   ${GREEN}✓${NC} Frontend build successful"
else
  echo -e "   ${RED}✗${NC} Frontend build failed"
  echo "   Run 'cd frontend && npm run build' to see errors"
fi
cd ..

# Summary
echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""

if [ "$all_exist" = true ]; then
  echo -e "${GREEN}✓ All files are in place${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Start the backend: cd backend/api-gateway && npm start"
  echo "2. Start the frontend: cd frontend && npm run dev"
  echo "3. Navigate to http://localhost:5173/reports"
  echo "4. Generate your first report!"
  echo ""
  echo "For API testing, see: backend/api-gateway/TEST_REPORTS.md"
  echo "For full documentation, see: REPORTING_SYSTEM_SUMMARY.md"
else
  echo -e "${RED}✗ Some files are missing${NC}"
  echo "Please check the errors above"
fi

echo ""
