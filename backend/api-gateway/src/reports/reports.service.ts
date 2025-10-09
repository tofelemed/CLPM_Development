import { Injectable, BadRequestException } from '@nestjs/common';
import { PgService } from '../shared/pg.service';
import { GenerateReportDto, TimeRange } from './dto/generate-report.dto';

export interface ReportData {
  metadata: {
    reportName: string;
    reportType: string;
    generatedAt: string;
    timeRange: {
      start: string;
      end: string;
    };
  };
  loops: Array<{
    loop_id: string;
    name: string;
    description: string;
    importance: number;
    pv_tag: string;
    op_tag: string;
    sp_tag: string;
    kpis: any[];
    kpiStats?: any;
    diagnostics: any[];
    config: any;
    recordCount: number;
  }>;
  summary: {
    totalLoops: number;
    avgServiceFactor: number;
    avgPI: number;
    avgRPI: number;
    loopsWithIssues: number;
    healthPercentage: number;
  };
}

@Injectable()
export class ReportsService {
  constructor(private pg: PgService) {}

  async generateReportData(dto: GenerateReportDto): Promise<ReportData> {
    const { startDate, endDate } = this.calculateTimeRange(dto);

    // Get loops data
    const loopIds = dto.loopIds && dto.loopIds.length > 0
      ? dto.loopIds
      : await this.getAllLoopIds();

    const loops = await Promise.all(
      loopIds.map(loopId => this.getLoopReportData(loopId, startDate, endDate, dto.kpis))
    );

    // Calculate summary
    const summary = this.calculateSummary(loops);

    return {
      metadata: {
        reportName: dto.reportName || `${dto.reportType} Report`,
        reportType: dto.reportType,
        generatedAt: new Date().toISOString(),
        timeRange: {
          start: startDate,
          end: endDate
        }
      },
      loops,
      summary
    };
  }

  private calculateTimeRange(dto: GenerateReportDto): { startDate: string; endDate: string } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (dto.timeRange === TimeRange.CUSTOM) {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException('Start and end dates are required for custom time range');
      }
      startDate = new Date(dto.startDate);
      endDate = new Date(dto.endDate);
    } else {
      switch (dto.timeRange) {
        case TimeRange.LAST_24H:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case TimeRange.LAST_7D:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case TimeRange.LAST_30D:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  private async getAllLoopIds(): Promise<string[]> {
    const { rows } = await this.pg.query(
      'SELECT loop_id FROM loops WHERE deleted_at IS NULL ORDER BY name'
    );
    return rows.map(r => r.loop_id);
  }

  private async getLoopReportData(
    loopId: string,
    startDate: string,
    endDate: string,
    kpis?: string[]
  ): Promise<any> {
    // Get loop basic info
    const loopQuery = `
      SELECT *
      FROM loops
      WHERE loop_id = $1 AND deleted_at IS NULL
    `;
    const { rows: loopRows } = await this.pg.query(loopQuery, [loopId]);

    if (loopRows.length === 0) {
      return null;
    }

    const loop = loopRows[0];

    // Try to get config data if table exists
    let config: any = {};
    try {
      const configQuery = `
        SELECT sf_low, sf_high, sat_high, rpi_low, rpi_high, osc_limit,
               service_factor_low_alarm, pi_low_alarm, oscillation_high_alarm, stiction_high_alarm
        FROM loop_configs
        WHERE loop_id = $1
      `;
      const { rows: configRows } = await this.pg.query(configQuery, [loopId]);
      if (configRows.length > 0) {
        config = configRows[0];
      }
    } catch (err) {
      // loop_configs table doesn't exist or no config, use defaults
      config = {
        sf_low: 0.75,
        sf_high: 0.95,
        sat_high: 0.9,
        rpi_low: 0.65,
        rpi_high: 0.90,
        osc_limit: 0.4,
        service_factor_low_alarm: 0.75,
        pi_low_alarm: 0.65,
        oscillation_high_alarm: 0.4,
        stiction_high_alarm: 0.5
      };
    }

    // Get KPI data
    const kpiQuery = `
      SELECT
        timestamp,
        service_factor, effective_sf, sat_percent, output_travel,
        pi, rpi, osc_index, stiction, deadband, saturation,
        valve_travel, settling_time, overshoot, rise_time,
        peak_error, integral_error, derivative_error, control_error,
        valve_reversals, noise_level, process_gain, time_constant,
        dead_time, setpoint_changes, mode_changes
      FROM kpi_results
      WHERE loop_id = $1 AND timestamp BETWEEN $2 AND $3
      ORDER BY timestamp DESC
    `;
    const { rows: kpiRows } = await this.pg.query(kpiQuery, [loopId, startDate, endDate]);

    // Get diagnostic data
    const diagQuery = `
      SELECT
        timestamp, stiction_S, stiction_J, stiction_pct,
        osc_period, root_cause, classification, details
      FROM diagnostic_results
      WHERE loop_id = $1 AND timestamp BETWEEN $2 AND $3
      ORDER BY timestamp DESC
      LIMIT 10
    `;
    const { rows: diagRows } = await this.pg.query(diagQuery, [loopId, startDate, endDate]);

    // Calculate KPI statistics
    const kpiStats = this.calculateKPIStats(kpiRows);

    return {
      loop_id: loopId,
      name: loop.name,
      description: loop.description,
      importance: loop.importance,
      pv_tag: loop.pv_tag,
      op_tag: loop.op_tag,
      sp_tag: loop.sp_tag,
      config: config,
      kpis: kpiRows,
      kpiStats,
      diagnostics: diagRows,
      recordCount: kpiRows.length
    };
  }

  private calculateKPIStats(kpiRows: any[]): any {
    if (kpiRows.length === 0) {
      return null;
    }

    const stats = {
      avgServiceFactor: null,
      avgPI: null,
      avgRPI: null,
      avgOscIndex: null,
      avgStiction: null,
      minServiceFactor: null,
      maxServiceFactor: null,
      minPI: null,
      maxPI: null,
      latest: kpiRows[0]
    };

    let sfSum = 0, piSum = 0, rpiSum = 0, oscSum = 0, stictionSum = 0;
    let sfCount = 0, piCount = 0, rpiCount = 0, oscCount = 0, stictionCount = 0;
    let minSF = Number.MAX_VALUE, maxSF = Number.MIN_VALUE;
    let minPI = Number.MAX_VALUE, maxPI = Number.MIN_VALUE;

    kpiRows.forEach(row => {
      if (row.service_factor !== null && !isNaN(row.service_factor)) {
        sfSum += row.service_factor;
        sfCount++;
        minSF = Math.min(minSF, row.service_factor);
        maxSF = Math.max(maxSF, row.service_factor);
      }
      if (row.pi !== null && !isNaN(row.pi)) {
        piSum += row.pi;
        piCount++;
        minPI = Math.min(minPI, row.pi);
        maxPI = Math.max(maxPI, row.pi);
      }
      if (row.rpi !== null && !isNaN(row.rpi)) {
        rpiSum += row.rpi;
        rpiCount++;
      }
      if (row.osc_index !== null && !isNaN(row.osc_index)) {
        oscSum += row.osc_index;
        oscCount++;
      }
      if (row.stiction !== null && !isNaN(row.stiction)) {
        stictionSum += row.stiction;
        stictionCount++;
      }
    });

    stats.avgServiceFactor = sfCount > 0 ? sfSum / sfCount : null;
    stats.avgPI = piCount > 0 ? piSum / piCount : null;
    stats.avgRPI = rpiCount > 0 ? rpiSum / rpiCount : null;
    stats.avgOscIndex = oscCount > 0 ? oscSum / oscCount : null;
    stats.avgStiction = stictionCount > 0 ? stictionSum / stictionCount : null;
    stats.minServiceFactor = sfCount > 0 ? minSF : null;
    stats.maxServiceFactor = sfCount > 0 ? maxSF : null;
    stats.minPI = piCount > 0 ? minPI : null;
    stats.maxPI = piCount > 0 ? maxPI : null;

    return stats;
  }

  private calculateSummary(loops: any[]): any {
    const validLoops = loops.filter(l => l !== null);

    let totalSF = 0, totalPI = 0, totalRPI = 0;
    let sfCount = 0, piCount = 0, rpiCount = 0;
    let loopsWithIssues = 0;
    let loopsWithData = 0;

    validLoops.forEach(loop => {
      if (loop.kpiStats) {
        let hasAnyData = false;
        let hasIssues = false;

        if (loop.kpiStats.avgServiceFactor !== null && !isNaN(loop.kpiStats.avgServiceFactor)) {
          totalSF += loop.kpiStats.avgServiceFactor;
          sfCount++;
          hasAnyData = true;

          if (loop.kpiStats.avgServiceFactor < 0.75) {
            hasIssues = true;
          }
        }

        if (loop.kpiStats.avgPI !== null && !isNaN(loop.kpiStats.avgPI)) {
          totalPI += loop.kpiStats.avgPI;
          piCount++;
          hasAnyData = true;

          if (loop.kpiStats.avgPI < 0.65) {
            hasIssues = true;
          }
        }

        if (loop.kpiStats.avgRPI !== null && !isNaN(loop.kpiStats.avgRPI)) {
          totalRPI += loop.kpiStats.avgRPI;
          rpiCount++;
          hasAnyData = true;
        }

        if (loop.kpiStats.avgOscIndex !== null && !isNaN(loop.kpiStats.avgOscIndex)) {
          hasAnyData = true;
          if (loop.kpiStats.avgOscIndex > 0.4) {
            hasIssues = true;
          }
        }

        if (loop.kpiStats.avgStiction !== null && !isNaN(loop.kpiStats.avgStiction)) {
          hasAnyData = true;
          if (loop.kpiStats.avgStiction > 0.5) {
            hasIssues = true;
          }
        }

        if (hasAnyData) {
          loopsWithData++;
          if (hasIssues) {
            loopsWithIssues++;
          }
        }
      }
    });

    return {
      totalLoops: validLoops.length,
      avgServiceFactor: sfCount > 0 ? Math.round((totalSF / sfCount) * 1000) / 1000 : 0,
      avgPI: piCount > 0 ? Math.round((totalPI / piCount) * 1000) / 1000 : 0,
      avgRPI: rpiCount > 0 ? Math.round((totalRPI / rpiCount) * 1000) / 1000 : 0,
      loopsWithIssues,
      healthPercentage: loopsWithData > 0
        ? Math.round(((loopsWithData - loopsWithIssues) / loopsWithData) * 100)
        : 0
    };
  }
}
