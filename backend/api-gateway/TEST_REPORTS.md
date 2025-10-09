# Reports API Testing Guide

## Overview
The reporting system generates PDF, Excel, and CSV reports for control loop performance analysis.

## API Endpoints

### 1. Generate Report
**POST** `/reports/generate`

Generates a report in the specified format and downloads it.

**Request Body:**
```json
{
  "reportName": "Daily Performance Summary",
  "reportType": "daily",
  "timeRange": "24h",
  "format": "pdf",
  "loopIds": ["LOOP-001", "LOOP-002"],
  "kpis": ["service_factor", "pi", "rpi"]
}
```

**Parameters:**
- `reportName` (optional): Custom name for the report
- `reportType`: `"daily"`, `"weekly"`, `"monthly"`, or `"custom"`
- `timeRange`: `"24h"`, `"7d"`, `"30d"`, or `"custom"`
- `format`: `"pdf"`, `"excel"`, or `"csv"`
- `startDate` (optional): ISO date string (required if timeRange is "custom")
- `endDate` (optional): ISO date string (required if timeRange is "custom")
- `loopIds` (optional): Array of loop IDs to include (empty = all loops)
- `kpis` (optional): Array of KPI names to include

**Response:**
Binary file download with appropriate content-type header.

### 2. Preview Report Data
**POST** `/reports/preview`

Returns the report data in JSON format without generating a file.

**Request Body:** Same as Generate Report

**Response:**
```json
{
  "success": true,
  "data": {
    "metadata": {
      "reportName": "Daily Performance Summary",
      "reportType": "daily",
      "generatedAt": "2025-10-08T12:00:00Z",
      "timeRange": {
        "start": "2025-10-07T12:00:00Z",
        "end": "2025-10-08T12:00:00Z"
      }
    },
    "loops": [...],
    "summary": {
      "totalLoops": 10,
      "avgServiceFactor": 0.85,
      "avgPI": 0.78,
      "avgRPI": 0.82,
      "loopsWithIssues": 3,
      "healthPercentage": 70
    }
  }
}
```

## Testing with cURL

### Test PDF Generation
```bash
curl -X POST http://localhost:3000/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "reportName": "Test Daily Report",
    "reportType": "daily",
    "timeRange": "24h",
    "format": "pdf"
  }' \
  --output daily_report.pdf
```

### Test Excel Generation
```bash
curl -X POST http://localhost:3000/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "reportName": "Test Weekly Report",
    "reportType": "weekly",
    "timeRange": "7d",
    "format": "excel"
  }' \
  --output weekly_report.xlsx
```

### Test CSV Generation
```bash
curl -X POST http://localhost:3000/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "reportName": "Test Monthly Report",
    "reportType": "monthly",
    "timeRange": "30d",
    "format": "csv"
  }' \
  --output monthly_report.csv
```

### Test Custom Date Range
```bash
curl -X POST http://localhost:3000/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "reportName": "Custom Report",
    "reportType": "custom",
    "timeRange": "custom",
    "startDate": "2025-10-01T00:00:00Z",
    "endDate": "2025-10-08T00:00:00Z",
    "format": "pdf"
  }' \
  --output custom_report.pdf
```

### Test Preview
```bash
curl -X POST http://localhost:3000/reports/preview \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "daily",
    "timeRange": "24h",
    "format": "pdf"
  }'
```

### Test Specific Loops
```bash
curl -X POST http://localhost:3000/reports/generate \
  -H "Content-Type: application/json" \
  -d '{
    "reportName": "Selected Loops Report",
    "reportType": "daily",
    "timeRange": "24h",
    "format": "pdf",
    "loopIds": ["LOOP-001", "LOOP-002", "LOOP-003"]
  }' \
  --output selected_loops.pdf
```

## Report Contents

### PDF Report Includes:
- Executive Summary with key metrics
- Loop-by-loop performance analysis
- Color-coded KPI values (red for poor, green for good)
- Recent diagnostic information
- Professional formatting with headers and footers

### Excel Report Includes:
- **Summary Sheet**: Overview statistics
- **Loop Details Sheet**: Performance metrics for all loops
- **KPI Data Sheet**: Raw KPI data with timestamps
- **Diagnostics Sheet**: Diagnostic results and classifications

### CSV Report Includes:
- Flattened data with all KPI values
- One row per loop per timestamp
- Easy to import into other tools

## Database Schema Used

### Tables:
- `loops` - Loop information (name, tags, importance)
- `loop_config` - Configuration and thresholds
- `kpi_results` - KPI calculations (service_factor, pi, rpi, etc.)
- `diagnostic_results` - Diagnostic analysis results

### KPI Metrics Included:
- Service Factor (SF)
- Performance Index (PI)
- Revised Performance Index (RPI)
- Oscillation Index
- Stiction Severity
- Saturation Percentage
- Valve Travel
- Settling Time
- Overshoot
- Rise Time
- Peak Error
- Noise Level
- And more...

## Health Indicators

Loops are flagged as having issues if:
- Service Factor < 0.75
- Performance Index < 0.65
- Oscillation Index > 0.4
- Stiction Severity > 0.5

## Frontend Usage

The frontend provides:
- Form-based report configuration
- Quick template buttons (Daily, Weekly, Monthly)
- Multi-select loop picker
- Custom date range selector
- Format selection (PDF/Excel/CSV)
- Preview functionality
- Automatic file download

## Error Handling

The API returns appropriate error messages for:
- Missing required parameters
- Invalid date ranges
- Database connection issues
- No data available for selected criteria
- Invalid loop IDs

## Performance Considerations

- Reports are generated on-demand
- Large date ranges may take longer to process
- PDF generation is fastest for small datasets
- Excel/CSV is better for large datasets
- Consider limiting to specific loops for faster generation
