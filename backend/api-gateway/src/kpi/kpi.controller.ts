import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery, ApiParam } from '@nestjs/swagger';
import { KpiService } from './kpi.service';
import { Roles } from '../auth/roles.decorator';

@ApiTags('kpi')
@ApiBearerAuth()
@Controller('loops/:id/kpis')
export class KpiController {
  constructor(private readonly service: KpiService) {}

  @Get()
  @ApiParam({ name: 'id', description: 'Loop ID' })
  @ApiQuery({ name: 'start', description: 'Start time (ISO 8601)', required: false })
  @ApiQuery({ name: 'end', description: 'End time (ISO 8601)', required: false })
  @ApiQuery({ name: 'limit', description: 'Maximum number of results', required: false, type: Number })
  @Roles('viewer','engineer','admin')
  async list(
    @Param('id') id: string, 
    @Query('start') start?: string, 
    @Query('end') end?: string,
    @Query('limit') limit?: number
  ) {
    return this.service.getLoopKpis(id, start, end, limit);
  }

  @Get('latest')
  @ApiParam({ name: 'id', description: 'Loop ID' })
  @ApiQuery({ name: 'window', description: 'Analysis window (e.g., 24h, 8h, 1h)', required: false })
  @Roles('viewer','engineer','admin')
  async getLatest(
    @Param('id') id: string,
    @Query('window') window?: string
  ) {
    return this.service.getLatestKPI(id, window);
  }

  @Get('summary')
  @ApiParam({ name: 'id', description: 'Loop ID' })
  @ApiQuery({ name: 'start', description: 'Start time (ISO 8601)', required: false })
  @ApiQuery({ name: 'end', description: 'End time (ISO 8601)', required: false })
  @Roles('viewer','engineer','admin')
  async getSummary(
    @Param('id') id: string,
    @Query('start') start?: string,
    @Query('end') end?: string
  ) {
    return this.service.getKPISummary(id, start, end);
  }
}
