import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ReportData } from '../reports.service';

@Injectable()
export class ExcelGeneratorService {
  async generateExcel(reportData: ReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'CLPM System';
    workbook.created = new Date();

    // Summary Sheet
    this.createSummarySheet(workbook, reportData);

    // Loop Details Sheet
    this.createLoopDetailsSheet(workbook, reportData);

    // KPI Data Sheet
    this.createKPIDataSheet(workbook, reportData);

    // Diagnostics Sheet
    this.createDiagnosticsSheet(workbook, reportData);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateCSV(reportData: ReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report Data');

    // Headers
    worksheet.columns = [
      { header: 'Loop ID', key: 'loop_id', width: 20 },
      { header: 'Loop Name', key: 'loop_name', width: 30 },
      { header: 'Timestamp', key: 'timestamp', width: 25 },
      { header: 'Service Factor', key: 'service_factor', width: 15 },
      { header: 'PI', key: 'pi', width: 10 },
      { header: 'RPI', key: 'rpi', width: 10 },
      { header: 'Osc Index', key: 'osc_index', width: 12 },
      { header: 'Stiction', key: 'stiction', width: 10 },
      { header: 'Saturation %', key: 'sat_percent', width: 12 },
      { header: 'Valve Travel', key: 'valve_travel', width: 12 }
    ];

    // Data rows
    reportData.loops.filter(l => l !== null).forEach(loop => {
      loop.kpis.forEach(kpi => {
        worksheet.addRow({
          loop_id: loop.loop_id,
          loop_name: loop.name,
          timestamp: kpi.timestamp,
          service_factor: kpi.service_factor,
          pi: kpi.pi,
          rpi: kpi.rpi,
          osc_index: kpi.osc_index,
          stiction: kpi.stiction,
          sat_percent: kpi.sat_percent,
          valve_travel: kpi.valve_travel
        });
      });
    });

    const buffer = await workbook.csv.writeBuffer();
    return Buffer.from(buffer);
  }

  private createSummarySheet(workbook: ExcelJS.Workbook, reportData: ReportData) {
    const sheet = workbook.addWorksheet('Summary');

    // Title
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Control Loop Performance Report - Summary';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' }
    };
    titleCell.font = { ...titleCell.font, color: { argb: 'FFFFFFFF' } };

    // Metadata
    sheet.getCell('A3').value = 'Report Type:';
    sheet.getCell('B3').value = reportData.metadata.reportType.toUpperCase();
    sheet.getCell('A4').value = 'Generated:';
    sheet.getCell('B4').value = new Date(reportData.metadata.generatedAt).toLocaleString();
    sheet.getCell('A5').value = 'Period Start:';
    sheet.getCell('B5').value = new Date(reportData.metadata.timeRange.start).toLocaleString();
    sheet.getCell('A6').value = 'Period End:';
    sheet.getCell('B6').value = new Date(reportData.metadata.timeRange.end).toLocaleString();

    // Style metadata
    ['A3', 'A4', 'A5', 'A6'].forEach(cell => {
      sheet.getCell(cell).font = { bold: true };
    });

    // Summary statistics
    sheet.getCell('A9').value = 'Summary Statistics';
    sheet.getCell('A9').font = { size: 14, bold: true };
    sheet.getCell('A9').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' }
    };

    const summaryData = [
      ['Metric', 'Value'],
      ['Total Loops Analyzed', reportData.summary.totalLoops],
      ['Average Service Factor', `${(reportData.summary.avgServiceFactor * 100).toFixed(1)}%`],
      ['Average Performance Index (PI)', `${(reportData.summary.avgPI * 100).toFixed(1)}%`],
      ['Average RPI', `${(reportData.summary.avgRPI * 100).toFixed(1)}%`],
      ['Loops with Issues', reportData.summary.loopsWithIssues],
      ['Overall Health', `${reportData.summary.healthPercentage}%`]
    ];

    sheet.addTable({
      name: 'SummaryTable',
      ref: 'A10',
      headerRow: true,
      style: {
        theme: 'TableStyleMedium9',
        showRowStripes: true,
      },
      columns: summaryData[0].map(name => ({ name: String(name) })),
      rows: summaryData.slice(1)
    });

    // Set column widths
    sheet.getColumn(1).width = 35;
    sheet.getColumn(2).width = 20;
  }

  private createLoopDetailsSheet(workbook: ExcelJS.Workbook, reportData: ReportData) {
    const sheet = workbook.addWorksheet('Loop Details');

    // Headers
    const headers = [
      'Loop ID', 'Loop Name', 'Description', 'Importance',
      'PV Tag', 'OP Tag', 'SP Tag',
      'Avg Service Factor', 'Avg PI', 'Avg RPI',
      'Avg Osc Index', 'Avg Stiction',
      'SF Min', 'SF Max', 'PI Min', 'PI Max',
      'Records Count'
    ];

    sheet.addRow(headers);

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' }
    };
    sheet.getRow(1).font = { ...sheet.getRow(1).font, color: { argb: 'FFFFFFFF' } };

    // Data rows
    reportData.loops.filter(l => l !== null).forEach(loop => {
      const stats = loop.kpiStats || {};
      sheet.addRow([
        loop.loop_id,
        loop.name,
        loop.description || '',
        loop.importance,
        loop.pv_tag,
        loop.op_tag,
        loop.sp_tag,
        stats.avgServiceFactor ? (stats.avgServiceFactor * 100).toFixed(1) + '%' : 'N/A',
        stats.avgPI ? (stats.avgPI * 100).toFixed(1) + '%' : 'N/A',
        stats.avgRPI ? (stats.avgRPI * 100).toFixed(1) + '%' : 'N/A',
        stats.avgOscIndex ? stats.avgOscIndex.toFixed(3) : 'N/A',
        stats.avgStiction ? stats.avgStiction.toFixed(3) : 'N/A',
        stats.minServiceFactor ? (stats.minServiceFactor * 100).toFixed(1) + '%' : 'N/A',
        stats.maxServiceFactor ? (stats.maxServiceFactor * 100).toFixed(1) + '%' : 'N/A',
        stats.minPI ? (stats.minPI * 100).toFixed(1) + '%' : 'N/A',
        stats.maxPI ? (stats.maxPI * 100).toFixed(1) + '%' : 'N/A',
        loop.recordCount || 0
      ]);
    });

    // Auto-fit columns
    sheet.columns.forEach(column => {
      column.width = 15;
    });
    sheet.getColumn(2).width = 25; // Loop Name
    sheet.getColumn(3).width = 30; // Description
  }

  private createKPIDataSheet(workbook: ExcelJS.Workbook, reportData: ReportData) {
    const sheet = workbook.addWorksheet('KPI Data');

    // Headers
    const headers = [
      'Loop ID', 'Loop Name', 'Timestamp',
      'Service Factor', 'Effective SF', 'Saturation %', 'Output Travel',
      'PI', 'RPI', 'Osc Index', 'Stiction',
      'Deadband', 'Valve Travel', 'Settling Time',
      'Overshoot', 'Rise Time', 'Peak Error',
      'Noise Level', 'Valve Reversals'
    ];

    sheet.addRow(headers);

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' }
    };
    sheet.getRow(1).font = { ...sheet.getRow(1).font, color: { argb: 'FFFFFFFF' } };

    // Data rows
    reportData.loops.filter(l => l !== null).forEach(loop => {
      loop.kpis.forEach(kpi => {
        sheet.addRow([
          loop.loop_id,
          loop.name,
          new Date(kpi.timestamp).toLocaleString(),
          kpi.service_factor,
          kpi.effective_sf,
          kpi.sat_percent,
          kpi.output_travel,
          kpi.pi,
          kpi.rpi,
          kpi.osc_index,
          kpi.stiction,
          kpi.deadband,
          kpi.valve_travel,
          kpi.settling_time,
          kpi.overshoot,
          kpi.rise_time,
          kpi.peak_error,
          kpi.noise_level,
          kpi.valve_reversals
        ]);
      });
    });

    // Auto-fit columns
    sheet.columns.forEach(column => {
      column.width = 12;
    });
    sheet.getColumn(1).width = 20; // Loop ID
    sheet.getColumn(2).width = 25; // Loop Name
    sheet.getColumn(3).width = 20; // Timestamp
  }

  private createDiagnosticsSheet(workbook: ExcelJS.Workbook, reportData: ReportData) {
    const sheet = workbook.addWorksheet('Diagnostics');

    // Headers
    const headers = [
      'Loop ID', 'Loop Name', 'Timestamp',
      'Stiction S', 'Stiction J', 'Stiction %',
      'Osc Period', 'Root Cause', 'Classification'
    ];

    sheet.addRow(headers);

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' }
    };
    sheet.getRow(1).font = { ...sheet.getRow(1).font, color: { argb: 'FFFFFFFF' } };

    // Data rows
    reportData.loops.filter(l => l !== null).forEach(loop => {
      loop.diagnostics.forEach(diag => {
        sheet.addRow([
          loop.loop_id,
          loop.name,
          new Date(diag.timestamp).toLocaleString(),
          diag.stiction_S,
          diag.stiction_J,
          diag.stiction_pct,
          diag.osc_period,
          diag.root_cause || 'N/A',
          diag.classification || 'N/A'
        ]);
      });
    });

    // Auto-fit columns
    sheet.columns.forEach(column => {
      column.width = 15;
    });
    sheet.getColumn(2).width = 25; // Loop Name
    sheet.getColumn(8).width = 30; // Root Cause
    sheet.getColumn(9).width = 25; // Classification
  }
}
