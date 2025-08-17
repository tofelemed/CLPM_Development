import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { HttpModule } from '@nestjs/axios';
import { PgService } from '../shared/pg.service';

@Module({
  imports: [HttpModule],
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService, PgService]
})
export class DiagnosticsModule {}
