import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { ReportData } from '../reports.service';

@Injectable()
export class PdfGeneratorService {
  // Color palette
  private readonly colors = {
    primary: '#1976d2',
    secondary: '#0d47a1',
    success: '#4caf50',
    warning: '#ff9800',
    danger: '#f44336',
    text: '#212121',
    textLight: '#757575',
    border: '#e0e0e0',
    background: '#f5f5f5',
    headerBg: '#1565c0',
    white: '#ffffff'
  };

  async generatePDF(reportData: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: reportData.metadata.reportName,
          Author: 'CLPM System',
          Subject: 'Control Loop Performance Report',
          Keywords: 'control loops, performance, monitoring'
        }
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        // Cover page
        this.addCoverPage(doc, reportData.metadata, reportData.summary);

        // Summary page
        doc.addPage();
        this.addDetailedSummary(doc, reportData.summary, reportData.metadata);

        // Loop details
        doc.addPage();
        this.addLoopsSection(doc, reportData.loops);

        // Add headers and footers to all pages
        this.addHeadersAndFooters(doc, reportData.metadata);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addCoverPage(doc: typeof PDFDocument, metadata: any, summary: any) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Background header bar
    doc
      .rect(0, 0, pageWidth, 150)
      .fill(this.colors.headerBg);

    // Main title
    doc
      .fontSize(32)
      .font('Helvetica-Bold')
      .fillColor(this.colors.white)
      .text('Control Loop', 0, 50, { align: 'center' })
      .text('Performance Report', 0, 90, { align: 'center' });

    // Report type badge
    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor(this.colors.white)
      .text(metadata.reportType.toUpperCase(), 0, 130, { align: 'center' });

    // Reset fill color
    doc.fillColor(this.colors.text);

    // Report information box
    const boxY = 200;
    const boxHeight = 180;

    // Box background
    doc
      .roundedRect(80, boxY, pageWidth - 160, boxHeight, 5)
      .fillAndStroke(this.colors.background, this.colors.border);

    doc.fillColor(this.colors.text);

    // Report info
    const infoY = boxY + 30;
    const labelX = 100;
    const valueX = 280;

    const infoItems = [
      { label: 'Report Name', value: metadata.reportName },
      { label: 'Generated', value: new Date(metadata.generatedAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })},
      { label: 'Period Start', value: new Date(metadata.timeRange.start).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })},
      { label: 'Period End', value: new Date(metadata.timeRange.end).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })}
    ];

    infoItems.forEach((item, i) => {
      const y = infoY + (i * 30);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(this.colors.textLight)
        .text(item.label + ':', labelX, y, { width: 150 });

      doc
        .font('Helvetica')
        .fillColor(this.colors.text)
        .text(item.value, valueX, y, { width: 200 });
    });

    // Summary metrics cards
    const cardY = boxY + boxHeight + 40;
    const cardWidth = 160;
    const cardHeight = 100;
    const cardGap = 20;
    const totalCardsWidth = (cardWidth * 3) + (cardGap * 2);
    const startX = (pageWidth - totalCardsWidth) / 2;

    const metrics = [
      {
        label: 'Total Loops',
        value: summary.totalLoops.toString(),
        color: this.colors.primary
      },
      {
        label: 'Avg Performance',
        value: `${(summary.avgServiceFactor * 100).toFixed(0)}%`,
        color: summary.avgServiceFactor >= 0.75 ? this.colors.success : this.colors.danger
      },
      {
        label: 'Health Score',
        value: `${summary.healthPercentage}%`,
        color: summary.healthPercentage >= 70 ? this.colors.success : this.colors.warning
      }
    ];

    metrics.forEach((metric, i) => {
      const x = startX + (i * (cardWidth + cardGap));

      // Card background
      doc
        .roundedRect(x, cardY, cardWidth, cardHeight, 5)
        .fillAndStroke(this.colors.white, this.colors.border);

      // Metric value
      doc
        .fontSize(28)
        .font('Helvetica-Bold')
        .fillColor(metric.color)
        .text(metric.value, x, cardY + 25, { width: cardWidth, align: 'center' });

      // Metric label
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor(this.colors.textLight)
        .text(metric.label, x, cardY + 65, { width: cardWidth, align: 'center' });
    });

    // Bottom note
    doc
      .fontSize(10)
      .font('Helvetica-Oblique')
      .fillColor(this.colors.textLight)
      .text('Generated by CLPM System', 0, pageHeight - 80, { align: 'center' });
  }

  private addDetailedSummary(doc: typeof PDFDocument, summary: any, metadata: any) {
    // Section title
    this.addSectionTitle(doc, 'Executive Summary', 70);

    let currentY = 110;

    // Summary statistics table
    const tableData = [
      ['Metric', 'Value', 'Status'],
      ['Total Loops Analyzed', summary.totalLoops.toString(), '—'],
      ['Average Service Factor', `${(summary.avgServiceFactor * 100).toFixed(1)}%`, summary.avgServiceFactor >= 0.75 ? '✓ Good' : '✗ Poor'],
      ['Average Performance Index', `${(summary.avgPI * 100).toFixed(1)}%`, summary.avgPI >= 0.65 ? '✓ Good' : '✗ Poor'],
      ['Average RPI', `${(summary.avgRPI * 100).toFixed(1)}%`, summary.avgRPI >= 0.70 ? '✓ Good' : '✗ Poor'],
      ['Loops with Issues', summary.loopsWithIssues.toString(), summary.loopsWithIssues === 0 ? '✓ None' : '⚠ Attention Required'],
      ['Overall System Health', `${summary.healthPercentage}%`, summary.healthPercentage >= 80 ? '✓ Excellent' : summary.healthPercentage >= 70 ? '✓ Good' : '⚠ Needs Attention']
    ];

    currentY = this.drawTable(doc, tableData, currentY, [200, 150, 150]);

    // Key findings box
    currentY += 40;

    doc
      .roundedRect(60, currentY, doc.page.width - 120, 100, 5)
      .fillAndStroke('#e3f2fd', this.colors.primary);

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(this.colors.primary)
      .text('Key Findings', 80, currentY + 15);

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(this.colors.text);

    const findings = [
      `• ${summary.totalLoops} control loops were analyzed during this reporting period`,
      `• ${summary.loopsWithIssues} loop${summary.loopsWithIssues !== 1 ? 's' : ''} require${summary.loopsWithIssues === 1 ? 's' : ''} attention`,
      `• System health is at ${summary.healthPercentage}% - ${summary.healthPercentage >= 80 ? 'Excellent performance' : summary.healthPercentage >= 70 ? 'Good performance' : 'Improvement recommended'}`
    ];

    findings.forEach((finding, i) => {
      doc.text(finding, 80, currentY + 45 + (i * 18), { width: doc.page.width - 160 });
    });
  }

  private addLoopsSection(doc: typeof PDFDocument, loops: any[]) {
    this.addSectionTitle(doc, 'Loop Performance Details', 70);

    let currentY = 110;
    const validLoops = loops.filter(l => l !== null);

    validLoops.forEach((loop, index) => {
      // Check if we need a new page
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = 70;
      }

      // Loop card
      const cardHeight = 160;

      // Card background with left border accent
      const healthScore = loop.kpiStats?.avgServiceFactor || 0;
      const accentColor = healthScore >= 0.75 ? this.colors.success : healthScore >= 0.60 ? this.colors.warning : this.colors.danger;

      doc
        .rect(60, currentY, 5, cardHeight)
        .fill(accentColor);

      doc
        .roundedRect(65, currentY, doc.page.width - 130, cardHeight, 3)
        .fillAndStroke(this.colors.white, this.colors.border);

      // Loop header
      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .fillColor(this.colors.primary)
        .text(`${index + 1}. ${loop.name}`, 80, currentY + 15, { width: doc.page.width - 170 });

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(this.colors.textLight)
        .text(`Loop ID: ${loop.loop_id}`, 80, currentY + 33);

      if (loop.description) {
        doc
          .fontSize(9)
          .fillColor(this.colors.textLight)
          .text(loop.description, 80, currentY + 45, { width: doc.page.width - 170 });
      }

      // Tags
      doc
        .fontSize(8)
        .fillColor(this.colors.textLight)
        .text(`PV: ${loop.pv_tag}  |  OP: ${loop.op_tag}  |  SP: ${loop.sp_tag}`, 80, currentY + 65);

      // KPI Metrics in grid
      if (loop.kpiStats) {
        const stats = loop.kpiStats;
        const metricsY = currentY + 85;
        const col1X = 80;
        const col2X = 280;
        const col3X = 430;

        const metrics = [
          {
            label: 'Service Factor',
            value: stats.avgServiceFactor !== null ? `${(stats.avgServiceFactor * 100).toFixed(1)}%` : 'N/A',
            numValue: stats.avgServiceFactor,
            threshold: 0.75,
            inverse: false
          },
          {
            label: 'Performance Index',
            value: stats.avgPI !== null ? `${(stats.avgPI * 100).toFixed(1)}%` : 'N/A',
            numValue: stats.avgPI,
            threshold: 0.65,
            inverse: false
          },
          {
            label: 'RPI',
            value: stats.avgRPI !== null ? `${(stats.avgRPI * 100).toFixed(1)}%` : 'N/A',
            numValue: stats.avgRPI,
            threshold: 0.70,
            inverse: false
          },
          {
            label: 'Oscillation',
            value: stats.avgOscIndex !== null ? stats.avgOscIndex.toFixed(3) : 'N/A',
            numValue: stats.avgOscIndex,
            threshold: 0.4,
            inverse: true
          },
          {
            label: 'Stiction',
            value: stats.avgStiction !== null ? stats.avgStiction.toFixed(3) : 'N/A',
            numValue: stats.avgStiction,
            threshold: 0.5,
            inverse: true
          }
        ];

        metrics.forEach((metric, i) => {
          const x = i < 2 ? col1X : i < 4 ? col2X : col3X;
          const y = metricsY + (i % 2 === 0 ? 0 : 18);

          const color = this.getKpiColor(metric.numValue, metric.threshold, metric.inverse);

          doc
            .fontSize(8)
            .font('Helvetica')
            .fillColor(this.colors.textLight)
            .text(`${metric.label}:`, x, y, { continued: true })
            .font('Helvetica-Bold')
            .fillColor(color)
            .text(` ${metric.value}`);
        });
      } else {
        doc
          .fontSize(9)
          .font('Helvetica-Oblique')
          .fillColor(this.colors.textLight)
          .text('No KPI data available for this period', 80, currentY + 90);
      }

      // Record count
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(this.colors.textLight)
        .text(`${loop.recordCount} data points`, 80, currentY + cardHeight - 25);

      currentY += cardHeight + 20;
    });
  }

  private addSectionTitle(doc: typeof PDFDocument, title: string, y: number) {
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor(this.colors.primary)
      .text(title, 60, y);

    doc
      .strokeColor(this.colors.primary)
      .lineWidth(2)
      .moveTo(60, y + 25)
      .lineTo(doc.page.width - 60, y + 25)
      .stroke();
  }

  private drawTable(doc: typeof PDFDocument, data: string[][], startY: number, columnWidths: number[]): number {
    const startX = 60;
    const rowHeight = 30;
    let currentY = startY;

    data.forEach((row, rowIndex) => {
      let currentX = startX;

      row.forEach((cell, cellIndex) => {
        // Cell background
        if (rowIndex === 0) {
          doc
            .rect(currentX, currentY, columnWidths[cellIndex], rowHeight)
            .fill(this.colors.primary);
        } else if (rowIndex % 2 === 0) {
          doc
            .rect(currentX, currentY, columnWidths[cellIndex], rowHeight)
            .fill(this.colors.background);
        }

        // Cell border
        doc
          .rect(currentX, currentY, columnWidths[cellIndex], rowHeight)
          .stroke(this.colors.border);

        // Cell text
        doc
          .fontSize(rowIndex === 0 ? 10 : 9)
          .font(rowIndex === 0 ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(rowIndex === 0 ? this.colors.white : this.colors.text)
          .text(cell, currentX + 10, currentY + 10, {
            width: columnWidths[cellIndex] - 20,
            align: cellIndex === 0 ? 'left' : 'center'
          });

        currentX += columnWidths[cellIndex];
      });

      currentY += rowHeight;
    });

    return currentY;
  }

  private getKpiColor(value: number, threshold: number, inverse: boolean): string {
    if (value === null || value === undefined || isNaN(value)) {
      return this.colors.textLight;
    }

    if (inverse) {
      return value > threshold ? this.colors.danger : this.colors.success;
    } else {
      return value < threshold ? this.colors.danger : this.colors.success;
    }
  }

  private addHeadersAndFooters(doc: typeof PDFDocument, metadata: any) {
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);

      // Skip header/footer on cover page
      if (i === 0) continue;

      // Header
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(this.colors.textLight)
        .text(
          metadata.reportName,
          60,
          30,
          { width: doc.page.width - 120, align: 'left' }
        );

      // Footer
      const footerY = doc.page.height - 40;

      doc
        .fontSize(8)
        .fillColor(this.colors.textLight)
        .text(
          `Page ${i + 1} of ${totalPages}`,
          60,
          footerY,
          { width: doc.page.width - 120, align: 'center' }
        );

      doc
        .fontSize(8)
        .text(
          `Generated: ${new Date(metadata.generatedAt).toLocaleDateString()}`,
          60,
          footerY,
          { width: doc.page.width - 120, align: 'right' }
        );

      // Footer line
      doc
        .strokeColor(this.colors.border)
        .lineWidth(0.5)
        .moveTo(60, footerY - 5)
        .lineTo(doc.page.width - 60, footerY - 5)
        .stroke();
    }
  }
}
