import { Injectable, BadRequestException } from '@nestjs/common';
import { PgService } from '../shared/pg.service';
import { GenerateReportDto, TimeRange } from './dto/generate-report.dto';
import { toNumber, convertRowsNumbers } from '../shared/utils/number.utils';

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
    const { rows: rawKpiRows } = await this.pg.query(kpiQuery, [loopId, startDate, endDate]);
    
    // Convert all numeric fields from strings to numbers
    const numericFields = [
      'service_factor', 'effective_sf', 'sat_percent', 'output_travel',
      'pi', 'rpi', 'osc_index', 'stiction', 'deadband', 'saturation',
      'valve_travel', 'settling_time', 'overshoot', 'rise_time',
      'peak_error', 'integral_error', 'derivative_error', 'control_error',
      'valve_reversals', 'noise_level', 'process_gain', 'time_constant',
      'dead_time', 'setpoint_changes', 'mode_changes'
    ];
    const kpiRows = convertRowsNumbers(rawKpiRows, numericFields);

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

    // Calculate KPI statistics using database aggregation (like KPI service does)
    const kpiStats = await this.calculateKPIStatsFromDatabase(loopId, startDate, endDate);

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

  private async calculateKPIStatsFromDatabase(
    loopId: string,
    startDate: string,
    endDate: string
  ): Promise<any> {
    // Use database aggregation like KPI service does - returns proper numeric types!
    const statsQuery = `
      SELECT 
        COUNT(*) as record_count,
        AVG(CAST(service_factor AS NUMERIC)) as avg_service_factor,
        AVG(CAST(pi AS NUMERIC)) as avg_pi,
        AVG(CAST(rpi AS NUMERIC)) as avg_rpi,
        AVG(CAST(osc_index AS NUMERIC)) as avg_osc_index,
        AVG(CAST(stiction AS NUMERIC)) as avg_stiction,
        MIN(CAST(service_factor AS NUMERIC)) as min_service_factor,
        MAX(CAST(service_factor AS NUMERIC)) as max_service_factor,
        MIN(CAST(pi AS NUMERIC)) as min_pi,
        MAX(CAST(pi AS NUMERIC)) as max_pi
      FROM kpi_results
      WHERE loop_id = $1 AND timestamp BETWEEN $2 AND $3
    `;

    const { rows } = await this.pg.query(statsQuery, [loopId, startDate, endDate]);

    if (rows.length === 0 || rows[0].record_count === '0') {
      return null;
    }

    const stats = rows[0];

    // Get latest record for reference
    const latestQuery = `
      SELECT *
      FROM kpi_results
      WHERE loop_id = $1 AND timestamp BETWEEN $2 AND $3
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const { rows: latestRows } = await this.pg.query(latestQuery, [loopId, startDate, endDate]);

    // Convert to proper numbers (database AVG returns numeric, but still need safe conversion)
    return {
      avgServiceFactor: toNumber(stats.avg_service_factor),
      avgPI: toNumber(stats.avg_pi),
      avgRPI: toNumber(stats.avg_rpi),
      avgOscIndex: toNumber(stats.avg_osc_index),
      avgStiction: toNumber(stats.avg_stiction),
      minServiceFactor: toNumber(stats.min_service_factor),
      maxServiceFactor: toNumber(stats.max_service_factor),
      minPI: toNumber(stats.min_pi),
      maxPI: toNumber(stats.max_pi),
      latest: latestRows.length > 0 ? latestRows[0] : null
    };
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

        // Convert to number safely
        const avgSF = toNumber(loop.kpiStats.avgServiceFactor);
        const avgPI = toNumber(loop.kpiStats.avgPI);
        const avgRPI = toNumber(loop.kpiStats.avgRPI);
        const avgOscIndex = toNumber(loop.kpiStats.avgOscIndex);
        const avgStiction = toNumber(loop.kpiStats.avgStiction);

        if (avgSF !== null) {
          totalSF += avgSF;
          sfCount++;
          hasAnyData = true;

          if (avgSF < 0.75) {
            hasIssues = true;
          }
        }

        if (avgPI !== null) {
          totalPI += avgPI;
          piCount++;
          hasAnyData = true;

          if (avgPI < 0.65) {
            hasIssues = true;
          }
        }

        if (avgRPI !== null) {
          totalRPI += avgRPI;
          rpiCount++;
          hasAnyData = true;
        }

        if (avgOscIndex !== null) {
          hasAnyData = true;
          if (avgOscIndex > 0.4) {
            hasIssues = true;
          }
        }

        if (avgStiction !== null) {
          hasAnyData = true;
          if (avgStiction > 0.5) {
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
