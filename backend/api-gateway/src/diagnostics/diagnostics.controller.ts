import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DiagnosticsService } from './diagnostics.service';
import { PgService } from '../shared/pg.service';
import { InfluxDBService } from '../shared/influxdb.service';
import { Roles } from '../auth/roles.decorator';

@ApiTags('diagnostics')
@ApiBearerAuth()
@Controller('loops/:id/diagnostics')
export class DiagnosticsController {
  constructor(
    private readonly service: DiagnosticsService,
    private readonly pg: PgService,
    private readonly influx: InfluxDBService
  ) {}

  @Post('run')
  @Roles('engineer','admin')
  async run(@Param('id') id: string, @Body() payload: any) {
    // If no series data provided, fetch from InfluxDB
    if (!payload.series) {
      // Fetch last 15 minutes of data
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 15 * 60 * 1000);

      const data = await this.influx.queryData(
        id,
        startTime.toISOString(),
        endTime.toISOString(),
        ['pv', 'op', 'sp']
      );

      if (data.length === 0) {
        throw new Error('No data found in InfluxDB for this loop in the last 15 minutes');
      }

      // Convert to format expected by diagnostics service
      payload.series = {
        ts: data.map(d => d.ts.getTime() / 1000), // Unix epoch seconds
        pv: data.map(d => d.pv).filter(v => v !== null),
        op: data.map(d => d.op).filter(v => v !== null),
        sp: data.map(d => d.sp).filter(v => v !== null)
      };

      // Calculate sample rate
      if (data.length > 1) {
        const totalTime = (data[data.length - 1].ts.getTime() - data[0].ts.getTime()) / 1000;
        payload.sample_rate_hz = data.length / totalTime;
      }
    }

    const result = await this.service.run(id, payload);
    const sql = `INSERT INTO diagnostic_results(loop_id, timestamp, stiction_S, stiction_J, stiction_pct, osc_period, root_cause, classification, details)
                 VALUES ($1, now(), NULL, NULL, $2, $3, NULL, $4, $5) RETURNING id`;
    const details = { stiction_xcorr: result.stiction_xcorr, osc_index: result.osc_index };
    const { rows } = await this.pg.query(sql, [id, result.stiction_xcorr, result.osc_period_s, result.classification, details]);
    return { id: rows[0].id, ...result };
  }

  @Get()
  @Roles('viewer','engineer','admin')
  async latest(@Param('id') id: string) {
    const { rows } = await this.pg.query(
      `SELECT * FROM diagnostic_results WHERE loop_id = $1 ORDER BY timestamp DESC LIMIT 1`, [id]
    );
    return rows[0] || null;
  }

  @Get('history')
  @Roles('viewer','engineer','admin')
  async history(@Param('id') id: string) {
    const { rows } = await this.pg.query(
      `SELECT * FROM diagnostic_results WHERE loop_id = $1 ORDER BY timestamp DESC LIMIT 50`, [id]
    );
    return rows;
  }
}
