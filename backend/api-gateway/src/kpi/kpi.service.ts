import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PgService } from '../shared/pg.service';

@Injectable()
export class KpiService {
  constructor(private pg: PgService) {}

  async getLoopKpis(loopId: string, start?: string, end?: string, limit?: number) {
    try {
      // Validate loop exists
      await this.validateLoopExists(loopId);

      let sql = `
        SELECT 
          timestamp, 
          service_factor, 
          effective_sf, 
          sat_percent, 
          output_travel, 
          pi, 
          rpi, 
          osc_index, 
          stiction,
          deadband,
          saturation,
          valve_travel,
          settling_time,
          overshoot,
          rise_time,
          peak_error,
          integral_error,
          derivative_error,
          control_error,
          valve_reversals,
          noise_level,
          process_gain,
          time_constant,
          dead_time,
          setpoint_changes,
          mode_changes
        FROM kpi_results 
        WHERE loop_id = $1
      `;
      
      const params: any[] = [loopId];
      let paramIndex = 1;

      if (start && end) {
        sql += ` AND timestamp BETWEEN $${++paramIndex} AND $${++paramIndex}`;
        params.push(start, end);
      } else if (start) {
        sql += ` AND timestamp >= $${++paramIndex}`;
        params.push(start);
      } else if (end) {
        sql += ` AND timestamp <= $${++paramIndex}`;
        params.push(end);
      }

      sql += ` ORDER BY timestamp DESC`;

      if (limit && limit > 0) {
        sql += ` LIMIT $${++paramIndex}`;
        params.push(limit);
      }

      const { rows } = await this.pg.query(sql, params);
      
      return {
        loop_id: loopId,
        count: rows.length,
        results: rows,
        time_range: {
          start: start || null,
          end: end || null
        }
      };
    } catch (error) {
      throw new BadRequestException(`Failed to retrieve KPIs: ${error.message}`);
    }
  }

  async getLatestKPI(loopId: string, window?: string) {
    try {
      // Validate loop exists
      await this.validateLoopExists(loopId);

      // Parse window parameter (e.g., "24h", "8h", "1h")
      const analysisWindow = this.parseTimeWindow(window || '24h');
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - analysisWindow);

      // Get the most recent KPI result within the window
      const sql = `
        SELECT 
          timestamp, 
          service_factor, 
          effective_sf, 
          sat_percent, 
          output_travel, 
          pi, 
          rpi, 
          osc_index, 
          stiction,
          deadband,
          saturation,
          valve_travel,
          settling_time,
          overshoot,
          rise_time,
          peak_error,
          integral_error,
          derivative_error,
          control_error,
          valve_reversals,
          noise_level,
          process_gain,
          time_constant,
          dead_time,
          setpoint_changes,
          mode_changes
        FROM kpi_results 
        WHERE loop_id = $1 AND timestamp >= $2 AND timestamp <= $3
        ORDER BY timestamp DESC 
        LIMIT 1
      `;

      const { rows } = await this.pg.query(sql, [loopId, startTime.toISOString(), endTime.toISOString()]);

      if (rows.length === 0) {
        // If no KPI results, try to calculate on-demand from raw data
        return await this.calculateOnDemandKPI(loopId, startTime, endTime);
      }

      return {
        loop_id: loopId,
        analysis_window: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          duration: window || '24h'
        },
        kpi: rows[0],
        calculated_at: new Date().toISOString()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to retrieve latest KPI: ${error.message}`);
    }
  }

  async getKPISummary(loopId: string, start?: string, end?: string) {
    try {
      // Validate loop exists
      await this.validateLoopExists(loopId);

      let sql = `
        SELECT 
          COUNT(*) as total_records,
          AVG(service_factor) as avg_service_factor,
          AVG(effective_sf) as avg_effective_sf,
          AVG(sat_percent) as avg_sat_percent,
          AVG(output_travel) as avg_output_travel,
          AVG(pi) as avg_pi,
          AVG(rpi) as avg_rpi,
          AVG(osc_index) as avg_osc_index,
          AVG(stiction) as avg_stiction,
          AVG(deadband) as avg_deadband,
          AVG(saturation) as avg_saturation,
          AVG(valve_travel) as avg_valve_travel,
          AVG(settling_time) as avg_settling_time,
          AVG(overshoot) as avg_overshoot,
          AVG(rise_time) as avg_rise_time,
          AVG(peak_error) as avg_peak_error,
          AVG(integral_error) as avg_integral_error,
          AVG(derivative_error) as avg_derivative_error,
          AVG(control_error) as avg_control_error,
          AVG(valve_reversals) as avg_valve_reversals,
          AVG(noise_level) as avg_noise_level,
          AVG(process_gain) as avg_process_gain,
          AVG(time_constant) as avg_time_constant,
          AVG(dead_time) as avg_dead_time,
          AVG(setpoint_changes) as avg_setpoint_changes,
          AVG(mode_changes) as avg_mode_changes,
          MIN(service_factor) as min_service_factor,
          MAX(service_factor) as max_service_factor,
          MIN(pi) as min_pi,
          MAX(pi) as max_pi,
          MIN(rpi) as min_rpi,
          MAX(rpi) as max_rpi,
          MIN(osc_index) as min_osc_index,
          MAX(osc_index) as max_osc_index,
          MIN(stiction) as min_stiction,
          MAX(stiction) as max_stiction
        FROM kpi_results 
        WHERE loop_id = $1
      `;
      
      const params: any[] = [loopId];

      if (start && end) {
        sql += ` AND timestamp BETWEEN $2 AND $3`;
        params.push(start, end);
      } else if (start) {
        sql += ` AND timestamp >= $2`;
        params.push(start);
      } else if (end) {
        sql += ` AND timestamp <= $2`;
        params.push(end);
      }

      const { rows } = await this.pg.query(sql, params);
      
      if (rows.length === 0) {
        throw new NotFoundException('No KPI data found for the specified time range');
      }

      const summary = rows[0];
      
      // Calculate trends (simplified - could be enhanced with more sophisticated analysis)
      const trends = await this.calculateTrends(loopId, start, end);

      return {
        loop_id: loopId,
        time_range: {
          start: start || null,
          end: end || null
        },
        summary: {
          total_records: parseInt(summary.total_records),
          averages: {
            service_factor: this.roundTo3Decimals(summary.avg_service_factor),
            effective_sf: this.roundTo3Decimals(summary.avg_effective_sf),
            sat_percent: this.roundTo3Decimals(summary.avg_sat_percent),
            output_travel: this.roundTo3Decimals(summary.avg_output_travel),
            pi: this.roundTo3Decimals(summary.avg_pi),
            rpi: this.roundTo3Decimals(summary.avg_rpi),
            osc_index: this.roundTo3Decimals(summary.avg_osc_index),
            stiction: this.roundTo3Decimals(summary.avg_stiction),
            deadband: this.roundTo3Decimals(summary.avg_deadband),
            saturation: this.roundTo3Decimals(summary.avg_saturation),
            valve_travel: this.roundTo3Decimals(summary.avg_valve_travel),
            settling_time: this.roundToInteger(summary.avg_settling_time),
            overshoot: this.roundTo3Decimals(summary.avg_overshoot),
            rise_time: this.roundToInteger(summary.avg_rise_time),
            peak_error: this.roundTo3Decimals(summary.avg_peak_error),
            integral_error: this.roundTo3Decimals(summary.avg_integral_error),
            derivative_error: this.roundTo3Decimals(summary.avg_derivative_error),
            control_error: this.roundTo3Decimals(summary.avg_control_error),
            valve_reversals: this.roundToInteger(summary.avg_valve_reversals),
            noise_level: this.roundTo3Decimals(summary.avg_noise_level),
            process_gain: this.roundTo3Decimals(summary.avg_process_gain),
            time_constant: this.roundToInteger(summary.avg_time_constant),
            dead_time: this.roundToInteger(summary.avg_dead_time),
            setpoint_changes: this.roundToInteger(summary.avg_setpoint_changes),
            mode_changes: this.roundToInteger(summary.avg_mode_changes)
          },
          ranges: {
            service_factor: {
              min: this.roundTo3Decimals(summary.min_service_factor),
              max: this.roundTo3Decimals(summary.max_service_factor)
            },
            pi: {
              min: this.roundTo3Decimals(summary.min_pi),
              max: this.roundTo3Decimals(summary.max_pi)
            },
            rpi: {
              min: this.roundTo3Decimals(summary.min_rpi),
              max: this.roundTo3Decimals(summary.max_rpi)
            },
            osc_index: {
              min: this.roundTo3Decimals(summary.min_osc_index),
              max: this.roundTo3Decimals(summary.max_osc_index)
            },
            stiction: {
              min: this.roundTo3Decimals(summary.min_stiction),
              max: this.roundTo3Decimals(summary.max_stiction)
            }
          }
        },
        trends,
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to retrieve KPI summary: ${error.message}`);
    }
  }

  private async validateLoopExists(loopId: string) {
    const sql = `SELECT loop_id FROM loops WHERE loop_id = $1 AND deleted_at IS NULL`;
    const { rows } = await this.pg.query(sql, [loopId]);

    if (rows.length === 0) {
      throw new NotFoundException(`Loop with ID ${loopId} not found`);
    }
  }

  private parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)([hmd])$/);
    if (!match) {
      throw new BadRequestException('Invalid time window format. Use format like "24h", "8h", "1h"');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h':
        return value * 60 * 60 * 1000; // hours to milliseconds
      case 'm':
        return value * 60 * 1000; // minutes to milliseconds
      case 'd':
        return value * 24 * 60 * 60 * 1000; // days to milliseconds
      default:
        throw new BadRequestException('Invalid time unit. Use h (hours), m (minutes), or d (days)');
    }
  }

  private async calculateOnDemandKPI(loopId: string, startTime: Date, endTime: Date) {
    // This would integrate with the KPI calculation logic
    // For now, return a placeholder indicating no data
    return {
      loop_id: loopId,
      analysis_window: {
        start: startTime.toISOString(),
        end: endTime.toISOString()
      },
      kpi: null,
      message: 'No KPI data available for the specified time window. Consider running KPI calculation or check data availability.',
      calculated_at: new Date().toISOString()
    };
  }

  private async calculateTrends(loopId: string, start?: string, end?: string): Promise<any> {
    try {
      // Simple trend calculation - compare first and last KPI values
      const sql = `
        SELECT timestamp, service_factor, pi, rpi
        FROM kpi_results 
        WHERE loop_id = $1
        ${start && end ? 'AND timestamp BETWEEN $2 AND $3' : ''}
        ORDER BY timestamp ASC
      `;
      
      const params: any[] = [loopId];
      if (start && end) {
        params.push(start, end);
      }

      const { rows } = await this.pg.query(sql, params);
      
      if (rows.length < 2) {
        return { message: 'Insufficient data for trend analysis' };
      }

      const first = rows[0];
      const last = rows[rows.length - 1];
      
      return {
        service_factor_trend: this.calculateTrend(first.service_factor, last.service_factor),
        pi_trend: this.calculateTrend(first.pi, last.pi),
        rpi_trend: this.calculateTrend(first.rpi, last.rpi),
        data_points: rows.length,
        period_days: (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (1000 * 60 * 60 * 24)
      };
    } catch (error) {
      return { message: 'Trend analysis failed', error: error.message };
    }
  }

  private calculateTrend(first: number, last: number): string {
    if (first === null || last === null) return 'unknown';
    const change = last - first;
    if (Math.abs(change) < 0.01) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  private roundTo3Decimals(value: number | null): number | null {
    if (value === null) return null;
    return Math.round(value * 1000) / 1000;
  }

  private roundToInteger(value: number | null): number | null {
    if (value === null) return null;
    return Math.round(value);
  }

  async getComprehensiveKPIs(loopId: string, start?: string, end?: string, limit?: number) {
    try {
      // Validate loop exists
      await this.validateLoopExists(loopId);

      let sql = `
        SELECT 
          kr.*,
          l.name as loop_name,
          l.description as loop_description,
          l.pv_tag,
          l.op_tag,
          l.sp_tag,
          l.importance,
          -- Calculated performance metrics
          (kr.service_factor + kr.pi + kr.rpi) / 3.0 as overall_performance,
          CASE 
            WHEN kr.osc_index < 0.3 AND kr.stiction < 0.3 THEN 'Good'
            ELSE 'Poor'
          END as control_quality,
          CASE 
            WHEN kr.stiction < 0.3 AND kr.valve_reversals < 15 THEN 'Good'
            ELSE 'Poor'
          END as valve_health,
          CASE 
            WHEN kr.noise_level < 0.1 AND kr.overshoot < 0.1 THEN 'Stable'
            ELSE 'Unstable'
          END as process_stability
        FROM kpi_results kr
        JOIN loops l ON kr.loop_id = l.loop_id
        WHERE kr.loop_id = $1 AND l.deleted_at IS NULL
      `;
      
      const params: any[] = [loopId];
      let paramIndex = 1;

      if (start && end) {
        sql += ` AND kr.timestamp BETWEEN $${++paramIndex} AND $${++paramIndex}`;
        params.push(start, end);
      } else if (start) {
        sql += ` AND kr.timestamp >= $${++paramIndex}`;
        params.push(start);
      } else if (end) {
        sql += ` AND kr.timestamp <= $${++paramIndex}`;
        params.push(end);
      }

      sql += ` ORDER BY kr.timestamp DESC`;

      if (limit && limit > 0) {
        sql += ` LIMIT $${++paramIndex}`;
        params.push(limit);
      }

      const { rows } = await this.pg.query(sql, params);
      
      return {
        loop_id: loopId,
        count: rows.length,
        results: rows,
        time_range: {
          start: start || null,
          end: end || null
        },
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      throw new BadRequestException(`Failed to retrieve comprehensive KPIs: ${error.message}`);
    }
  }
}
