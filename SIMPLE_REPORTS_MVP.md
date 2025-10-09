# Simple Reports System - MVP Implementation

## Philosophy: Keep It Simple!

**What we're NOT doing:**
- ❌ Complex report templates system
- ❌ Report scheduling (can add later)
- ❌ Email automation (can add later)
- ❌ Report storage/history (optional)

**What we ARE doing:**
- ✅ Simple on-demand report generation
- ✅ Fetch data from existing tables
- ✅ Generate PDF or Excel
- ✅ Download immediately
- ✅ Basic filters (time range, loops, KPIs)

---

## Data Flow (Super Simple!)

```
User clicks "Generate Report" in UI
    ↓
Frontend sends: { format: 'pdf', startDate, endDate, filters }
    ↓
Backend:
  1. Query kpi_results table WHERE timestamp BETWEEN start AND end
  2. Query loops table for loop details
  3. Query diagnostics_results if needed
  4. Generate PDF/Excel with that data
  5. Return file immediately
    ↓
User downloads file
```

**No new data tables needed!** We use existing data.

---

## Database Changes (Minimal)

### Option 1: NO NEW TABLES (Simplest)
Just use existing tables. Generate reports on-the-fly and return immediately.

### Option 2: ONE OPTIONAL TABLE (For tracking)
Only if you want to track report history:

```sql
CREATE TABLE report_history (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(50) NOT NULL, -- 'performance', 'diagnostic', 'custom'
    time_range_start TIMESTAMPTZ NOT NULL,
    time_range_end TIMESTAMPTZ NOT NULL,
    format VARCHAR(20) NOT NULL, -- 'pdf', 'excel', 'csv'
    filters JSONB,
    generated_by UUID,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    file_size_bytes INTEGER
);
```

**That's it!** One simple table just for logging.

---

## Backend Implementation (Simplified)

### Step 1: Install Dependencies (5 minutes)

```bash
cd backend/api-gateway
npm install pdfkit exceljs
```

### Step 2: Create Reports Module (15 minutes)

Create minimal structure:
```
backend/api-gateway/src/reports/
├── reports.controller.ts
├── reports.service.ts
├── reports.module.ts
└── generators/
    ├── pdf-generator.service.ts
    └── excel-generator.service.ts
```

### Step 3: Implement Simple Service

**`reports.service.ts`** (Simple version):

```typescript
import { Injectable } from '@nestjs/common';
import { PgService } from '../shared/pg.service';
import { PdfGeneratorService } from './generators/pdf-generator.service';
import { ExcelGeneratorService } from './generators/excel-generator.service';

@Injectable()
export class ReportsService {
  constructor(
    private pg: PgService,
    private pdfGenerator: PdfGeneratorService,
    private excelGenerator: ExcelGeneratorService,
  ) {}

  async generateReport(params: {
    format: 'pdf' | 'excel';
    startDate: string;
    endDate: string;
    loopIds?: string[];
    includeKPIs?: string[];
  }) {
    // 1. Fetch data from existing tables
    const data = await this.fetchReportData(params);

    // 2. Generate report based on format
    if (params.format === 'pdf') {
      return this.pdfGenerator.generate(data);
    } else {
      return this.excelGenerator.generate(data);
    }
  }

  private async fetchReportData(params: any) {
    // Fetch loops
    let loopsSql = `SELECT * FROM loops WHERE deleted_at IS NULL`;
    const loopParams: any[] = [];
    
    if (params.loopIds && params.loopIds.length > 0) {
      loopsSql += ` AND loop_id = ANY($1)`;
      loopParams.push(params.loopIds);
    }
    
    const loopsResult = await this.pg.query(loopsSql, loopParams);
    const loops = loopsResult.rows;

    // Fetch KPI data for each loop
    const kpiData = [];
    for (const loop of loops) {
      const kpiSql = `
        SELECT * FROM kpi_results 
        WHERE loop_id = $1 
        AND timestamp BETWEEN $2 AND $3
        ORDER BY timestamp DESC
      `;
      const kpiResult = await this.pg.query(kpiSql, [
        loop.loop_id,
        params.startDate,
        params.endDate,
      ]);
      
      kpiData.push({
        loop,
        kpis: kpiResult.rows,
        avgServiceFactor: this.calculateAverage(kpiResult.rows, 'service_factor'),
        avgPI: this.calculateAverage(kpiResult.rows, 'pi'),
        avgRPI: this.calculateAverage(kpiResult.rows, 'rpi'),
      });
    }

    // Fetch diagnostics (optional)
    const diagnosticData = [];
    for (const loop of loops) {
      const diagSql = `
        SELECT * FROM diagnostics_results 
        WHERE loop_id = $1 
        AND timestamp BETWEEN $2 AND $3
        ORDER BY timestamp DESC
        LIMIT 1
      `;
      const diagResult = await this.pg.query(diagSql, [
        loop.loop_id,
        params.startDate,
        params.endDate,
      ]);
      
      if (diagResult.rows.length > 0) {
        diagnosticData.push({
          loop,
          diagnostic: diagResult.rows[0],
        });
      }
    }

    return {
      metadata: {
        generatedAt: new Date(),
        timeRange: { start: params.startDate, end: params.endDate },
      },
      loops,
      kpiData,
      diagnosticData,
      summary: {
        totalLoops: loops.length,
        avgServiceFactor: this.calculateAverage(
          kpiData.flatMap(k => k.kpis),
          'service_factor'
        ),
      },
    };
  }

  private calculateAverage(rows: any[], field: string): number {
    if (rows.length === 0) return 0;
    const sum = rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
    return sum / rows.length;
  }
}
```

### Step 4: Simple PDF Generator

**`pdf-generator.service.ts`** (Minimal version):

```typescript
import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class PdfGeneratorService {
  generate(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('Loop Performance Report', { align: 'center' });
      doc.fontSize(12).text(
        `Generated: ${data.metadata.generatedAt.toLocaleString()}`,
        { align: 'center' }
      );
      doc.moveDown();

      // Summary
      doc.fontSize(16).text('Summary');
      doc.fontSize(12).text(`Total Loops: ${data.summary.totalLoops}`);
      doc.text(`Avg Service Factor: ${(data.summary.avgServiceFactor * 100).toFixed(1)}%`);
      doc.moveDown();

      // Loop Details
      doc.fontSize(16).text('Loop Performance');
      data.kpiData.forEach((item: any) => {
        doc.fontSize(11).text(item.loop.name, { underline: true });
        doc.fontSize(10)
           .text(`  Service Factor: ${(item.avgServiceFactor * 100).toFixed(1)}%`)
           .text(`  PI: ${item.avgPI.toFixed(3)}`)
           .text(`  RPI: ${item.avgRPI.toFixed(3)}`);
        doc.moveDown(0.5);
      });

      doc.end();
    });
  }
}
```

### Step 5: Simple Excel Generator

**`excel-generator.service.ts`** (Minimal version):

```typescript
import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelGeneratorService {
  async generate(data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Report Generated', data.metadata.generatedAt.toLocaleString()]);
    summarySheet.addRow(['Time Range', `${data.metadata.timeRange.start} to ${data.metadata.timeRange.end}`]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Total Loops', data.summary.totalLoops]);
    summarySheet.addRow(['Avg Service Factor', `${(data.summary.avgServiceFactor * 100).toFixed(1)}%`]);

    // KPI Data Sheet
    const kpiSheet = workbook.addWorksheet('KPI Data');
    kpiSheet.columns = [
      { header: 'Loop Name', key: 'name', width: 30 },
      { header: 'Service Factor', key: 'sf', width: 15 },
      { header: 'PI', key: 'pi', width: 10 },
      { header: 'RPI', key: 'rpi', width: 10 },
    ];

    data.kpiData.forEach((item: any) => {
      kpiSheet.addRow({
        name: item.loop.name,
        sf: (item.avgServiceFactor * 100).toFixed(1) + '%',
        pi: item.avgPI.toFixed(3),
        rpi: item.avgRPI.toFixed(3),
      });
    });

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }
}
```

### Step 6: Simple Controller

**`reports.controller.ts`**:

```typescript
import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post('generate')
  @Roles('viewer', 'engineer', 'admin')
  async generateReport(
    @Body() body: {
      format: 'pdf' | 'excel';
      startDate: string;
      endDate: string;
      loopIds?: string[];
    },
    @Res() res: Response,
  ) {
    // Generate report
    const buffer = await this.reportsService.generateReport(body);

    // Set headers and send
    const filename = `report_${Date.now()}.${body.format === 'pdf' ? 'pdf' : 'xlsx'}`;
    const contentType = body.format === 'pdf' 
      ? 'application/pdf' 
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
```

---

## Frontend Implementation (Simplified)

### Update `Reports.tsx`:

```typescript
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Download as DownloadIcon } from '@mui/icons-material';
import axios from 'axios';
import { subDays } from 'date-fns';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/v1';

export default function Reports() {
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [startDate, setStartDate] = useState<Date | null>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(false);

  const handleGenerateReport = async () => {
    try {
      setLoading(true);

      const response = await axios.post(
        `${API}/reports/generate`,
        {
          format,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
        {
          responseType: 'blob', // Important for file download
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Generate Report
      </Typography>

      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Format</InputLabel>
              <Select
                value={format}
                label="Format"
                onChange={(e) => setFormat(e.target.value as 'pdf' | 'excel')}
              >
                <MenuItem value="pdf">PDF</MenuItem>
                <MenuItem value="excel">Excel</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={setStartDate}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={setEndDate}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
              onClick={handleGenerateReport}
              disabled={loading || !startDate || !endDate}
            >
              {loading ? 'Generating...' : 'Generate & Download Report'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
```

---

## Implementation Steps (Simple!)

### Day 1: Backend Setup (2-3 hours)
1. ✅ Install dependencies: `npm install pdfkit exceljs`
2. ✅ Create reports module structure
3. ✅ Implement ReportsService (fetch data from existing tables)
4. ✅ Implement simple PDF generator
5. ✅ Implement simple Excel generator
6. ✅ Create controller endpoint

### Day 2: Frontend (1-2 hours)
1. ✅ Update Reports.tsx with simple form
2. ✅ Add date pickers
3. ✅ Add format selector
4. ✅ Implement download logic

### Day 3: Testing & Polish (1-2 hours)
1. ✅ Test PDF generation
2. ✅ Test Excel generation
3. ✅ Test different date ranges
4. ✅ Fix any bugs

**Total: 3 days max!**

---

## Later Enhancements (Phase 2)

Once basic works, you can add:
- ✅ Loop selection filter
- ✅ KPI selection (which KPIs to include)
- ✅ Plant area filter
- ✅ Email functionality
- ✅ Report scheduling
- ✅ Report history tracking

---

## FAQ

**Q: Where is the data stored?**
A: In your EXISTING tables (kpi_results, loops, diagnostics_results). We just query them!

**Q: Do I need to create new tables?**
A: NO! Use existing data. Optionally add report_history later for tracking.

**Q: How do reports get updated?**
A: They don't! Each report is generated fresh with current data when requested.

**Q: What about scheduling?**
A: Phase 2. First get on-demand working, then add scheduling.

**Q: Can I filter by loops?**
A: Yes! Just pass `loopIds` array in the request. Start simple, add filters incrementally.

---

## Success Criteria (MVP)

- ✅ User can select date range
- ✅ User can choose PDF or Excel
- ✅ Click button → Report downloads
- ✅ Report contains loop KPI data
- ✅ Works with existing data

**That's it! Simple, practical, working.**

---

## Next Steps

1. Start with backend (Day 1)
2. Test with Postman/curl
3. Add frontend (Day 2)
4. Polish and test (Day 3)
5. Deploy!

Once this works, we can discuss Phase 2 enhancements like email, scheduling, etc.

**Keep it simple, get it working, iterate!** 🚀

