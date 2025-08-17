import { Injectable, BadRequestException } from '@nestjs/common';
import { PgService } from '../shared/pg.service';

const ALLOWED_FIELDS = new Set(['pv','op','sp','mode','valve_position','quality_code']);

@Injectable()
export class DataService {
  constructor(private pg: PgService) {}

  async queryRaw(loopId: string, start: string, end: string, fields: string[]) {
    if (!start || !end) throw new BadRequestException('start/end required');
    const valid = fields.filter(f => ALLOWED_FIELDS.has(f));
    if (valid.length === 0) throw new BadRequestException('No valid fields requested');

    const cols = ['ts', ...valid].join(', ');
    const sql = `SELECT ${cols} FROM raw_samples WHERE loop_id = $1 AND ts BETWEEN $2 AND $3 ORDER BY ts ASC`;
    const { rows } = await this.pg.query(sql, [loopId, start, end]);

    const result: any = { ts: rows.map(r => r.ts) };
    for (const f of valid) result[f] = rows.map(r => r[f] ?? null);
    return result;
  }
}
