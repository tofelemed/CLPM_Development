import { Injectable, BadRequestException } from '@nestjs/common';
import { PgService } from '../shared/pg.service';
import { InfluxDBService } from '../shared/influxdb.service';

const ALLOWED_FIELDS = new Set(['pv','op','sp','mode','valve_position','quality_code']);

@Injectable()
export class DataService {
  constructor(
    private pg: PgService,
    private influxdb: InfluxDBService
  ) {}

  async queryRaw(loopId: string, start: string, end: string, fields: string[], interval?: string, limit?: number) {
    if (!start || !end) throw new BadRequestException('start/end required');
    const valid = fields.filter(f => ALLOWED_FIELDS.has(f));
    if (valid.length === 0) throw new BadRequestException('No valid fields requested');

    try {
      // Query data from InfluxDB
      const data = await this.influxdb.queryData(loopId, start, end, valid);
      
      // Apply limit if specified
      const limitedData = limit ? data.slice(0, Math.min(limit, 1000)) : data;
      
      // Format response to match expected structure
      const result: any = { ts: limitedData.map(r => r.ts) };
      for (const f of valid) {
        result[f] = limitedData.map(r => r[f] ?? null);
      }
      
      return result;
    } catch (error) {
      throw new BadRequestException(`Failed to query InfluxDB data: ${error.message}`);
    }
  }

  async queryAggregated(loopId: string, start: string, end: string, interval: string = '1m') {
    try {
      // Query aggregated data from PostgreSQL first
      const query = `
        SELECT bucket as ts, pv_avg as pv, op_avg as op, sp_avg as sp, 
               pv_count, pv_min, pv_max
        FROM agg_1m
        WHERE loop_id = $1 
          AND bucket >= $2 
          AND bucket <= $3
        ORDER BY bucket ASC
      `;
      
      const { rows } = await this.pg.query(query, [loopId, start, end]);
      
      // If no aggregated data in PostgreSQL, try InfluxDB aggregation
      if (rows.length === 0) {
        const influxData = await this.influxdb.queryAggregatedData(loopId, start, end, interval);
        
        // Format InfluxDB aggregated data to match PostgreSQL structure
        const result: any = { 
          ts: influxData.map(r => r.bucket),
          pv: influxData.map(r => r.pv_avg),
          op: influxData.map(r => r.op_avg),
          sp: influxData.map(r => r.sp_avg),
          pv_count: influxData.map(r => r.pv_count),
          pv_min: influxData.map(() => null), // InfluxDB doesn't provide min/max
          pv_max: influxData.map(() => null)
        };
        
        return result;
      }
      
      // Format PostgreSQL aggregated data
      const result: any = { ts: rows.map(r => r.ts) };
      result.pv = rows.map(r => r.pv);
      result.op = rows.map(r => r.op);
      result.sp = rows.map(r => r.sp);
      result.pv_count = rows.map(r => r.pv_count);
      result.pv_min = rows.map(r => r.pv_min);
      result.pv_max = rows.map(r => r.pv_max);
      
      return result;
    } catch (error) {
      throw new BadRequestException(`Failed to query aggregated data: ${error.message}`);
    }
  }

  async getDataRange(loopId: string) {
    try {
      // Try to get range from InfluxDB first
      const influxRange = await this.influxdb.getDataRange(loopId);
      
      // Also check PostgreSQL for comparison
      const sql = `
        SELECT 
          MIN(bucket) as start,
          MAX(bucket) as end
        FROM agg_1m 
        WHERE loop_id = $1
      `;
      
      const { rows } = await this.pg.query(sql, [loopId]);
      
      if (rows.length > 0 && rows[0].start && rows[0].end) {
        // Use the broader range between InfluxDB and PostgreSQL
        const pgStart = new Date(rows[0].start);
        const pgEnd = new Date(rows[0].end);
        
        return {
          start: pgStart < influxRange.start ? pgStart : influxRange.start,
          end: pgEnd > influxRange.end ? pgEnd : influxRange.end
        };
      }
      
      return {
        start: influxRange.start.toISOString(),
        end: influxRange.end.toISOString()
      };
    } catch (error) {
      // Fallback to a reasonable default range if no data exists
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        start: weekAgo.toISOString(),
        end: now.toISOString()
      };
    }
  }

  async getRealTimeData(loopId: string, fields: string[] = ['pv', 'op', 'sp']) {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      
      // Query recent data from InfluxDB
      const data = await this.influxdb.queryData(
        loopId,
        oneMinuteAgo.toISOString(),
        now.toISOString(),
        fields
      );
      
      // Return the most recent data point
      if (data.length > 0) {
        const latest = data[data.length - 1];
        const result: any = { ts: latest.ts };
        for (const field of fields) {
          result[field] = latest[field];
        }
        return result;
      }
      
      return { ts: now, ...Object.fromEntries(fields.map(f => [f, null])) };
    } catch (error) {
      throw new BadRequestException(`Failed to get real-time data: ${error.message}`);
    }
  }
}
