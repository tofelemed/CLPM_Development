import { Module } from '@nestjs/common';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';
import { PgService } from '../shared/pg.service';

@Module({
  controllers: [KpiController],
  providers: [KpiService, PgService]
})
export class KpiModule {}
