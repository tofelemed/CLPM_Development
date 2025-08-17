import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DiagnosticsService } from './diagnostics.service';
import { PgService } from '../shared/pg.service';
import { Roles } from '../auth/roles.decorator';

@ApiTags('diagnostics')
@ApiBearerAuth()
@Controller('loops/:id/diagnostics')
export class DiagnosticsController {
  constructor(private readonly service: DiagnosticsService, private readonly pg: PgService) {}

  @Post('run')
  @Roles('engineer','admin')
  async run(@Param('id') id: string, @Body() payload: any) {
    const result = await this.service.run(id, payload);
    const sql = `INSERT INTO diagnostic_results(loop_id, timestamp, stiction_S, stiction_J, stiction_pct, osc_period, root_cause, classification, details)
                 VALUES ($1, now(), NULL, NULL, NULL, $2, NULL, $3, $4) RETURNING id`;
    const details = { stiction_xcorr: result.stiction_xcorr, osc_index: result.osc_index };
    const { rows } = await this.pg.query(sql, [id, result.osc_period_s, result.classification, details]);
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
}
