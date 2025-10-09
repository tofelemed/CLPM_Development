import { Body, Controller, Post, Res, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { PdfGeneratorService } from './generators/pdf-generator.service';
import { ExcelGeneratorService } from './generators/excel-generator.service';
import { GenerateReportDto, ReportFormat } from './dto/generate-report.dto';
import { Roles } from '../auth/roles.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly excelGenerator: ExcelGeneratorService
  ) {}

  @Post('generate')
  @Roles('viewer', 'engineer', 'admin')
  @ApiOperation({ summary: 'Generate a control loop performance report' })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async generateReport(
    @Body() dto: GenerateReportDto,
    @Res() res: Response
  ) {
    try {
      // Get report data
      const reportData = await this.reportsService.generateReportData(dto);

      // Generate report in requested format
      let buffer: Buffer;
      let contentType: string;
      let fileExtension: string;

      switch (dto.format) {
        case ReportFormat.PDF:
          buffer = await this.pdfGenerator.generatePDF(reportData);
          contentType = 'application/pdf';
          fileExtension = 'pdf';
          break;

        case ReportFormat.EXCEL:
          buffer = await this.excelGenerator.generateExcel(reportData);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileExtension = 'xlsx';
          break;

        case ReportFormat.CSV:
          buffer = await this.excelGenerator.generateCSV(reportData);
          contentType = 'text/csv';
          fileExtension = 'csv';
          break;

        default:
          throw new BadRequestException('Unsupported report format');
      }

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const reportName = (dto.reportName || dto.reportType).replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${reportName}_${timestamp}.${fileExtension}`;

      // Set response headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);

      // Send file
      res.status(HttpStatus.OK).send(buffer);
    } catch (error) {
      throw new BadRequestException(`Failed to generate report: ${error.message}`);
    }
  }

  @Post('preview')
  @Roles('viewer', 'engineer', 'admin')
  @ApiOperation({ summary: 'Preview report data without generating file' })
  @ApiResponse({ status: 200, description: 'Report data retrieved successfully' })
  async previewReport(@Body() dto: GenerateReportDto) {
    try {
      const reportData = await this.reportsService.generateReportData(dto);
      return {
        success: true,
        data: reportData
      };
    } catch (error) {
      throw new BadRequestException(`Failed to preview report: ${error.message}`);
    }
  }
}
