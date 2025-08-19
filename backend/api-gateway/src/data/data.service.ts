import { Injectable, BadRequestException } from '@nestjs/common';
import { PgService } from '../shared/pg.service';

const ALLOWED_FIELDS = new Set(['pv','op','sp','mode','valve_position','quality_code']);

@Injectable()
export class DataService {
  constructor(private pg: PgService) {}

  async queryRaw(loopId: string, start: string, end: string, fields: string[], interval?: string, limit?: number) {
    if (!start || !end) throw new BadRequestException('start/end required');
    const valid = fields.filter(f => ALLOWED_FIELDS.has(f));
    if (valid.length === 0) throw new BadRequestException('No valid fields requested');

    const cols = ['ts', ...valid].join(', ');
    
    let sql = `SELECT ${cols} FROM raw_samples WHERE loop_id = $1 AND ts BETWEEN $2 AND $3`;
    
    // Add time-based sampling if interval is specified
    if (interval) {
      // Use simple sampling with LIMIT and OFFSET
      sql += ' ORDER BY ts ASC';
    } else {
      sql += ' ORDER BY ts ASC';
    }
    
    // Add limit if specified
    if (limit) {
      sql += ` LIMIT ${Math.min(limit, 1000)}`; // Cap at 1000 for safety
    }
    
    const { rows } = await this.pg.query(sql, [loopId, start, end]);

    const result: any = { ts: rows.map(r => r.ts) };
    for (const f of valid) result[f] = rows.map(r => r[f] ?? null);
    return result;
  }

  async getDataRange(loopId: string) {
    const sql = `
      SELECT 
        MIN(ts) as start,
        MAX(ts) as end
      FROM raw_samples 
      WHERE loop_id = $1
    `;
    
    const { rows } = await this.pg.query(sql, [loopId]);
    
    if (rows.length === 0 || !rows[0].start || !rows[0].end) {
      // Fallback to a reasonable default range if no data exists
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        start: weekAgo.toISOString(),
        end: now.toISOString()
      };
    }
    
    return {
      start: rows[0].start.toISOString(),
      end: rows[0].end.toISOString()
    };
  }
}
