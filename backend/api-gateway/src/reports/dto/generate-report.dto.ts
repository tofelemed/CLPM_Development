import { IsString, IsOptional, IsArray, IsEnum, IsDateString } from 'class-validator';

export enum ReportType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom'
}

export enum ReportFormat {
  EXCEL = 'excel',
  CSV = 'csv'
}

export enum TimeRange {
  LAST_24H = '24h',
  LAST_7D = '7d',
  LAST_30D = '30d',
  CUSTOM = 'custom'
}

export class GenerateReportDto {
  @IsString()
  @IsOptional()
  reportName?: string;

  @IsEnum(ReportType)
  reportType: ReportType;

  @IsEnum(TimeRange)
  timeRange: TimeRange;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsEnum(ReportFormat)
  @IsOptional()
  format?: ReportFormat;

  @IsArray()
  @IsOptional()
  loopIds?: string[];

  @IsArray()
  @IsOptional()
  kpis?: string[];
}
